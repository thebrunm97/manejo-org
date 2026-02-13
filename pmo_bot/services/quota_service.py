"""
services/quota_service.py - Quota Management & Billing Audit
"""
import time
import logging
from datetime import datetime
from typing import Optional, Dict, Any, ContextManager
import sys
import os

from modules.database import get_supabase_client
from metrics import incr

logger = logging.getLogger(__name__)

# Constants
FREE_TIER_DAILY_LIMIT = 100

PRICING_TABLE = {
    "llama-3-70b-8192": {"prompt": 0.59, "completion": 0.79},
    "llama-3.3-70b-versatile": {"prompt": 0.59, "completion": 0.79},
    "gemini-1.5-flash": {"prompt": 0.075, "completion": 0.30},
    "whisper-large-v3": {"prompt": 0.00010, "completion": 0.0},
    "default": {"prompt": 0.59, "completion": 0.79}
}

class QuotaService:
    """Service to handle user quotas and billing logs."""
    
    def check_user_quota(self, user_id: str, cost: int = 0) -> dict:
        """
        Verifica se o usuário tem cota disponível.
        Retorna dict com allowed, remaining, limit, message.
        """
        try:
            with get_supabase_client() as supabase:
                 res = supabase.table("profiles").select(
                    "id, plan_tier, daily_request_count, last_usage_date"
                 ).eq("id", user_id).execute()
            
            if not res.data:
                logger.warning(f"⚠️ User {user_id} not found for quota check")
                return {"allowed": True, "remaining": FREE_TIER_DAILY_LIMIT, "limit": FREE_TIER_DAILY_LIMIT, "message": None}
            
            profile = res.data[0]
            plan_tier = str(profile.get("plan_tier") or "free").lower()
            daily_count = profile.get("daily_request_count", 0) or 0
            last_usage = profile.get("last_usage_date")
            
            today = datetime.now().strftime("%Y-%m-%d")
            
            # Reset diário logic
            if last_usage and last_usage != today:
                daily_count = 0
            
            # Verifica Plano Free
            if plan_tier == "free":
                if daily_count + cost > FREE_TIER_DAILY_LIMIT:
                    logger.warning(f"⛔ User {user_id} exceeded free tier quota")
                    return {
                        "allowed": False,
                        "remaining": max(0, FREE_TIER_DAILY_LIMIT - daily_count),
                        "limit": FREE_TIER_DAILY_LIMIT,
                        "message": f"⚠️ Saldo insuficiente! Limite diário: {FREE_TIER_DAILY_LIMIT}."
                    }
                
                remaining = FREE_TIER_DAILY_LIMIT - daily_count
                return {"allowed": True, "remaining": remaining, "limit": FREE_TIER_DAILY_LIMIT, "message": None}
            
            # Premium/Unlimited
            return {"allowed": True, "remaining": 9999, "limit": 9999, "message": None}
            
        except Exception as e:
            logger.error(f"❌ Error checking quota: {e}")
            return {"allowed": True, "remaining": 9999, "limit": 9999, "message": None}

    def log_consumption(self, user_id: str, request_id: str, acao: str, modelo: str, 
                       usage: dict, duracao_ms: int, status: str = "success", meta: dict = None) -> bool:
        """
        Registra consumo e atualiza estatísticas.
        """
        try:
            # 1. Calc Cost
            safe_usage = usage or {}
            t_prompt = safe_usage.get("prompt_tokens", 0)
            t_completion = safe_usage.get("completion_tokens", 0)
            t_total = safe_usage.get("total_tokens", t_prompt + t_completion)

            pricing_key = "default"
            is_linear = False # If true, prompt_tokens is seconds
            
            if modelo:
                if "gemini-1.5-flash" in modelo: pricing_key = "gemini-1.5-flash"
                elif "whisper" in modelo.lower(): 
                     pricing_key = "whisper-large-v3"
                     is_linear = True
                elif modelo in PRICING_TABLE: pricing_key = modelo

            precos = PRICING_TABLE.get(pricing_key, PRICING_TABLE["default"])
            
            if is_linear:
                 custo = t_prompt * precos["prompt"] # t_prompt is duration in seconds
            else:
                 custo = (t_prompt / 1_000_000) * precos["prompt"] + (t_completion / 1_000_000) * precos["completion"]
            
            payload = {
                "user_id": user_id, "request_id": request_id, 
                "acao": acao, "modelo_ia": modelo,
                "tokens_prompt": t_prompt, "tokens_completion": t_completion, "total_tokens": t_total,
                "custo_estimado": float(f"{custo:.8f}"),
                "duracao_ms": int(duracao_ms),
                "status": status, "meta": meta or {},
                "created_at": datetime.utcnow().isoformat()
            }

            # 2. Insert Log
            with get_supabase_client() as supabase:
                supabase.table("logs_consumo").insert(payload).execute()
            
            logger.info(f"🧾 Billing [{request_id}]: {t_total} units | ${custo:.6f} | {duracao_ms}ms")

            # 3. Increment Usage (Best Effort)
            try:
                with get_supabase_client() as supabase:
                    # Try RPC first
                    supabase.rpc("increment_usage_stats", {
                        "p_user_id": user_id, "p_tokens": t_total, "p_credits_cost": 1
                    }).execute()
            except:
                # Fallback
                pass

            return True
        except Exception as e:
            logger.error(f"❌ Billing Log Failed: {e}", exc_info=True)
            return False

class BillingContext:
    """Context Manager for automatic billing/audit logging."""
    
    def __init__(self, user_id: str, request_id: str, service: QuotaService = None):
        self.user_id = user_id
        self.request_id = request_id
        self.service = service or QuotaService() # Default instance
        self.start_time = None
        
        # Public state to be updated by block
        self.usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
        self.acao = "processamento_ia"
        self.modelo = "unknown"
        self.meta = {}
        self.status = "success"

    def __enter__(self):
        self.start_time = time.time()
        return self

    def set_usage(self, prompt=0, completion=0, total=0):
        self.usage = {
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "total_tokens": total or (prompt + completion)
        }
    
    def set_model(self, model_name: str):
        self.modelo = model_name

    def set_action(self, action: str):
        self.acao = action

    def add_meta(self, key: str, value: Any):
        self.meta[key] = value

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = int((time.time() - self.start_time) * 1000)
        
        if exc_type:
            self.status = "error"
            self.meta["exception"] = str(exc_val)
            # Re-raise exception after logging? Usually yes for visibility.
            # But the billing must be guaranteed.
        
        # Ensure model is set if we have tokens but no model
        if not self.modelo and self.usage.get("total_tokens", 0) > 0:
            self.modelo = "default"

        self.service.log_consumption(
            user_id=self.user_id,
            request_id=self.request_id,
            acao=self.acao,
            modelo=self.modelo,
            usage=self.usage,
            duracao_ms=duration,
            status=self.status,
            meta=self.meta
        )
