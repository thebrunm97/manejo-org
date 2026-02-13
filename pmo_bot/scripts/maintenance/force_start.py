"""
force_start.py - Força início da sessão WPPConnect e captura QR Code

Executa múltiplas estratégias para iniciar a sessão e obter o QR Code.
"""
import requests
import json
import webbrowser
import time
from pathlib import Path

# ============================================================================
# CONFIGURAÇÃO (do docker-compose.yml)
# ============================================================================
WPPCONNECT_URL = "http://localhost:21465"
SESSION_NAME = "agro_vivo"
SECRET_KEY = "70sK1YXPJ81m4"
QRCODE_HTML_PATH = Path(__file__).parent / "qrcode.html"


def update_qrcode_html(qrcode_base64: str, status: str = "QRCODE"):
    """Atualiza o arquivo qrcode.html com o novo QR Code"""
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp QR Code ({SESSION_NAME})</title>
    <meta charset="UTF-8">
    <style>
        body {{
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
        }}
        .card {{
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 400px;
        }}
        h2 {{
            color: #128C7E;
            margin-bottom: 10px;
        }}
        .status {{
            display: inline-block;
            padding: 5px 15px;
            background: #fef3c7;
            color: #92400e;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 20px;
        }}
        img {{
            max-width: 280px;
            border: 3px solid #e5e7eb;
            border-radius: 15px;
            margin: 20px 0;
        }}
        p {{
            color: #666;
            font-size: 14px;
            line-height: 1.6;
        }}
        button {{
            padding: 12px 30px;
            background: #128C7E;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            margin-top: 15px;
            transition: background 0.3s;
        }}
        button:hover {{
            background: #075E54;
        }}
        .time {{
            color: #9ca3af;
            font-size: 12px;
            margin-top: 15px;
        }}
    </style>
</head>
<body>
    <div class="card">
        <h2>🔗 Sessão: {SESSION_NAME}</h2>
        <span class="status">⏳ {status}</span>
        <img src="{qrcode_base64}" alt="QR Code">
        <p>
            📱 Abra o WhatsApp no celular<br>
            ⚙️ Menu → Aparelhos conectados<br>
            ➕ Conectar um aparelho
        </p>
        <button onclick="window.location.reload()">🔄 Atualizar</button>
        <p class="time">Gerado em: {time.strftime('%H:%M:%S')}</p>
    </div>
</body>
</html>"""
    
    with open(QRCODE_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"✅ QR Code salvo em: {QRCODE_HTML_PATH}")


def update_html_connected():
    """Atualiza HTML para mostrar conexão estabelecida"""
    
    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Conectado!</title>
    <meta charset="UTF-8">
    <style>
        body {{
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
        }}
        .card {{
            background: white;
            padding: 60px;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            text-align: center;
        }}
        .emoji {{ font-size: 80px; margin-bottom: 20px; }}
        h2 {{ color: #059669; margin: 0; }}
        p {{ color: #666; margin-top: 15px; }}
    </style>
</head>
<body>
    <div class="card">
        <div class="emoji">🎉</div>
        <h2>WhatsApp Conectado!</h2>
        <p>Sessão <strong>{SESSION_NAME}</strong> está ativa.</p>
    </div>
</body>
</html>"""
    
    with open(QRCODE_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)


def generate_token():
    """Gera token de autenticação"""
    print("\n🔑 Gerando token de autenticação...")
    
    try:
        r = requests.post(
            f"{WPPCONNECT_URL}/api/{SESSION_NAME}/{SECRET_KEY}/generate-token",
            timeout=10
        )
        
        if r.status_code in [200, 201]:
            data = r.json()
            token = data.get("token")
            if token:
                print(f"✅ Token gerado!")
                return token
        
        print(f"⚠️ Falha ao gerar token: {r.status_code} - {r.text[:200]}")
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    return SECRET_KEY


def list_all_sessions(token):
    """Lista todas as sessões para debug"""
    print("\n📋 Listando sessões existentes...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        r = requests.get(
            f"{WPPCONNECT_URL}/api/show-all-sessions",
            headers=headers,
            timeout=10
        )
        
        if r.status_code == 200:
            data = r.json()
            print(f"📦 Sessões encontradas: {json.dumps(data, indent=2)}")
            return data
        else:
            print(f"⚠️ Não foi possível listar: {r.status_code}")
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    return []


def close_session(token):
    """Fecha sessão existente antes de recriar"""
    print(f"\n🔄 Fechando sessão '{SESSION_NAME}' (se existir)...")
    
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    try:
        r = requests.post(
            f"{WPPCONNECT_URL}/api/{SESSION_NAME}/close-session",
            headers=headers,
            timeout=10
        )
        print(f"   Status: {r.status_code}")
    except Exception as e:
        print(f"   (ignorado: {e})")


