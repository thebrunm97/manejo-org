"""
worker.py - Async Task Worker (arq + Redis)

Processes WhatsApp messages in background via arq task queue.
Decouples the webhook (fast HTTP response) from the heavy AI pipeline.

Usage:
    arq worker.WorkerSettings
"""
import os
import logging
from typing import Any, Dict

from dotenv import load_dotenv
from arq import cron
from arq.connections import RedisSettings

from services.bot_orchestrator import BotOrchestrator

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger("worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")


def _parse_redis_url(url: str) -> RedisSettings:
    """Convert a redis:// URL into arq RedisSettings."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int(parsed.path.lstrip("/") or 0),
    )


# ---------------------------------------------------------------------------
# Lifecycle Hooks
# ---------------------------------------------------------------------------
async def on_startup(ctx: Dict[str, Any]) -> None:
    """Called once when the worker boots. Initializes shared resources."""
    logger.info("🚀 Worker starting up...")
    ctx["orchestrator"] = BotOrchestrator()
    logger.info("✅ Worker ready — BotOrchestrator initialized")


async def on_shutdown(ctx: Dict[str, Any]) -> None:
    """Called when the worker shuts down gracefully."""
    logger.info("🛑 Worker shutting down...")


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------
async def process_message_task(ctx: Dict[str, Any], data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main task: process a single WhatsApp inbound payload.

    This is enqueued by the webhook and executed here in background so the
    HTTP response is returned immediately (< 200 ms).

    Args:
        ctx:  arq worker context (contains 'orchestrator').
        data: Raw webhook payload dict.

    Returns:
        Result dict from BotOrchestrator.process_payload().
    """
    orchestrator: BotOrchestrator = ctx["orchestrator"]
    sender = data.get("from", "unknown")

    try:
        logger.info(f"📥 Processing message from {sender}")
        result = orchestrator.process_payload(data)
        logger.info(f"✅ Done [{sender}] → {result.get('status', '?')}")
        return result

    except Exception as exc:
        logger.error(
            f"❌ Task failed for {sender}: {exc}",
            exc_info=True,
        )
        return {"status": "worker_error", "error": str(exc)}


# ---------------------------------------------------------------------------
# Worker Settings (entrypoint for `arq worker.WorkerSettings`)
# ---------------------------------------------------------------------------
class WorkerSettings:
    """arq worker configuration."""

    # -- Redis
    redis_settings = _parse_redis_url(REDIS_URL)

    # -- Registered task functions
    functions = [process_message_task]

    # -- Lifecycle hooks
    on_startup = on_startup
    on_shutdown = on_shutdown

    # -- Concurrency & reliability
    max_jobs = 10            # max concurrent tasks
    job_timeout = 120        # seconds before a stuck job is killed
    max_tries = 2            # retry once on failure
    health_check_interval = 30  # seconds between health pings

    # -- Queue name (allows multiple queues in the future)
    queue_name = "arq:pmo"
