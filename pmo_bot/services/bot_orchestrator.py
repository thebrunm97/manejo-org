"""
services/bot_orchestrator.py - Central Message Processing Logic
"""
import logging
import uuid
from typing import Optional


# Services
from services.auth_service import AuthService
from services.quota_service import BillingContext, QuotaService
from services.media_service import MediaService
from services import get_notification_service
from config.constants import HELP_MESSAGE, WELCOME_MESSAGE, UNKNOWN_USER_MESSAGE

# Modules
from modules.agent_graph import invoke_agent
from modules.database import get_supabase_client
from modules.database_handlers import salvar_log_treinamento

# Constants/Models
try:
    from models.whatsapp import WhatsAppInboundMessage
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False
    WhatsAppInboundMessage = None

logger = logging.getLogger(__name__)

# ===== CONSTANTES =====
GREETINGS = [
    'oi', 'olá', 'ola', 'oie', 
    'bom dia', 'boa tarde', 'boa noite',
    'hey', 'opa', 'eai', 'e ai'
]

HELP_MESSAGE_TEMPLATE = """🤖 *Assistente de Manejo Orgânico*

👤 *Usuário:* {nome}
📋 *Plano Ativo:* #{pmo_id}
🪙 *Créditos Hoje:* {saldo}/{limite}

📝 *Comandos Disponíveis:*

/saldo - Ver seus créditos restantes
/planos - Listar seus planos de manejo
/usar <ID> - Trocar plano ativo
/ajuda - Mostrar esta mensagem

💬 *Como Usar:*
Envie áudio ou texto descrevendo:
• *Plantio:* "Plantei 50 mudas de tomate no canteiro A"
• *Colheita:* "Colhi 20kg de alface hoje"
• *Manejo:* "Apliquei calda bordalesa nas plantas"
• *Dúvidas:* "Qual a melhor época para plantar cenoura?"

💰 *Custos:*
• 📝 Texto: 5 créditos
• 🎤 Áudio: 15 créditos (inclui transcrição)

🌱 Bom trabalho no campo!"""

