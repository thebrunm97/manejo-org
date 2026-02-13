"""
fix_connection.py - Diagnóstico e Correção COMPLETA do Webhook WPPConnect → pmo-bot
                    Com atualização automática do QR Code no qrcode.html

Execute: python fix_connection.py
"""
import requests
import json
import sys
import os
from pathlib import Path

# ============================================================================
# CONFIGURAÇÃO (Baseada no docker-compose.yml e .env)
# ============================================================================
WPPCONNECT_LOCAL_URL = "http://localhost:21465"
SESSION_NAME = "agro_vivo"
SECRET_KEY = "70sK1YXPJ81m4"

WEBHOOK_URL_INTERNAL = "http://pmo-bot:5000/webhook?token=TY6oMv4d20a3"
QRCODE_HTML_PATH = Path(__file__).parent / "qrcode.html"


def get_auth_token():
    """Gera token de autenticação do WPPConnect usando a SECRET_KEY"""
    print("\n🔑 Gerando token de autenticação...")
    
    try:
        r = requests.post(
            f"{WPPCONNECT_LOCAL_URL}/api/{SESSION_NAME}/{SECRET_KEY}/generate-token",
            timeout=10
        )
        
        if r.status_code in [200, 201]:
            data = r.json()
            token = data.get("token")
            if token:
                print(f"✅ Token gerado com sucesso!")
                return token
        
        print(f"⚠️ Usando SECRET_KEY como fallback (status: {r.status_code})")
    except Exception as e:
        print(f"⚠️ Erro ao gerar token: {e}")
    
    return SECRET_KEY


def update_qrcode_html(qrcode_base64: str, status: str = "QRCODE"):
    """Atualiza o arquivo qrcode.html com o novo QR Code"""
    
    html_content = f"""
            <html>
            <head><title>WhatsApp QR Code ({SESSION_NAME})</title></head>
            <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#f0f2f5;font-family:sans-serif;">
                <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;">
                    <h2 style="color:#128C7E;">Sessão: {SESSION_NAME}</h2>
                    <p style="color:#666;font-size:14px;">Status: <strong>{status}</strong></p>
                    <img src="{qrcode_base64}" style="max-width:300px;border:1px solid #ddd;border-radius:8px;margin:20px 0;">
                    <p style="color:#666;">Abra o WhatsApp > Menu > Aparelhos conectados > Conectar um aparelho</p>
                    <button onclick="window.location.reload()" style="padding:10px 20px;background:#128C7E;color:white;border:none;border-radius:5px;cursor:pointer;font-size:16px;">Atualizar</button>
                </div>
            </body>
            </html>
            """
    
    with open(QRCODE_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"✅ QR Code salvo em: {QRCODE_HTML_PATH}")
    print(f"🌐 Abra no navegador: file:///{QRCODE_HTML_PATH.as_posix()}")


def update_qrcode_connected():
    """Atualiza o qrcode.html para mostrar status CONECTADO"""
    
    html_content = f"""
            <html>
            <head><title>WhatsApp Conectado ({SESSION_NAME})</title></head>
            <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#f0f2f5;font-family:sans-serif;">
                <div style="background:white;padding:40px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;">
                    <h2 style="color:#128C7E;">✅ WhatsApp Conectado!</h2>
                    <p style="color:#25D366;font-size:48px;margin:20px 0;">🎉</p>
                    <p style="color:#666;">Sessão <strong>{SESSION_NAME}</strong> está ativa e pronta para receber mensagens.</p>
                    <button onclick="window.location.reload()" style="padding:10px 20px;background:#128C7E;color:white;border:none;border-radius:5px;cursor:pointer;font-size:16px;margin-top:20px;">Verificar Novamente</button>
                </div>
            </body>
            </html>
            """
    
    with open(QRCODE_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"✅ Status atualizado em: {QRCODE_HTML_PATH}")


def step1_check_wppconnect():
    """Passo 1: Verifica se WPPConnect está respondendo"""
    print("\n" + "="*60)
    print("🔍 PASSO 1: Verificando WPPConnect...")
    print("="*60)
    
    try:
        r = requests.get(f"{WPPCONNECT_LOCAL_URL}/api/", timeout=5)
        print(f"✅ WPPConnect online! Status: {r.status_code}")
        return True
    except requests.exceptions.ConnectionError:
        print("❌ ERRO: WPPConnect não está acessível em localhost:21465")
        print("   Verifique se o container está rodando: docker ps")
        return False
    except Exception as e:
        print(f"❌ ERRO: {e}")
        return False


