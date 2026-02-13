"""
📱 WhatsApp Client Module
Centraliza todas as chamadas HTTP ao WPPConnect Server.

Uso:
    from modules.whatsapp_client import send_text, download_media, check_connection
    
    result = send_text("5511999999999@c.us", "Olá!")
    if result.success:
        print("Mensagem enviada!")
"""

import os
import base64
import requests
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Carrega variáveis de ambiente
load_dotenv()


# --- 📦 DATACLASS DE RESPOSTA ---

@dataclass
class WppResponse:
    """Resposta padronizada do cliente WPPConnect"""
    success: bool
    data: Optional[Dict[str, Any]] = field(default=None)
    error_code: Optional[str] = None  # "TIMEOUT", "AUTH_ERROR", "SERVER_ERROR", "NETWORK_ERROR"
    error_message: Optional[str] = None
    
    @classmethod
    def ok(cls, data: Optional[Dict[str, Any]] = None) -> "WppResponse":
        """Factory para resposta de sucesso"""
        return cls(success=True, data=data)
    
    @classmethod
    def fail(cls, error_code: str, error_message: str) -> "WppResponse":
        """Factory para resposta de erro"""
        return cls(success=False, error_code=error_code, error_message=error_message)


# --- 🔧 FUNÇÕES INTERNAS ---

# Variáveis globais para cache de token
_CURRENT_TOKEN = None
_TOKEN_EXPIRY = 0

def _get_env_config() -> Dict[str, str]:
    """Carrega configurações básicas do ambiente"""
    return {
        "server_url": os.getenv("WPP_SERVER_URL", "http://localhost:21465"),
        "session": os.getenv("WPP_SESSION", "agro_vivo"),
        "secret_key": os.getenv("WPP_SECRET_KEY"),
        "token": os.getenv("WPP_TOKEN") # Fallback ou override opcional
    }

def _generate_token_if_needed() -> str:
    """
    Gera um novo token JWT se não houver um válido.
    Prioriza geração via SECRET_KEY. Se falhar, tenta usar WPP_TOKEN estático.
    """
    global _CURRENT_TOKEN
    
    config = _get_env_config()
    
    # Se já temos um token em memória, retorna ele (poderia ter lógica de expiração aqui)
    if _CURRENT_TOKEN:
        return _CURRENT_TOKEN

    # Se existe SECRET_KEY, tentamos gerar o token
    if config["secret_key"]:
        try:
            url = f"{config['server_url']}/api/{config['session']}/{config['secret_key']}/generate-token"
            response = requests.post(url, timeout=5)
            
            if response.status_code == 201:
                data = response.json()
                _CURRENT_TOKEN = data.get('token')
                return _CURRENT_TOKEN
            else:
                print(f"⚠️ Falha ao gerar token: {response.text}")
        except Exception as e:
            print(f"⚠️ Erro de conexão ao gerar token: {e}")

    # Fallback: WPP_TOKEN estático do .env
    if config["token"]:
        _CURRENT_TOKEN = config["token"]
        return _CURRENT_TOKEN
    
    raise ValueError("Não foi possível autenticar: WPP_SECRET_KEY falhou e WPP_TOKEN não definido.")

def _force_refresh_token():
    """Força limpeza do token atual para obrigar nova geração"""
    global _CURRENT_TOKEN
    _CURRENT_TOKEN = None

