"""
modules/watchdog.py - Connection Monitor & Message Recovery
"""
import logging
import asyncio
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import threading

from services import get_notification_service
# Type hinting only
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from services.bot_orchestrator import BotOrchestrator

logger = logging.getLogger(__name__)

# Cache for deduplication
processed_messages_cache = {} 
processed_messages_lock = threading.Lock()
executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix='watchdog_worker')

def cleanup_message_cache():
    """Remove old messages from cache (>1 hour)."""
    try:
        now = datetime.now()
        with processed_messages_lock:
            expired = [
                msg_id for msg_id, ts in processed_messages_cache.items()
                if isinstance(ts, datetime) and now - ts > timedelta(hours=1)
            ]
            for msg_id in expired:
                del processed_messages_cache[msg_id]
            if expired:
                logger.debug(f"🧹 Cache cleaned: {len(expired)} items removed")
    except Exception as e:
        logger.error(f"❌ Cache cleanup error: {e}")

def watchdog_routine(orchestrator: 'BotOrchestrator'):
    """
    Checks WPPConnect connection and fetches unread messages.
    """
    notifier = get_notification_service()
    
    # 1. Check Connection
    try:
        if not notifier.check_connection(timeout=2):
            # logger.warning("⚠️ Watchdog: Disconnected")
            return
    except Exception as e:
        logger.error(f"❌ Watchdog connection check failed: {e}")
        return

    # 2. Get Unread
    try:
        messages = notifier.get_unread_messages(timeout=3)
        if not messages:
            return

        logger.info(f"📬 Watchdog: {len(messages)} unread messages found")
        
        new_messages = []
        with processed_messages_lock:
            for msg in messages:
                # Robust ID extraction
                msg_id = msg.get('id')
                if isinstance(msg_id, dict):
                    msg_id = msg_id.get('_serialized')
                
                if msg_id and msg_id not in processed_messages_cache:
                    new_messages.append(msg)
                    processed_messages_cache[msg_id] = datetime.now()
        
        if not new_messages:
            return

        logger.info(f"🆕 Watchdog: Processing {len(new_messages)} NEW messages")
        
        for msg in new_messages:
            executor.submit(_safe_process, orchestrator, msg)
            
    except Exception as e:
        logger.error(f"❌ Watchdog fetch error: {e}")

def _safe_process(orchestrator, msg):
    try:
        asyncio.run(orchestrator.process_payload(msg))
    except Exception as e:
        logger.error(f"❌ Watchdog processing failed for msg: {e}", exc_info=True)
