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
    'oi', 'ol├í', 'ola', 'oie', 
    'bom dia', 'boa tarde', 'boa noite',
    'hey', 'opa', 'eai', 'e ai'
]

HELP_MESSAGE_TEMPLATE = """­ƒñû *Assistente de Manejo Org├ónico*

­ƒæñ *Usu├írio:* {nome}
­ƒôï *Plano Ativo:* #{pmo_id}
­ƒ¬Ö *Cr├®ditos Hoje:* {saldo}/{limite}

­ƒôØ *Comandos Dispon├¡veis:*

/saldo - Ver seus cr├®ditos restantes
/planos - Listar seus planos de manejo
/usar <ID> - Trocar plano ativo
/ajuda - Mostrar esta mensagem

­ƒÆ¼ *Como Usar:*
Envie ├íudio ou texto descrevendo:
ÔÇó *Plantio:* "Plantei 50 mudas de tomate no canteiro A"
ÔÇó *Colheita:* "Colhi 20kg de alface hoje"
ÔÇó *Manejo:* "Apliquei calda bordalesa nas plantas"
ÔÇó *D├║vidas:* "Qual a melhor ├®poca para plantar cenoura?"

­ƒÆ░ *Custos:*
ÔÇó ­ƒôØ Texto: 5 cr├®ditos
ÔÇó ­ƒÄñ ├üudio: 15 cr├®ditos (inclui transcri├º├úo)

­ƒî▒ Bom trabalho no campo!"""