def _make_request(
    method: str,
    endpoint: str,
    payload: Optional[Dict[str, Any]] = None,
    timeout: int = 5,
    retry: bool = True
) -> WppResponse:
    """
    Executa uma requisição HTTP ao WPPConnect com tratamento de erros padronizado.
    """
    try:
        config = _get_env_config()
        # Obtém token (gera se necessário)
        token = _generate_token_if_needed()
    except ValueError as e:
        return WppResponse.fail("CONFIG_ERROR", str(e))
    
    url = f"{config['server_url']}/api/{config['session']}{endpoint}"
    
    attempts = 2 if retry else 1
    last_error = None
    
    for attempt in range(attempts):
        # Atualiza header a cada tentativa, pois o token pode ter mudado (refresh)
        headers = {"Authorization": f"Bearer {token}"}
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=headers, timeout=timeout)
            else:
                response = requests.post(url, json=payload, headers=headers, timeout=timeout)
            
            # Tratamento por status code
            if response.status_code in [200, 201]:
                try:
                    data = response.json()
                except:
                    data = {"raw": response.text}
                return WppResponse.ok(data)
            
            elif response.status_code == 401:
                # Se der 401, força refresh do token e tenta de novo IMEDIATAMENTE se for a primeira tentativa
                if attempt == 0:
                    _force_refresh_token()
                    try:
                        token = _generate_token_if_needed()
                        continue # Vai para a próxima iteração do loop com token novo
                    except Exception as e:
                        return WppResponse.fail("AUTH_ERROR", f"Falha ao renovar token: {str(e)}")
                
                return WppResponse.fail(
                    "AUTH_ERROR",
                    f"Token inválido ou expirado (401): {response.text[:100]}"
                )
            
            elif response.status_code >= 500:
                last_error = WppResponse.fail(
                    "SERVER_ERROR",
                    f"Erro no servidor WPPConnect ({response.status_code}): {response.text[:100]}"
                )
                if attempt < attempts - 1:
                    continue
                return last_error
            
            else:
                return WppResponse.fail(
                    "HTTP_ERROR",
                    f"Erro HTTP ({response.status_code}): {response.text[:100]}"
                )
                
        except requests.exceptions.Timeout:
            last_error = WppResponse.fail("TIMEOUT", f"Timeout após {timeout}s")
            if attempt < attempts - 1:
                continue
            return last_error
            
        except requests.exceptions.ConnectionError:
            return WppResponse.fail(
                "NETWORK_ERROR",
                "Conexão recusada. WPPConnect Server está rodando?"
            )
            
        except Exception as e:
            return WppResponse.fail("UNKNOWN_ERROR", str(e))
    
    return last_error or WppResponse.fail("UNKNOWN_ERROR", "Erro desconhecido")


# --- 🌐 FUNÇÕES PÚBLICAS ---

def check_connection(timeout: int = 2) -> WppResponse:
    """
    Verifica se a sessão WPPConnect está ativa e conectada.
    Args:
        timeout: Timeout em segundos (default: 2s)
    
    Returns:
        WppResponse com success=True se conectado.
        data contém {"connected": bool, "session": str}
    """
    result = _make_request("GET", "/check-connection-session", retry=False, timeout=timeout)
    
    if result.success and result.data:
        # Normaliza resposta para formato padrão
        is_connected = result.data.get("status") == True or result.data.get("connected") == True
        return WppResponse.ok({
            "connected": is_connected,
            "session": _get_env_config()["session"],
            "raw": result.data
        })
    
    return result


def send_text(phone: str, message: str) -> WppResponse:
    """
    Envia mensagem de texto para um número de telefone.
    
    Args:
        phone: ID do WhatsApp (ex: 5511999999999@c.us)
        message: Texto da mensagem
        
    Returns:
        WppResponse com resultado da operação.
    """
    if not phone:
        return WppResponse.fail("INVALID_INPUT", "Telefone não informado")
    
    if not message:
        return WppResponse.fail("INVALID_INPUT", "Mensagem vazia")
    
    # Correção de ID: removido replacement forçado de @lid para @c.us
    # if "@lid" in phone:
    #     phone = phone.replace("@lid", "@c.us")
    
    # Validação: ignore chats especiais (status, broadcast)
    # Validação: ignore chats especiais (status, broadcast)
    if any(k in phone for k in ['status@c.us', 'status@broadcast', 'broadcast']):
        # Return success=True to avoid retry loops, but don't actually send
        return WppResponse.ok({"ignored": True, "reason": "status_broadcast"})

    # Fallback: Se for puramente numérico, assume @c.us
    if "@" not in phone and phone.isdigit():
        phone = f"{phone}@c.us"

    if '@' not in phone:
        return WppResponse.fail("INVALID_WID", f"Formato de ID inválido (sem @): {phone}")
    
    payload = {
        "phone": phone,
        "message": message,
        "isGroup": False
    }
    
    # [WARNING] WPPConnect has issues with @lid IDs
    if '@lid' in phone:
        print(f"⚠️ [WARNING] Tentando enviar para @lid: {phone} - WPPConnect pode falhar!")
    
    print(phone)
    response = _make_request("POST", "/send-message", payload=payload)
    
    # Check for specific WID errors in response
    if not response.success and response.error_message and "invalid wid" in response.error_message.lower():
        print(f"❌ [CRITICAL] WID Rejeitado pelo WPPConnect: {phone}")
        
    return response


