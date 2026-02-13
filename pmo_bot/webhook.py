"""
webhook.py - FastAPI Entrypoint (Migrated from Flask)

Receives WhatsApp webhook events, validates them, and enqueues
heavy processing to the arq worker via Redis.
"""
import os
import hmac
import time
import logging
from contextlib import asynccontextmanager
from typing import Any, Dict

from fastapi import FastAPI, Request, Query, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from arq.connections import ArqRedis, create_pool, RedisSettings

from modules.watchdog import watchdog_routine, cleanup_message_cache
from modules.whatsapp_client import get_messages  # For /reprocess
from services.bot_orchestrator import BotOrchestrator

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
load_dotenv()

WPPCONNECT_TOKEN = os.getenv("WPPCONNECT_TOKEN")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "admin123")
DEBUG = os.getenv("DEBUG", "false").lower() == "true"
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")
MAX_MESSAGE_AGE = 600  # 10 minutes (seconds)
ARQ_QUEUE = "arq:pmo"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Redis URL parser (shared with worker.py)
# ---------------------------------------------------------------------------
def _parse_redis_url(url: str) -> RedisSettings:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    return RedisSettings(
        host=parsed.hostname or "localhost",
        port=parsed.port or 6379,
        password=parsed.password,
        database=int(parsed.path.lstrip("/") or 0),
    )


# ---------------------------------------------------------------------------
# Application Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(application: FastAPI):
    """Manage Redis pool and scheduler across the app lifetime."""
    # --- Startup ---
    logger.info("🚀 FastAPI starting up...")

    # Redis pool for enqueuing jobs
    redis: ArqRedis = await create_pool(_parse_redis_url(REDIS_URL))
    application.state.redis = redis

    # Orchestrator (only for lightweight sync commands: /saldo, /planos, etc.)
    orchestrator = BotOrchestrator()
    application.state.orchestrator = orchestrator

    # Background scheduler (watchdog + cache cleanup)
    from apscheduler.schedulers.background import BackgroundScheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        watchdog_routine, "interval",
        args=[orchestrator], seconds=60, max_instances=1,
    )
    scheduler.add_job(cleanup_message_cache, "interval", seconds=3600)
    scheduler.start()
    application.state.scheduler = scheduler

    logger.info("✅ FastAPI ready — Redis pool & Scheduler online")

    yield  # ← app is running

    # --- Shutdown ---
    logger.info("🛑 FastAPI shutting down...")
    scheduler.shutdown(wait=False)
    await redis.close()
    logger.info("✅ Cleanup complete")


