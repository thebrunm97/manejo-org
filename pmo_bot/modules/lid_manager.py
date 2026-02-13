"""
modules/lid_manager.py - Gerenciador de LIDs com Cache e Persistência no Supabase
"""

import logging
import time
import re
import os
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()
from modules.database import get_supabase_client

logger = logging.getLogger(__name__)

class LIDManager:
    _instance = None
    _cache: Dict[str, Dict[str, Any]] = {}
    _cache_ttl = 300  # 5 minutos (em segundos)
    
    def __new__(cls, supabase_client=None):
        if cls._instance is None:
            cls._instance = super(LIDManager, cls).__new__(cls)
            # Remove direct supabase client injection to enforce thread-safety
            # if supabase_client: ...
            
            # Inicializa cache
            cls._instance._cache = {} 
            logger.info("✅ LIDManager inicializado (Thread-Safe Mode).")
        return cls._instance
        
    def _clean_lid(self, lid: str) -> str:
        """Remove sufixos para padronizar ID de busca."""
        if not lid: return ""
        return lid.split('@')[0].strip()

    def _is_cache_valid(self, lid_key: str) -> bool:
        """Verifica se cache para este LID ainda é válido."""
        if lid_key not in self._cache:
            return False
            
        entry = self._cache[lid_key]
        expiry = entry.get('expiry')
        
        if time.time() > expiry:
            del self._cache[lid_key]
            return False
            
        return True

    def get_real_phone(self, lid: str) -> Optional[str]:
        """
        Busca o telefone real associado a um LID.
        1. Cache (Memória)
        2. Database (Supabase)
        """
        lid_key = self._clean_lid(lid)
        if not lid_key:
            return None
            
        # 1. Verificar Cache
        if self._is_cache_valid(lid_key):
            cached_phone = self._cache[lid_key].get('phone')
            # logger.debug(f"🔍 [CACHE] LID encontrado: {lid_key} -> {cached_phone}")
            return cached_phone
            
        # 2. Buscar no Supabase
        try:
            with get_supabase_client() as supabase:
                res = supabase.table('lid_mappings').select('phone_number').eq('lid_id', lid_key).execute()
            
            if res.data and len(res.data) > 0:
                phone = res.data[0].get('phone_number')
                
                # Atualizar Cache
                self._cache[lid_key] = {
                    'phone': phone,
                    'expiry': time.time() + self._cache_ttl
                }
                
                logger.info(f"✅ [DB] LID mapeado: {lid_key} -> {phone}")
                return phone
            
            else:
                # Cache negativo (evitar flood no banco para ID inexistente) - TTL menor (1 min)
                self._cache[lid_key] = {
                    'phone': None,
                    'expiry': time.time() + 60
                }
                logger.warning(f"⚠️ [DB] LID não encontrado: {lid_key}")
                return None
                
        except Exception as e:
            logger.error(f"❌ Erro ao buscar LID no Supabase: {e}")
            return None

    def set_mapping(self, lid: str, real_phone: str, user_name: str = None, registered_by: str = 'system') -> bool:
        """
        Registra ou atualiza um mapeamento de LID.
        """
        lid_key = self._clean_lid(lid)
        phone_key = self._clean_lid(real_phone) # Remove @c.us também
        
        if not lid_key or not phone_key:
            logger.error("❌ LID ou Telefone inválidos.")
            return False
            
        # Validação básica de telefone (apenas números, 10-15 dígitos)
        # Ex: 5511999999999 (13) ou 201005505663 (12)
        if not re.match(r'^\d{10,15}$', phone_key):
             logger.warning(f"⚠️ Formato de telefone suspeito: {phone_key}")

        payload = {
            "lid_id": lid_key,
            "phone_number": phone_key,
            "user_name": user_name,
            "registered_by": registered_by,
            "updated_at": datetime.now().isoformat()
        }

        try:
            with get_supabase_client() as supabase:
                res = supabase.table('lid_mappings').upsert(payload, on_conflict='lid_id').execute()
            
            # Se sucesso, atualizar cache imediatamente
            self._cache[lid_key] = {
                'phone': phone_key,
                'expiry': time.time() + self._cache_ttl
            }
            logger.info(f"✅ Mapeamento salvo: {lid_key} -> {phone_key} ({user_name})")
            return True
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar mapeamento LID: {e}")
            return False

    def list_all_mappings(self) -> List[Dict[str, Any]]:
        """Lista todos os mapeamentos cadastrados."""
        try:
            with get_supabase_client() as supabase:
                res = supabase.table('lid_mappings').select('*').order('created_at', desc=True).limit(100).execute()
            return res.data or []
        except Exception as e:
            logger.error(f"❌ Erro ao listar mapeamentos: {e}")
            return []

    def clear_cache(self):
        """Limpa o cache em memória."""
        self._cache.clear()
        logger.info("🧹 Cache LID limpo.")

    def delete_mapping(self, lid: str) -> bool:
        """Remove um mapeamento."""
        lid_key = self._clean_lid(lid)
        try:
            with get_supabase_client() as supabase:
                supabase.table('lid_mappings').delete().eq('lid_id', lid_key).execute()
            if lid_key in self._cache:
                del self._cache[lid_key]
            logger.info(f"🗑️ Mapeamento removido: {lid_key}")
            return True
        except Exception as e:
            logger.error(f"❌ Erro ao deletar mapeamento: {e}")
            return False