def download_media(message_id: str, save_path: Path) -> WppResponse:
    """
    Baixa mídia de uma mensagem específica e salva localmente.
    
    Args:
        message_id: ID da mensagem contendo mídia
        save_path: Caminho completo onde salvar o arquivo
        
    Returns:
        WppResponse com success=True se baixou.
        data contém {"file_path": str, "size_bytes": int}
    """
    if not message_id:
        return WppResponse.fail("INVALID_INPUT", "message_id não informado")
    
    result = _make_request("GET", f"/get-media-by-message/{message_id}", retry=False)
    
    if not result.success:
        return result
    
    try:
        # Extrai dados base64 da resposta
        raw_data = result.data
        
        if isinstance(raw_data, dict):
            if "base64" in raw_data:
                b64_data = raw_data["base64"]
            elif "raw" in raw_data:
                b64_data = raw_data["raw"]
            else:
                return WppResponse.fail("PARSE_ERROR", "Resposta não contém dados base64")
        else:
            b64_data = str(raw_data)
        
        # Limpa cabeçalho base64 se existir (ex: "data:audio/ogg;base64,...")
        if "base64," in b64_data:
            b64_data = b64_data.split("base64,")[1]
        
        # Decodifica e salva
        binary_data = base64.b64decode(b64_data)
        
        # Garante que o diretório pai existe
        save_path = Path(save_path)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(save_path, "wb") as f:
            f.write(binary_data)
        
        return WppResponse.ok({
            "file_path": str(save_path),
            "size_bytes": len(binary_data)
        })
        
    except base64.binascii.Error as e:
        return WppResponse.fail("DECODE_ERROR", f"Erro ao decodificar base64: {e}")
    except IOError as e:
        return WppResponse.fail("IO_ERROR", f"Erro ao salvar arquivo: {e}")
    except Exception as e:
        return WppResponse.fail("UNKNOWN_ERROR", f"Erro ao processar mídia: {e}")


    return result


def get_messages(phone: str, count: int = 10) -> WppResponse:
    """
    Busca o histórico de mensagens de um chat.

    Args:
        phone: ID do chat (ex: 5511999999999@c.us)
        count: Quantidade de mensagens para buscar (padrão=10)

    Returns:
        WppResponse com lista de mensagens.
    """
    if not phone:
        return WppResponse.fail("INVALID_INPUT", "Telefone não informado")
    
    # Endpoint do WPPConnect para buscar mensagens do chat
    # Source: wppconnect-server/src/routes/index.ts -> /api/:session/get-messages/:phone
    endpoint = f"/get-messages/{phone}?count={count}"
    
    result = _make_request("GET", endpoint)
    
    if result.success and isinstance(result.data, list):
        return WppResponse.ok(result.data)
    elif result.success and isinstance(result.data, dict) and 'response' in result.data:
         # Support wrapper format if present
         return WppResponse.ok(result.data.get('response', []))
         
    return result


def get_unread_messages(timeout: int = 3, retry: bool = True) -> WppResponse:
    """
    Busca todas as mensagens não lidas no WPPConnect.
    
    Args:
        timeout: Timeout em segundos (default: 3s)
        retry: Se deve tentar novamente em caso de falha (default: True)

    Returns:
        WppResponse com success=True.
        data contém lista de mensagens (WPP message objects).
    """
    result = _make_request("GET", "/all-unread-messages", timeout=timeout, retry=retry)
    if result.success and isinstance(result.data, dict):
        # Extract actual list from WPPConnect wrapper {"response": [...]}
        messages = result.data.get("response", [])
        return WppResponse.ok(messages)
    return result