app = FastAPI(
    title="PMO Bot – Webhook",
    version="0.5.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _verify_token(received: str | None) -> bool:
    """Constant-time token comparison."""
    if not received or not WPPCONNECT_TOKEN:
        return False
    return hmac.compare_digest(received, WPPCONNECT_TOKEN)


def _check_ttl(data: Dict[str, Any]) -> float | None:
    """Return message age in seconds, or None if timestamp missing."""
    ts = data.get("timestamp") or (data.get("message") or {}).get("timestamp")
    if not ts:
        return None
    ts = float(ts)
    if ts > 100_000_000_000:  # milliseconds → seconds
        ts /= 1000.0
    return time.time() - ts


def _check_admin(authorization: str | None) -> bool:
    if not authorization:
        return False
    token = authorization.replace("Bearer ", "")
    return token == ADMIN_TOKEN


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.post("/webhook")
async def webhook(
    request: Request,
    token: str | None = Query(default=None),
    authorization: str | None = Header(default=None),
):
    """
    Receive a WPPConnect webhook event.

    Light validations run here (token, TTL, broadcast filter).
    Heavy processing is enqueued to the arq worker.
    """
    # 1. Token validation
    received_token = token
    if not received_token and authorization and authorization.startswith("Bearer "):
        received_token = authorization.replace("Bearer ", "")

    if not _verify_token(received_token):
        return JSONResponse(
            {"status": "token_invalid", "error": "Access Denied"},
            status_code=200,  # 200 to avoid sender retry loops
        )

    # 2. Parse body
    data: Dict[str, Any] = await request.json()

    # 3. TTL check
    try:
        age = _check_ttl(data)
        if age is not None and age > MAX_MESSAGE_AGE:
            logger.warning(f"⏳ TTL DROP: Mensagem de {age:.1f}s atrás ignorada.")
            return {"status": "ignored_old", "age": round(age, 2)}
    except Exception as e:
        logger.warning(f"⚠️ TTL Check Error: {e}")

    # 4. Broadcast filter (cheap, do it here)
    sender = data.get("from", "")
    if (
        "status@broadcast" in sender
        or sender.endswith("@broadcast")
    ):
        return {"status": "ignored_broadcast"}

    # 5. Enqueue to worker
    redis: ArqRedis = request.app.state.redis
    job = await redis.enqueue_job(
        "process_message_task",
        data,
        _queue_name=ARQ_QUEUE,
    )

    logger.info(f"📨 Enqueued job {job.job_id} for {sender}")
    return {"status": "queued", "job_id": job.job_id}


# ---------------------------------------------------------------------------
# Reprocess endpoint (admin / debug)
# ---------------------------------------------------------------------------
@app.post("/reprocess")
async def reprocess_last_messages(
    request: Request,
    authorization: str | None = Header(default=None),
):
    """Manual endpoint to force reprocessing of the last N messages."""
    # Auth
    if not authorization:
        return JSONResponse({"status": "unauthorized"}, status_code=401)
    token = authorization.replace("Bearer ", "")
    if token != WPPCONNECT_TOKEN:
        return JSONResponse({"status": "unauthorized"}, status_code=401)

    data = await request.json()
    phone = data.get("phone")
    if not phone:
        return JSONResponse(
            {"status": "error", "message": "Phone required"},
            status_code=400,
        )

    # Normalize phone
    if "@" not in phone:
        phone = f"{phone}@lid" if len(phone) > 13 else f"{phone}@c.us"

    logger.info(f"🔄 REPROCESS: Fetching messages for {phone}...")
    res = get_messages(phone, count=data.get("limit", 1))

    if not res.success:
        return JSONResponse(
            {"status": "error", "message": res.error_message},
            status_code=500,
        )

    redis: ArqRedis = request.app.state.redis
    count = 0
    for msg in res.data or []:
        if msg.get("fromMe"):
            continue
        msg["event"] = "onmessage"
        await redis.enqueue_job(
            "process_message_task", msg, _queue_name=ARQ_QUEUE,
        )
        count += 1

    return {"status": "success", "enqueued": count}


# ---------------------------------------------------------------------------
# Admin routes
# ---------------------------------------------------------------------------
@app.post("/admin/register-lid")
async def admin_register_lid(
    request: Request,
    authorization: str | None = Header(default=None),
):
    if not _check_admin(authorization):
        return JSONResponse({"status": "unauthorized"}, status_code=401)
    data = await request.json()
    orchestrator: BotOrchestrator = request.app.state.orchestrator
    success = orchestrator.auth_service.lid_manager.set_mapping(
        data.get("lid_id"),
        data.get("phone_number"),
        data.get("user_name"),
        "api_admin",
    )
    return JSONResponse(
        {"status": "success" if success else "error"},
        status_code=200 if success else 500,
    )


@app.get("/admin/list-lids")
async def admin_list(
    request: Request,
    authorization: str | None = Header(default=None),
):
    if not _check_admin(authorization):
        return JSONResponse({"status": "unauthorized"}, status_code=401)
    orchestrator: BotOrchestrator = request.app.state.orchestrator
    return {"data": orchestrator.auth_service.lid_manager.list_all_mappings()}


@app.delete("/admin/delete-lid/{lid_id}")
async def admin_del(
    lid_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
):
    if not _check_admin(authorization):
        return JSONResponse({"status": "unauthorized"}, status_code=401)
    orchestrator: BotOrchestrator = request.app.state.orchestrator
    success = orchestrator.auth_service.lid_manager.delete_mapping(lid_id)
    return JSONResponse(
        {"status": "success" if success else "error"},
        status_code=200 if success else 500,
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok"}
