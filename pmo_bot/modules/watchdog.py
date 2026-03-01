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

import os
import redis

# Redis config
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

def _get_redis():
    """Returns a sync Redis client."""
    return redis.from_url(REDIS_URL, decode_responses=True)

# Shared ID extraction (Matches webhook.py)
def _extract_message_id(data: dict) -> str | None:
    # 1. Main ID
    msg_id = data.get("id") or (data.get("message") or {}).get("id")
    if isinstance(msg_id, dict):
        msg_id = msg_id.get("_serialized") or msg_id.get("id")
        
    if not msg_id and "key" in data:
        msg_id = data.get("key", {}).get("id")
    
    # 2. Chat ID
    chat_id = data.get("from") or (data.get("message") or {}).get("from")
    if not chat_id and "key" in data:
        chat_id = data.get("key", {}).get("remoteJid")

    if not msg_id or not chat_id:
        return None
        
    return f"dup:{chat_id}:{msg_id}"

executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix='watchdog_worker')

# LEGACY: cleanup_message_cache is now handled by Redis TTL (ex=600)
def cleanup_message_cache():
    """No-op: handled by Redis TTL."""
    pass

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
        r = _get_redis()
        
        for msg in messages:
            redis_key = _extract_message_id(msg)
            if not redis_key:
                continue
            
            # Atomic SET NX EX 600
            if r.set(redis_key, "1", nx=True, ex=600):
                new_messages.append(msg)
            else:
                logger.info(f"♻️ Watchdog: Duplicada ignorada (Redis): {redis_key}")
        
        if not new_messages:
            return

        logger.info(f"🆕 Watchdog: Processing {len(new_messages)} NEW messages")
        
        for msg in new_messages:
            # Wrap in expected webhook format for Pydantic validation
            payload = msg.copy()
            if 'event' not in payload:
                payload['event'] = 'onmessage'
            executor.submit(_safe_process, orchestrator, payload)
            
    except Exception as e:
        logger.error(f"❌ Watchdog fetch error: {e}")

def _safe_process(orchestrator, msg):
    try:
        asyncio.run(orchestrator.process_payload(msg))
    except Exception as e:
        logger.error(f"❌ Watchdog processing failed for msg: {e}", exc_info=True)