def get_chats() -> WppResponse:
    """
    Busca lista de todos os chats ativos.
    
    Returns:
        WppResponse com lista de chats (incluindo lastMessage).
    """
    # Endpoint do WPPConnect para buscar chats
    result = _make_request("GET", "/all-chats")
    
    if result.success and isinstance(result.data, list):
         return WppResponse.ok(result.data)
    elif result.success and isinstance(result.data, dict):
         # Normalize wrappers
         return WppResponse.ok(result.data.get('response', []) or result.data)
         
    return result


def resolve_lid_to_phone(lid: str) -> WppResponse:
    """
    Tenta resolver um LID (Line ID) para o número de telefone real @c.us.
    
    O WhatsApp usa LIDs internamente para alguns usuários, mas para enviar
    mensagens precisamos do número real no formato @c.us.
    
    Args:
        lid: ID no formato '10857845141643@lid' ou apenas o número
        
    Returns:
        WppResponse com data={"phone": "201005505663@c.us"} se encontrado,
        ou erro se não conseguir resolver.
    """
    if not lid:
        return WppResponse.fail("INVALID_INPUT", "LID não informado")
    
    # Normaliza o LID
    lid_clean = lid.strip()
    if "@" not in lid_clean:
        lid_clean = f"{lid_clean}@lid"
    
    # Tenta usar a API getContact para obter informações do contato
    # Endpoint: GET /api/:session/contact/:phone
    try:
        result = _make_request("GET", f"/contact/{lid_clean}", timeout=5)
        
        if result.success and result.data:
            data = result.data
            
            # ... (lógica existente de busca na API)
            
            # Procura o número real em vários lugares possíveis
            # 1. Campo 'id' como string @c.us
            contact_id = data.get('id')
            if isinstance(contact_id, str) and '@c.us' in contact_id:
                return WppResponse.ok({"phone": contact_id, "source": "contact.id"})
            
            # 2. Campo 'id' como dict com _serialized
            if isinstance(contact_id, dict):
                serialized = contact_id.get('_serialized', '')
                if '@c.us' in serialized:
                    return WppResponse.ok({"phone": serialized, "source": "contact.id._serialized"})
            
            # 3. Campo 'number' diretamente
            number = data.get('number', '')
            if number and number.isdigit():
                return WppResponse.ok({"phone": f"{number}@c.us", "source": "contact.number"})
            
            # 4. Campo 'jid' ou 'wid'
            for field in ['jid', 'wid', 'userid']:
                val = data.get(field, '')
                if isinstance(val, str) and '@c.us' in val:
                    return WppResponse.ok({"phone": val, "source": f"contact.{field}"})
                if isinstance(val, dict):
                    ser = val.get('_serialized', '')
                    if '@c.us' in ser:
                        return WppResponse.ok({"phone": ser, "source": f"contact.{field}._serialized"})
    except Exception as e:
        print(f"⚠️ Erro ao consultar API para LID {lid_clean}: {e}")

    # --- FALLBACK: LIDManager (Banco de Dados) ---
    print(f"🔍 [LID] Tentando resolver via LIDManager: {lid_clean}")
    try:
        from modules.lid_manager import LIDManager
        # Inicializa sem passar cliente (vai usar env vars)
        manager = LIDManager()
        mapped_phone = manager.get_real_phone(lid_clean)
        
        if mapped_phone:
            final_phone = f"{mapped_phone}@c.us" if "@" not in mapped_phone else mapped_phone
            return WppResponse.ok({"phone": final_phone, "source": "lid_manager"})
    except Exception as e:
         print(f"❌ Erro no LIDManager: {e}")

    # Se não encontrou @c.us, retorna erro
    return WppResponse.fail(
        "LID_NOT_RESOLVED",
        f"Não foi possível encontrar número @c.us para LID: {lid_clean}. Use /admin/register-lid para mapear."
    )