def start_session(token):
    """Inicia sessão e captura QR Code"""
    print(f"\n🚀 Iniciando sessão '{SESSION_NAME}'...")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    try:
        r = requests.post(
            f"{WPPCONNECT_URL}/api/{SESSION_NAME}/start-session",
            headers=headers,
            json={
                "webhook": f"http://pmo-bot:5000/webhook?token=TY6oMv4d20a3",
                "waitQrCode": True
            },
            timeout=60
        )
        
        print(f"📊 Status: {r.status_code}")
        
        if r.status_code in [200, 201]:
            data = r.json()
            status = data.get("status") or data.get("state") or "UNKNOWN"
            print(f"📱 Estado: {status}")
            
            # Procurar QR Code em várias chaves possíveis
            qrcode = (
                data.get("qrcode") or 
                data.get("urlcode") or 
                data.get("base64Qr") or
                data.get("qr") or
                data.get("data", {}).get("qrcode")
            )
            
            if status.upper() == "CONNECTED":
                print("✅ Sessão já está CONECTADA!")
                update_html_connected()
                return True
            
            if qrcode:
                print("📱 QR Code capturado!")
                
                # Garantir formato base64 correto
                if not qrcode.startswith("data:image"):
                    qrcode = f"data:image/png;base64,{qrcode}"
                
                update_qrcode_html(qrcode, status)
                
                # Abrir no navegador
                webbrowser.open(f"file:///{QRCODE_HTML_PATH.as_posix()}")
                return True
            else:
                print(f"⚠️ Sem QR Code na resposta. Dados: {json.dumps(data, indent=2)[:500]}")
        else:
            print(f"❌ Erro: {r.text[:300]}")
            
    except requests.exceptions.Timeout:
        print("⚠️ Timeout - o servidor demorou muito para responder")
    except Exception as e:
        print(f"❌ Erro: {e}")
    
    return False


def get_qr_code(token):
    """Tenta obter QR Code via endpoint dedicado"""
    print(f"\n🔍 Buscando QR Code via endpoint dedicado...")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    endpoints = [
        f"/api/{SESSION_NAME}/qrcode-session",
        f"/api/{SESSION_NAME}/get-qrcode",
        f"/api/{SESSION_NAME}/qrcode",
    ]
    
    for endpoint in endpoints:
        try:
            r = requests.get(
                f"{WPPCONNECT_URL}{endpoint}",
                headers=headers,
                timeout=10
            )
            
            if r.status_code == 200:
                data = r.json() if 'json' in r.headers.get('content-type', '') else {"qrcode": r.text}
                qrcode = data.get("qrcode") or data.get("base64") or data.get("data", {}).get("qrcode")
                
                if qrcode:
                    print(f"✅ QR Code obtido via {endpoint}")
                    
                    if not qrcode.startswith("data:image"):
                        qrcode = f"data:image/png;base64,{qrcode}"
                    
                    update_qrcode_html(qrcode, "QRCODE")
                    webbrowser.open(f"file:///{QRCODE_HTML_PATH.as_posix()}")
                    return True
        except Exception as e:
            print(f"   {endpoint}: {e}")
    
    return False


def main():
    print("="*60)
    print("🔧 FORCE START - WPPConnect Session Recovery")
    print("="*60)
    
    # 1. Gerar token
    token = generate_token()
    
    # 2. Listar sessões (debug)
    list_all_sessions(token)
    
    # 3. Fechar sessão antiga (se houver)
    close_session(token)
    
    time.sleep(2)  # Aguardar cleanup
    
    # 4. Iniciar nova sessão
    if start_session(token):
        print("\n" + "="*60)
        print("✅ SUCESSO! QR Code disponível no navegador.")
        print("="*60)
        return
    
    # 5. Fallback: tentar obter QR via endpoint dedicado
    print("\n⚠️ Tentando método alternativo...")
    if get_qr_code(token):
        print("\n✅ QR Code obtido via método alternativo!")
        return
    
    # 6. Instruções manuais
    print("\n" + "="*60)
    print("⚠️ NÃO FOI POSSÍVEL OBTER QR CODE AUTOMATICAMENTE")
    print("="*60)
    print(f"\n📚 Tente manualmente:")
    print(f"   1. Acesse: {WPPCONNECT_URL}/api-docs")
    print(f"   2. Auth: POST /api/{SESSION_NAME}/{SECRET_KEY}/generate-token")
    print(f"   3. Use o token em 'Authorize'")
    print(f"   4. Session: POST /api/{SESSION_NAME}/start-session")
    print(f"\nOu verifique os logs do container:")
    print(f"   docker logs -f wppconnect")


if __name__ == "__main__":
    main()