class BotOrchestrator:
    """
    Orquestrador central de processamento de mensagens.
    Gerencia fluxo: Autenticação → Comandos → Quota → IA → Resposta
    """
    def __init__(self):
        self.auth_service = AuthService()
        self.media_service = MediaService()
        self.quota_service = QuotaService()
        self.notifier = get_notification_service()
        logger.info("✅ BotOrchestrator initialized")

    def _normalize_command(self, texto: str) -> str:
        """
        Normaliza comandos para comparação robusta.
        """
        texto = texto.strip().lower()
        
        # Adicionar / se faltar
        if texto in ['saldo', 'planos', 'ajuda', 'help']:
            texto = f"/{texto}"
        
        # Remover espaços após /
        if texto.startswith('/'):
            texto = '/' + texto[1:].strip()
        
        return texto

    def _handle_system_commands(
        self,
        texto: str,
        usuario: dict,
        pmo_id: int,
        reply_to: str
    ) -> Optional[dict]:
        """
        Intercepta comandos de sistema ANTES de processar com IA.
        """
        texto_norm = self._normalize_command(texto)
        user_id = usuario['id']
        
        # ===== 1. SAUDAÇÕES =====
        if texto_norm in GREETINGS:
            logger.info(f"👋 Saudação detectada de {usuario['nome']}")
            
            self.notifier.send_text(
                reply_to,
                f"👋 Olá {usuario['nome']}! Estou pronto no Plano {pmo_id}.\n\n"
                f"Pode enviar sua mensagem de áudio ou texto.\n"
                f"💡 Digite /ajuda para ver comandos disponíveis."
            )
            return {"status": "greeting", "credits_saved": 5}
        
        # ===== 2. SALDO =====
        if texto_norm == '/saldo':
            logger.info(f"💰 Comando /saldo de {usuario['nome']}")
            
            try:
                quota = self.quota_service.check_user_quota(user_id)
                saldo = quota.get('remaining', 0)
                limite = quota.get('limit', 100)
                
                msg = f"""👋 Olá {usuario['nome']}!

🪙 *Seu Saldo:* {saldo}/{limite} créditos hoje

💰 *Custos:*
• 📝 Texto = 5 créditos
• 🎤 Áudio = 15 créditos

💡 Use /ajuda para ver outros comandos."""
                
                self.notifier.send_text(reply_to, msg)
                return {"status": "balance_sent", "credits_saved": 5}
                
            except Exception as e:
                logger.error(f"❌ Erro ao buscar saldo: {e}", exc_info=True)
                self.notifier.send_text(
                    reply_to,
                    "❌ Erro ao buscar saldo. Tente novamente em instantes."
                )
                return {"status": "error"}
        
        # ===== 3. LISTAR PLANOS =====
        if texto_norm == '/planos':
            logger.info(f"📋 Comando /planos de {usuario['nome']}")
            
            try:
                with get_supabase_client() as supabase:
                    # Using 'pmos' table and 'nome_identificador'
                    res = supabase.table("pmos") \
                        .select("id, nome_identificador") \
                        .eq("user_id", user_id) \
                        .order("id", desc=False) \
                        .execute()
                
                # Caso: Sem planos cadastrados
                if not res.data:
                    logger.warning(f"⚠️ Usuário {user_id} sem planos")
                    self.notifier.send_text(
                        reply_to,
                        "📋 Você ainda não tem planos cadastrados.\n\n"
                        "Acesse o site para criar seu primeiro plano:\n"
                        "🔗 https://manejo-org-app-v2.vercel.app\n\n"
                        "💡 É rápido e fácil!"
                    )
                    return {"status": "no_plans", "credits_saved": 5}
                
                # Construir lista de planos
                msg = "📋 *Seus Planos de Manejo:*\n\n"
                for plan in res.data:
                    # Emoji para indicar plano ativo
                    emoji = "✅" if plan['id'] == pmo_id else "⚪"
                    nome = plan.get('nome_identificador', 'Sem Nome')
                    # 'status' field might not exist in this schema version, verify if needed. 
                    # Previous code didn't use it for listing, only 'ativo'.
                    # I'll stick to listing ID and Name.
                    msg += f"{emoji} *{plan['id']}* - {nome}\n"
                
                msg += f"\n💡 Plano ativo atual: *{pmo_id}*\n"
                msg += "\n📝 Para trocar, use: `/usar <ID>`"
                
                self.notifier.send_text(reply_to, msg)
                return {"status": "plans_listed", "credits_saved": 5}
                
            except Exception as e:
                logger.error(f"❌ Erro ao listar planos: {e}", exc_info=True)
                self.notifier.send_text(
                    reply_to,
                    "❌ Erro ao buscar planos. Tente novamente."
                )
                return {"status": "error"}
        
        # ===== 4. TROCAR PLANO ATIVO =====
        if texto_norm.startswith('/usar '):
            logger.info(f"🔄 Comando /usar de {usuario['nome']}")
            
            try:
                # Extrair ID do comando
                parts = texto.split()
                if len(parts) < 2:
                    self.notifier.send_text(
                        reply_to,
                        "❌ Formato incorreto.\n\n"
                        "Use: `/usar <ID_DO_PLANO>`\n"
                        "Exemplo: `/usar 42`\n\n"
                        "💡 Use `/planos` para ver IDs disponíveis."
                    )
                    return {"status": "invalid_command_format"}
                
                # Validar conversão de ID
                try:
                    novo_pmo_id = int(parts[1])
                except ValueError:
                    self.notifier.send_text(
                        reply_to,
                        "❌ ID inválido. Use apenas números.\n\n"
                        "Exemplo: `/usar 42`"
                    )
                    return {"status": "invalid_id_format"}
                
                # SECURITY: Verificar se o PMO pertence ao usuário
                with get_supabase_client() as supabase:
                    res = supabase.table("pmos") \
                        .select("id, nome_identificador") \
                        .eq("id", novo_pmo_id) \
                        .eq("user_id", user_id) \
                        .execute()
                
                if not res.data:
                    logger.warning(
                        f"🚨 SECURITY: Usuário {user_id} tentou acessar PMO {novo_pmo_id}"
                    )
                    self.notifier.send_text(
                        reply_to,
                        f"❌ Plano #{novo_pmo_id} não encontrado ou não pertence a você.\n\n"
                        f"Use `/planos` para ver seus planos disponíveis."
                    )
                    return {"status": "unauthorized_pmo_access"}
                
                plano = res.data[0]
                nome_plano = plano.get('nome_identificador')
                
                # Atualizar plano ativo no perfil
                with get_supabase_client() as supabase:
                    supabase.table("profiles") \
                        .update({"pmo_ativo_id": novo_pmo_id}) \
                        .eq("id", user_id) \
                        .execute()
                
                logger.info(
                    f"✅ PMO alterado: user={user_id}, "
                    f"old_pmo={pmo_id}, new_pmo={novo_pmo_id}"
                )
                
                self.notifier.send_text(
                    reply_to,
                    f"✅ Plano ativo alterado com sucesso!\n\n"
                    f"📋 Agora usando: *{nome_plano}* (ID: {novo_pmo_id})\n\n"
                    f"🌱 Pode começar a registrar atividades!"
                )
                return {"status": "pmo_switched", "new_pmo_id": novo_pmo_id}
                
            except ValueError:
                self.notifier.send_text(reply_to, "❌ ID inválido.")
                return {"status": "invalid_id"}
            except Exception as e:
                logger.error(f"❌ Erro ao trocar plano: {e}", exc_info=True)
                self.notifier.send_text(
                    reply_to,
                    "❌ Erro ao trocar plano. Tente novamente."
                )
                return {"status": "error"}
        
        # ===== 5. AJUDA =====
        if texto_norm in ['/ajuda', '/help']:
            logger.info(f"❓ Comando /ajuda de {usuario['nome']}")
            
            try:
                # Buscar saldo atual para contexto
                quota = self.quota_service.check_user_quota(user_id)
                saldo = quota.get('remaining', 0)
                limite = quota.get('limit', 100)
                
                msg = HELP_MESSAGE_TEMPLATE.format(
                    nome=usuario['nome'],
                    pmo_id=pmo_id,
                    saldo=saldo,
                    limite=limite
                )
                
                self.notifier.send_text(reply_to, msg)
                return {"status": "help_sent", "credits_saved": 5}
                
            except Exception as e:
                logger.error(f"❌ Erro ao enviar ajuda: {e}", exc_info=True)
                # Enviar mensagem simplificada em caso de erro
                self.notifier.send_text(
                    reply_to,
                    "🤖 *Comandos Disponíveis:*\n\n"
                    "/saldo - Ver créditos\n"
                    "/planos - Listar planos\n"
                    "/usar <ID> - Trocar plano\n"
                    "/ajuda - Esta mensagem"
                )
                return {"status": "help_sent_fallback"}
        
        # ===== NÃO É COMANDO DE SISTEMA =====
        return None

    async def process_payload(self, raw_data: dict, request_id: str = None) -> dict:
        """
        Main logic pipeline.
        Replaces webhook.py:process_message_payload.
        """
        if not request_id:
            request_id = str(uuid.uuid4())[:8]

        # 0. BROADCAST FILTER (Critical)
        # Checking for Status/Broadcast messages early to avoid processing
        sender_check = raw_data.get("from", "")
        if "status@broadcast" in sender_check or "120363422368969999" in sender_check or sender_check.endswith("@broadcast"):
             logger.info(f"🚫 Ignorando broadcast/status: {sender_check}")
             return {"status": "ignored_broadcast"}

        # 1. Validation & Filtering
        if not self._should_process(raw_data):
             return {"status": "ignored"}

        # Validate Pydantic
        msg = None
        if HAS_PYDANTIC:
            try:
                msg = WhatsAppInboundMessage.model_validate(raw_data)
            except Exception as e:
                logger.warning(f"[{request_id}] Invalid payload: {e}")
                return {"status": "invalid_schema", "error": str(e)}
        
        if not msg:
             return {"status": "validation_failed"}

        sender = msg.sender_phone
        reply_to = msg.reply_to_id
        text = msg.body.strip()
        is_audio = (msg.type == 'ptt' or msg.type == 'audio')

        # 2. Auth & User Identity
        original_sender = sender
        
        # A. LID Auto-Discovery
        if '@lid' in sender:
            resolved_phone = self.auth_service.resolve_lid_to_phone(sender)
            if resolved_phone and resolved_phone != sender:
                logger.info(f"🔀 LID Redirect: {sender} -> {resolved_phone}")
                sender = resolved_phone 
        
        user = self.auth_service.get_user_by_phone(sender)
        
        # B. LID Migration
        if not user and ('@lid' in original_sender or '@lid' in sender):
             target_lid = original_sender if '@lid' in original_sender else sender
             if '@c.us' in sender:
                  migrated_user = self.auth_service.migrate_lid_to_phone(target_lid, sender)
                  if migrated_user:
                       logger.info(f"✅ Migração bem sucedida! Usuário recuperado: {migrated_user['nome']}")
                       user = migrated_user
        
        # 3. Pairing Flow (if no user)
        if not user:
            pairing_res = self.auth_service.handle_pairing(original_sender, text, reply_to_id=reply_to)
            status = pairing_res.get("status")
            if status in ["linked", "collision", "invalid_code", "error"]:
                return pairing_res
            
            # Not a pairing attempt, send Unknown User message
            logger.info(f"👤 Novo usuário detectado: {sender} (original: {original_sender}) — enviando instruções de cadastro")
            self.notifier.send_text(reply_to, UNKNOWN_USER_MESSAGE)
            return {"status": "new_user_onboarding"}

        # ===== 4. SYSTEM COMMANDS INTERCEPTOR (BEFORE Quota & AI) =====
        # We handle commands here to avoid costs.
        # Ensure pmo_ativo_id is present
        pmo_id = user.get('pmo_ativo_id', 0)
        
        # Only check commands for text messages
        if not is_audio:
            command_result = self._handle_system_commands(text, user, pmo_id, reply_to)
            if command_result:
                # Log success
                logger.info(f"✅ Comando interceptado: {command_result['status']} (economizou {command_result.get('credits_saved', 0)} créditos)")
                return command_result

        # 5. Quota Check
        cost = 15 if is_audio else 5
        quota = self.quota_service.check_user_quota(user['id'], cost)
        
        if not quota["allowed"]:
            msg_limite = quota["message"] or "⚠️ Limite diário atingido."
            self.notifier.send_text(reply_to, msg_limite)
            return {"status": "quota_exceeded"}

        # 6. Billing Context & Execution
        with BillingContext(user_id=user['id'], request_id=request_id, service=self.quota_service) as billing:
            billing.set_action("processamento_ia")
            
            # A. Audio Processing
            audio_url = None
            if is_audio:
                try:
                    res_audio = self.media_service.process_audio_message(msg.id, user['id'], pmo_id)
                    text = res_audio["text"]
                    audio_url = res_audio["url"]
                    billing.add_meta("audio_seconds", res_audio["duration"])
                    
                    if not text:
                         self.notifier.send_text(reply_to, "😓 Não consegui entender o áudio. Tente falar mais perto do microfone.")
                         return {"status": "audio_transcription_failed"}
                         
                    # Check commands AFTER transcription (optional, but incurs cost/fair)
                    cmd_res = self._handle_system_commands(text, user, pmo_id, reply_to)
                    if cmd_res:
                        return cmd_res

                except Exception as e_audio:
                    logger.error(f"Audio error: {e_audio}", exc_info=True)
                    self.notifier.send_text(reply_to, "❌ Erro ao baixar ou transcrever áudio.")
                    return {"status": "audio_error"}

            # B. AI Execution (LangGraph)
            try:
                billing.set_model("llama-3.3-70b-versatile") 
                
                result_ia = await invoke_agent(
                    texto_usuario=text,
                    user_id=user['id'],
                    thread_id=sender, 
                    pmo_id=user.get('pmo_ativo_id')
                )
                
                status_ia = result_ia.get("status")

                # Extract Usage from Graph Result
                usage_data = result_ia.get("usage", {})
                billing.set_usage(
                     prompt=usage_data.get("prompt_tokens", 0),
                     completion=usage_data.get("completion_tokens", 0)
                )

                if status_ia == "success":
                    data = result_ia.get("data", {})
                    if audio_url:
                        data["audio_url"] = audio_url
                    
                    agent_msg = result_ia.get("message", "✅ Ação concluída.")
                    self.notifier.send_text(reply_to, agent_msg)
                    
                    self._log_confirmation(data, user)
                    
                    billing.set_action(data.get("tipo_atividade", "ia_success"))

                    # Save Training Log (Dashboard Feed)
                    salvar_log_treinamento(
                        texto_usuario=text,
                        json_extraido=data,
                        tipo_atividade=data.get("tipo_atividade", "Desconhecido"),
                        user_id=user['id'],
                        pmo_id=user.get('pmo_ativo_id'),
                        modelo_ia="llama-3.3-70b-versatile"
                    )

                elif status_ia == "blocked":
                    msg = result_ia.get("message", "Ação bloqueada.")
                    self.notifier.send_text(reply_to, f"⛔ {msg}")
                
                elif status_ia == "inquiry":
                    self.notifier.send_text(reply_to, result_ia.get("message"))
                
                elif status_ia == "error":
                    self.notifier.send_text(reply_to, "❌ Erro ao processar sua solicitação.")
                
            except Exception as e_ai:
                logger.error(f"AI Error: {e_ai}", exc_info=True)
                self.notifier.send_text(reply_to, "❌ Erro interno na IA.")
                billing.status = "error"
                raise e_ai
                
        return {"status": "success"}

    def _should_process(self, raw_data: dict) -> bool:
        if not raw_data: return False
        evt = raw_data.get('event')
        if evt and evt != 'onmessage': return False
        if raw_data.get('fromMe'): return False
        if 'status@broadcast' in raw_data.get('from', ''): return False
        return True

    def _log_confirmation(self, data: dict, user: dict):
        """
        Logs the transaction details instead of sending to user (V2).
        """
        tipo = data.get("tipo_atividade")
        msg = f"📝 Registro Processado | User: {user['nome']} | Atividade: {tipo}"
        
        prod = data.get("produto")
        if prod: msg += f" | Produto: {prod}"
        
        qtd = data.get("quantidade_valor")
        if qtd: msg += f" | Qtd: {qtd} {data.get('quantidade_unidade','')}"
        
        # Balance
        new_quota = self.quota_service.check_user_quota(user['id'])
        msg += f" | Saldo: {new_quota.get('remaining')}"
        
        logger.info(msg)
        
        if data.get("alerta_conformidade"):
             logger.warning(f"⚠️ Alerta Compliance: {data.get('alerta_conformidade')}")