class BotOrchestrator:
    """
    Orquestrador central de processamento de mensagens.
    Gerencia fluxo: Autentica├º├úo ÔåÆ Comandos ÔåÆ Quota ÔåÆ IA ÔåÆ Resposta
    """
    def __init__(self):
        self.auth_service = AuthService()
        self.media_service = MediaService()
        self.quota_service = QuotaService()
        self.notifier = get_notification_service()
        logger.info("Ô£à BotOrchestrator initialized")

    def _normalize_command(self, texto: str) -> str:
        """
        Normaliza comandos para compara├º├úo robusta.
        """
        texto = texto.strip().lower()
        
        # Adicionar / se faltar
        if texto in ['saldo', 'planos', 'ajuda', 'help']:
            texto = f"/{texto}"
        
        # Remover espa├ºos ap├│s /
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
        
        # ===== 1. SAUDA├ç├òES =====
        if texto_norm in GREETINGS:
            logger.info(f"­ƒæï Sauda├º├úo detectada de {usuario['nome']}")
            
            self.notifier.send_text(
                reply_to,
                f"­ƒæï Ol├í {usuario['nome']}! Estou pronto no Plano {pmo_id}.\n\n"
                f"Pode enviar sua mensagem de ├íudio ou texto.\n"
                f"­ƒÆí Digite /ajuda para ver comandos dispon├¡veis."
            )
            return {"status": "greeting", "credits_saved": 5}
        
        # ===== 2. SALDO =====
        if texto_norm == '/saldo':
            logger.info(f"­ƒÆ░ Comando /saldo de {usuario['nome']}")
            
            try:
                quota = self.quota_service.check_user_quota(user_id)
                saldo = quota.get('remaining', 0)
                limite = quota.get('limit', 100)
                
                msg = f"""­ƒæï Ol├í {usuario['nome']}!

­ƒ¬Ö *Seu Saldo:* {saldo}/{limite} cr├®ditos hoje

­ƒÆ░ *Custos:*
ÔÇó ­ƒôØ Texto = 5 cr├®ditos
ÔÇó ­ƒÄñ ├üudio = 15 cr├®ditos

­ƒÆí Use /ajuda para ver outros comandos."""
                
                self.notifier.send_text(reply_to, msg)
                return {"status": "balance_sent", "credits_saved": 5}
                
            except Exception as e:
                logger.error(f"ÔØî Erro ao buscar saldo: {e}", exc_info=True)
                self.notifier.send_text(
                    reply_to,
                    "ÔØî Erro ao buscar saldo. Tente novamente em instantes."
                )
                return {"status": "error"}
        
        # ===== 3. LISTAR PLANOS =====
        if texto_norm == '/planos':
            logger.info(f"­ƒôï Comando /planos de {usuario['nome']}")
            
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
                    logger.warning(f"ÔÜá´©Å Usu├írio {user_id} sem planos")
                    self.notifier.send_text(
                        reply_to,
                        "­ƒôï Voc├¬ ainda n├úo tem planos cadastrados.\n\n"
                        "Acesse o site para criar seu primeiro plano:\n"
                        "­ƒöù https://manejo-org-app-v2.vercel.app\n\n"
                        "­ƒÆí ├ë r├ípido e f├ícil!"
                    )
                    return {"status": "no_plans", "credits_saved": 5}
                
                # Construir lista de planos
                msg = "­ƒôï *Seus Planos de Manejo:*\n\n"
                for plan in res.data:
                    # Emoji para indicar plano ativo
                    emoji = "Ô£à" if plan['id'] == pmo_id else "ÔÜ¬"
                    nome = plan.get('nome_identificador', 'Sem Nome')
                    # 'status' field might not exist in this schema version, verify if needed. 
                    # Previous code didn't use it for listing, only 'ativo'.
                    # I'll stick to listing ID and Name.
                    msg += f"{emoji} *{plan['id']}* - {nome}\n"
                
                msg += f"\n­ƒÆí Plano ativo atual: *{pmo_id}*\n"
                msg += "\n­ƒôØ Para trocar, use: `/usar <ID>`"
                
                self.notifier.send_text(reply_to, msg)
                return {"status": "plans_listed", "credits_saved": 5}
                
            except Exception as e:
                logger.error(f"ÔØî Erro ao listar planos: {e}", exc_info=True)
                self.notifier.send_text(
                    reply_to,
                    "ÔØî Erro ao buscar planos. Tente novamente."
                )
                return {"status": "error"}
        
        # ===== 4. TROCAR PLANO ATIVO =====
        if texto_norm.startswith('/usar '):
            logger.info(f"­ƒöä Comando /usar de {usuario['nome']}")
            
            try:
                # Extrair ID do comando
                parts = texto.split()
                if len(parts) < 2:
                    self.notifier.send_text(
                        reply_to,
                        "ÔØî Formato incorreto.\n\n"
                        "Use: `/usar <ID_DO_PLANO>`\n"
                        "Exemplo: `/usar 42`\n\n"
                        "­ƒÆí Use `/planos` para ver IDs dispon├¡veis."
                    )
                    return {"status": "invalid_command_format"}
                
                # Validar convers├úo de ID
                try:
                    novo_pmo_id = int(parts[1])
                except ValueError:
                    self.notifier.send_text(
                        reply_to,
                        "ÔØî ID inv├ílido. Use apenas n├║meros.\n\n"
                        "Exemplo: `/usar 42`"
                    )
                    return {"status": "invalid_id_format"}
                
                # SECURITY: Verificar se o PMO pertence ao usu├írio
                with get_supabase_client() as supabase:
                    res = supabase.table("pmos") \
                        .select("id, nome_identificador") \
                        .eq("id", novo_pmo_id) \
                        .eq("user_id", user_id) \
                        .execute()
                
                if not res.data:
                    logger.warning(
                        f"­ƒÜ¿ SECURITY: Usu├írio {user_id} tentou acessar PMO {novo_pmo_id}"
                    )
                    self.notifier.send_text(
                        reply_to,
                        f"ÔØî Plano #{novo_pmo_id} n├úo encontrado ou n├úo pertence a voc├¬.\n\n"
                        f"Use `/planos` para ver seus planos dispon├¡veis."
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
                    f"Ô£à PMO alterado: user={user_id}, "
                    f"old_pmo={pmo_id}, new_pmo={novo_pmo_id}"
                )
                
                self.notifier.send_text(
                    reply_to,
                    f"Ô£à Plano ativo alterado com sucesso!\n\n"
                    f"­ƒôï Agora usando: *{nome_plano}* (ID: {novo_pmo_id})\n\n"
                    f"­ƒî▒ Pode come├ºar a registrar atividades!"
                )
                return {"status": "pmo_switched", "new_pmo_id": novo_pmo_id}
                
            except ValueError:
                self.notifier.send_text(reply_to, "ÔØî ID inv├ílido.")
                return {"status": "invalid_id"}
            except Exception as e:
                logger.error(f"ÔØî Erro ao trocar plano: {e}", exc_info=True)
                self.notifier.send_text(
                    reply_to,
                    "ÔØî Erro ao trocar plano. Tente novamente."
                )
                return {"status": "error"}
        
        # ===== 5. AJUDA =====
        if texto_norm in ['/ajuda', '/help']:
            logger.info(f"ÔØô Comando /ajuda de {usuario['nome']}")
            
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
                logger.error(f"ÔØî Erro ao enviar ajuda: {e}", exc_info=True)
                # Enviar mensagem simplificada em caso de erro
                self.notifier.send_text(
                    reply_to,
                    "­ƒñû *Comandos Dispon├¡veis:*\n\n"
                    "/saldo - Ver cr├®ditos\n"
                    "/planos - Listar planos\n"
                    "/usar <ID> - Trocar plano\n"
                    "/ajuda - Esta mensagem"
                )
                return {"status": "help_sent_fallback"}
        
        # ===== N├âO ├ë COMANDO DE SISTEMA =====
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
             logger.info(f"­ƒÜ½ Ignorando broadcast/status: {sender_check}")
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
                logger.info(f"­ƒöÇ LID Redirect: {sender} -> {resolved_phone}")
                sender = resolved_phone 
        
        user = self.auth_service.get_user_by_phone(sender)
        
        # B. LID Migration
        if not user and ('@lid' in original_sender or '@lid' in sender):
             target_lid = original_sender if '@lid' in original_sender else sender
             if '@c.us' in sender:
                  migrated_user = self.auth_service.migrate_lid_to_phone(target_lid, sender)
                  if migrated_user:
                       logger.info(f"Ô£à Migra├º├úo bem sucedida! Usu├írio recuperado: {migrated_user['nome']}")
                       user = migrated_user
        
        # 3. Pairing Flow (if no user)
        if not user:
            pairing_res = self.auth_service.handle_pairing(original_sender, text, reply_to_id=reply_to)
            status = pairing_res.get("status")
            if status in ["linked", "collision", "invalid_code", "error"]:
                return pairing_res
            
            # Not a pairing attempt, send Unknown User message
            logger.info(f"­ƒæñ Novo usu├írio detectado: {sender} (original: {original_sender}) ÔÇö enviando instru├º├Áes de cadastro")
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
                logger.info(f"Ô£à Comando interceptado: {command_result['status']} (economizou {command_result.get('credits_saved', 0)} cr├®ditos)")
                return command_result

        # 5. Quota Check
        cost = 15 if is_audio else 5
        quota = self.quota_service.check_user_quota(user['id'], cost)
        
        if not quota["allowed"]:
            msg_limite = quota["message"] or "ÔÜá´©Å Limite di├írio atingido."
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
                         self.notifier.send_text(reply_to, "­ƒÿô N├úo consegui entender o ├íudio. Tente falar mais perto do microfone.")
                         return {"status": "audio_transcription_failed"}
                         
                    # Check commands AFTER transcription (optional, but incurs cost/fair)
                    cmd_res = self._handle_system_commands(text, user, pmo_id, reply_to)
                    if cmd_res:
                        return cmd_res

                except Exception as e_audio:
                    logger.error(f"Audio error: {e_audio}", exc_info=True)
                    self.notifier.send_text(reply_to, "ÔØî Erro ao baixar ou transcrever ├íudio.")
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
                    
                    agent_msg = result_ia.get("message", "Ô£à A├º├úo conclu├¡da.")
                    
                    # Detect if the graph swallowed an error from the specialist wrapper
                    if isinstance(agent_msg, str) and (agent_msg.startswith("Erro assistente t├®cnico") or agent_msg.startswith("Erro ao consultar especialista")):
                        self.notifier.send_text(reply_to, agent_msg)
                        logger.warning(f"ÔÜá´©Å Specialist Node Error sent to user: {agent_msg}")
                    else:
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
                    msg = result_ia.get("message", "A├º├úo bloqueada.")
                    self.notifier.send_text(reply_to, f"Ôøö {msg}")
                
                elif status_ia == "inquiry":
                    self.notifier.send_text(reply_to, result_ia.get("message"))
                
                elif status_ia == "error":
                    self.notifier.send_text(reply_to, "ÔØî Erro ao processar sua solicita├º├úo.")
                
            except Exception as e_ai:
                logger.error(f"AI Error: {e_ai}", exc_info=True)
                self.notifier.send_text(reply_to, "ÔØî Erro interno na IA.")
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
        msg = f"­ƒôØ Registro Processado | User: {user['nome']} | Atividade: {tipo}"
        
        prod = data.get("produto")
        if prod: msg += f" | Produto: {prod}"
        
        qtd = data.get("quantidade_valor")
        if qtd: msg += f" | Qtd: {qtd} {data.get('quantidade_unidade','')}"
        
        # Balance
        new_quota = self.quota_service.check_user_quota(user['id'])
        msg += f" | Saldo: {new_quota.get('remaining')}"
        
        logger.info(msg)
        
        if data.get("alerta_conformidade"):
             logger.warning(f"ÔÜá´©Å Alerta Compliance: {data.get('alerta_conformidade')}")
