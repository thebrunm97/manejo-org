"""
services/auth_service.py - Authentication and User Identity Service
"""
import logging
from typing import Optional, Dict, Any

from modules.database import get_supabase_client
from modules.lid_manager import LIDManager
from services import get_notification_service
from config.constants import WELCOME_MESSAGE, HELP_MESSAGE

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self):
        self.lid_manager = LIDManager()

    def resolve_lid_to_phone(self, lid_or_phone: str) -> str:
        """
        Resolve LID para número de telefone usando LIDManager ou API WPPConnect.
        Delega ao whatsapp_client.resolve_lid_to_phone() que usa a rota correta
        (GET /api/{session}/contact/{lid}) com Bearer auth.
        """
        try:
            # Se já for c.us, retornar direto
            if '@c.us' in lid_or_phone:
                return lid_or_phone
            
            # Se for @lid, tentar resolver
            if '@lid' in lid_or_phone:
                logger.info(f"🔄 AuthService: Resolvendo LID: {lid_or_phone}")
                
                lid_number = lid_or_phone.split('@')[0]
                
                # 1. Cache/DB Local (LIDManager)
                try:
                    real_phone = self.lid_manager.get_real_phone(lid_number)
                    if real_phone:
                        logger.info(f"✅ AuthService: LID resolvido (Cache/DB): {lid_or_phone} → {real_phone}@c.us")
                        return f"{real_phone}@c.us"
                except Exception as e:
                    logger.warning(f"⚠️ AuthService: Erro LIDManager: {e}")
                
                # 2. API WPPConnect via whatsapp_client (rota correta com Bearer auth)
                try:
                    from modules.whatsapp_client import resolve_lid_to_phone as wpp_resolve
                    result = wpp_resolve(lid_or_phone)
                    
                    if result.success and result.data:
                        resolved_phone = result.data.get("phone", "")
                        if resolved_phone:
                            clean_phone = resolved_phone.split('@')[0]
                            logger.info(f"✅ AuthService: LID resolvido (API WPP): {lid_or_phone} → {resolved_phone}")
                            # Atualizar Cache/DB para futuras consultas
                            self.lid_manager.set_mapping(lid_number, clean_phone, "Auto-resolved", "auth_service")
                            return resolved_phone if '@' in resolved_phone else f"{resolved_phone}@c.us"
                    else:
                        logger.warning(f"⚠️ AuthService: API WPP não resolveu LID: {result.error_message if hasattr(result, 'error_message') else 'sem dados'}")
                except Exception as e:
                    logger.error(f"❌ AuthService: Erro API WPP resolve_lid: {e}")
                
                # 3. Fallback final: retornar como se fosse phone
                logger.warning(f"⚠️ AuthService: LID não resolvido. Usando fallback: {lid_number}")
                return f"{lid_number}@c.us"
            
            # Não é LID nem c.us
            return f"{lid_or_phone}@c.us"

        except Exception as e:
            logger.error(f"❌ AuthService: Erro fatal resolve_lid: {e}", exc_info=True)
            return f"{lid_or_phone.split('@')[0]}@c.us"

    def get_user_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        """Busca usuário no Supabase pelo telefone (c.us ou número limpo)."""
        clean_phone = phone.split('@')[0] if '@' in phone else phone
        
        try:
            logger.debug(f"🔎 AuthService: Buscando user no DB: {clean_phone} (Orig: {phone})")
            
            with get_supabase_client() as supabase:
                res = supabase.table("profiles").select("id, nome, pmo_ativo_id, telefone, codigo_vinculo").eq("telefone", clean_phone).execute()
            
            if res.data and len(res.data) > 0:
                logger.debug(f"✅ User Found: {res.data[0].get('nome')} | ID: {res.data[0].get('id')}")
                return res.data[0]
            
            logger.info(f"🚫 AuthService: Nenhum usuário encontrado para {clean_phone}")
            return None
        except Exception as e:
            logger.error(f"❌ AuthService: Erro busca user: {e}", exc_info=True)
            return None
            
    def migrate_lid_to_phone(self, lid_id: str, real_phone: str) -> Optional[Dict[str, Any]]:
        """Se usuário existe com LID, atualiza para telefone real."""
        # Tenta buscar pelo LID antigo
        user_lid = self.get_user_by_phone(lid_id)
        if user_lid:
            clean_real = real_phone.split('@')[0]
            logger.info(f"🔄 Migrando usuário {user_lid['nome']} de {lid_id} para {clean_real}")
            try:
                with get_supabase_client() as supabase:
                    supabase.table("profiles").update({"telefone": clean_real}).eq("id", user_lid['id']).execute()
                # Retorna usuário atualizado
                user_lid['telefone'] = clean_real
                return user_lid
            except Exception as e:
                logger.error(f"❌ Erro migração LID: {e}")
                return user_lid # Retorna o antigo mesmo em erro para não bloquear
        return None

    def handle_pairing(self, phone: str, text: str, reply_to_id: str = None) -> Dict[str, str]:
        """
        Processa tentativa de pareamento (CONECTAR XXXXXX).
        Retorna status: linked, collision, invalid_code, no_action
        Envias mensagens de feedback.
        """
        cmd = text.upper().strip()
        code = None
        
        # Parse Code
        if len(cmd) == 6 and cmd.isalnum():
            code = cmd
        elif cmd.startswith("CONECTAR") or cmd.startswith("CONNECT"):
            parts = cmd.split()
            if len(parts) >= 2 and len(parts[1]) == 6:
                code = parts[1]
        
        if not code:
            return {"status": "no_action"}

        # Logic
        logger.info(f"🔑 AuthService: Tentativa de vínculo com código {code} para {phone}")
        notifier = get_notification_service()
        dest = reply_to_id or phone
        clean_phone = phone.split('@')[0]

        try:
            # 1. Check collision
            if self.get_user_by_phone(clean_phone):
                notifier.send_text(dest, "⚠️ Este número já está cadastrado. Entre em contato com o suporte.")
                return {"status": "collision"}

            # 2. Find code
            with get_supabase_client() as supabase:
                 res = supabase.table("profiles").select("id, nome").eq("codigo_vinculo", code).execute()
            
            if res.data:
                user = res.data[0]
                # 3. Link
                with get_supabase_client() as supabase:
                     supabase.table("profiles").update({
                        "telefone": clean_phone,
                        "codigo_vinculo": None
                     }).eq("id", user['id']).execute()
                
                # 4. Learn LID if applicable
                if '@lid' in dest:
                    # If we replied to a LID, map it to the phone we just saved
                    self.lid_manager.set_mapping(dest, clean_phone, user['nome'], "pairing_code")

                # 5. Welcome
                notifier.send_text(dest, f"✅ Identificado: {user['nome']}\n" + WELCOME_MESSAGE)
                time.sleep(1)
                notifier.send_text(dest, HELP_MESSAGE)
                
                return {"status": "linked", "user_id": user['id']}
            else:
                notifier.send_text(dest, "❌ Código inválido ou expirado.\nVerifique o código no dashboard web e tente novamente.")
                return {"status": "invalid_code"}

        except Exception as e:
            logger.error(f"❌ AuthService: Erro ao vincular: {e}")
            notifier.send_text(dest, "❌ Erro interno ao processar. Tente novamente.")
            return {"status": "error"}