def step2_start_session_and_get_qr(token):
    """Passo 2: Inicia sessão e obtém QR Code"""
    print("\n" + "="*60)
    print(f"🔍 PASSO 2: Iniciando sessão '{SESSION_NAME}'...")
    print("="*60)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    try:
        # Primeiro, verificar status atual
        r = requests.get(
            f"{WPPCONNECT_LOCAL_URL}/api/{SESSION_NAME}/status-session",
            headers=headers,
            timeout=10
        )
        
        if r.status_code == 200:
            data = r.json()
            status = data.get("status") or data.get("state")
            print(f"📊 Status atual: {status}")
            
            if status == "CONNECTED":
                print("✅ Sessão já está conectada!")
                update_qrcode_connected()
                return True, headers
        
        # Tentar iniciar sessão
        print("🔄 Iniciando sessão e aguardando QR Code...")
        r = requests.post(
            f"{WPPCONNECT_LOCAL_URL}/api/{SESSION_NAME}/start-session",
            headers=headers,
            json={
                "webhook": WEBHOOK_URL_INTERNAL,
                "waitQrCode": True
            },
            timeout=60  # Pode demorar para gerar QR
        )
        
        print(f"📊 Status HTTP: {r.status_code}")
        
        if r.status_code in [200, 201]:
            data = r.json()
            status = data.get("status") or data.get("state")
            
            # Tentar extrair QR Code de várias formas
            qrcode = (
                data.get("qrcode") or 
                data.get("urlcode") or 
                data.get("base64Qr") or
                data.get("qr")
            )
            
            if status == "CONNECTED":
                print("✅ Sessão conectada!")
                update_qrcode_connected()
                return True, headers
                
            elif qrcode:
                print(f"📱 QR Code recebido! Status: {status}")
                
                # Garantir que é base64 válido
                if not qrcode.startswith("data:image"):
                    qrcode = f"data:image/png;base64,{qrcode}"
                
                update_qrcode_html(qrcode, status)
                
                # Abrir automaticamente no navegador
                import webbrowser
                webbrowser.open(f"file:///{QRCODE_HTML_PATH.as_posix()}")
                
                return False, headers
            else:
                print(f"⚠️ Resposta sem QR Code. Status: {status}")
                print(f"📦 Dados: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
                return False, headers
        else:
            print(f"❌ Erro ao iniciar sessão: {r.text[:300]}")
            return False, headers
            
    except requests.exceptions.Timeout:
        print("⚠️ Timeout aguardando QR Code. Tente novamente.")
        return False, headers
    except Exception as e:
        print(f"❌ ERRO: {e}")
        return headers, headers


def step3_test_pmo_bot():
    """Passo 3: Testa conectividade com pmo-bot"""
    print("\n" + "="*60)
    print("🧪 PASSO 3: Testando conectividade pmo-bot...")
    print("="*60)
    
    try:
        r = requests.post(
            "http://localhost:5000/webhook?token=TY6oMv4d20a3",
            json={"test": "ping", "event": "connection-test"},
            timeout=5
        )
        print(f"✅ pmo-bot respondeu! Status: {r.status_code}")
        return True
    except Exception as e:
        print(f"❌ pmo-bot inacessível: {e}")
        return False


def main():
    print("\n" + "🚀"*20)
    print("   FIX CONNECTION v3.0 - Com QR Code Automático")
    print("🚀"*20)
    
    # Passo 0: Gerar token
    token = get_auth_token()
    
    results = {}
    
    # Passo 1: Verificar WPPConnect
    results["wppconnect_online"] = step1_check_wppconnect()
    
    if not results["wppconnect_online"]:
        print("\n❌ WPPConnect offline. Execute: docker compose up -d")
        sys.exit(1)
    
    # Passo 2: Iniciar sessão e obter QR
    session_ok, headers = step2_start_session_and_get_qr(token)
    results["session_connected"] = session_ok
    
    # Passo 3: Testar pmo-bot
    results["pmo_bot_reachable"] = step3_test_pmo_bot()
    
    # Resumo
    print("\n" + "="*60)
    print("📋 RESUMO")
    print("="*60)
    
    for key, value in results.items():
        status = "✅" if value else "❌"
        print(f"  {status} {key.replace('_', ' ').title()}")
    
    if results["session_connected"] and results["pmo_bot_reachable"]:
        print("\n🎉 TUDO PRONTO! Envie uma mensagem no WhatsApp para testar.")
    elif not results["session_connected"]:
        print(f"\n📱 QR CODE disponível em: {QRCODE_HTML_PATH}")
        print("   Escaneie o QR Code e execute este script novamente.")


if __name__ == "__main__":
    main()
