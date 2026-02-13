
import requests
import json
import time
import os
import subprocess
import re
from dotenv import load_dotenv

load_dotenv()

# Configuração via Variáveis de Ambiente
BASE_URL = os.getenv("WPP_SERVER_URL", "http://localhost:21465")
SESSION = os.getenv("WPP_SESSION", "agro_vivo")
SECRET_KEY = os.getenv("WPP_SECRET_KEY")

print(f"--- Configuração ---")
print(f"URL: {BASE_URL}")
print(f"Sessão: {SESSION}")
print(f"Secret Presente: {'Sim' if SECRET_KEY else 'Não'}")

if not SECRET_KEY:
    print("❌ ERRO: WPP_SECRET_KEY não definida no .env")
    exit(1)

def get_qrcode_from_logs():
    """Tenta recuperar o QR Code direto dos logs do container"""
    try:
        # Pega as últimas 50 linhas de log
        result = subprocess.run(
            ["docker-compose", "logs", "--tail=50", "wppconnect"],
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        
        # Procura por padrão JSON de código
        # Ex: {"code":"data:image/png;base64,..."} 
        # ou apenas o string code se for diferente
        matches = re.findall(r'"code":"([^"]+)"', result.stdout)
        if matches:
            # Pega o último encontrado (mais recente)
            return matches[-1]
            
    except Exception as e:
        print(f"⚠️ Erro ao ler logs: {e}")
    return None

# Wait for server to be ready
print("\nWaiting for WPPConnect server (5s)...")
time.sleep(5)

# --- Passo 1: Gerar Token ---
print("\nGenerating token...")
token = None
try:
    auth_url = f"{BASE_URL}/api/{SESSION}/{SECRET_KEY}/generate-token"
    resp = requests.post(auth_url)
    if resp.status_code == 201:
        data = resp.json()
        token = data.get('token')
        print(f"✅ Token generated successfully")
    else:
        print(f"❌ Token generation failed: {resp.status_code} - {resp.text}")
        exit(1)
except Exception as e:
    print(f"❌ Error generating token: {e}")
    exit(1)

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# --- Passo 2: Iniciar Sessão ---
print("\nTrying to close previous session...")
close_url = f"{BASE_URL}/api/{SESSION}/close-session"
try:
    requests.post(close_url, headers=headers)
except:
    pass

print("Starting session to get QR Code...")
start_url = f"{BASE_URL}/api/{SESSION}/start-session"

max_retries = 20
for i in range(max_retries):
    try:
        print(f"Attempt {i+1}/{max_retries}...")
        
        qrcode = None
        status = "UNKNOWN"

        # 1. Tenta API start-session
        try:
            resp = requests.post(start_url, headers=headers, timeout=10)
            data = resp.json()
            status = data.get('status')
            qrcode = data.get('qrcode')
        except Exception as e_api:
            print(f"⚠️ API Info: {e_api}")
        
        print(f"Status: {status}")
        
        if status == 'CONNECTED':
             print("✅ Already Connected!")
             break

        # 2. Se não veio na API, tenta endpoint específico
        if not qrcode:
            try:
                qr_url = f"{BASE_URL}/api/{SESSION}/qrcode-session"
                qr_resp = requests.get(qr_url, headers=headers, timeout=5)
                if qr_resp.status_code == 200:
                    qr_data = qr_resp.json()
                    if qr_data and qr_data.get('qrcode'):
                        qrcode = qr_data.get('qrcode')
                        print("📸 QR Code received from /qrcode-session endpoint!")
            except Exception as e:
                pass

        # 3. Se ainda não tem, tenta via LOGS (Fallback Supremo)
        if not qrcode:
            print("🕵️ Checking logs for QR Code...")
            log_qrcode = get_qrcode_from_logs()
            if log_qrcode:
                qrcode = log_qrcode
                print("📸 QR Code found in Docker logs!")

        if qrcode:
             # Se for base64, usa direto. Se for texto/URL (novo padrão), gera via API.
             img_src = qrcode
             if not qrcode.startswith('data:image'):
                 import urllib.parse
                 encoded_qr = urllib.parse.quote(qrcode)
                 img_src = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={encoded_qr}"

             html_content = f"""
            <html>
            <head><title>WhatsApp QR Code ({SESSION})</title></head>
            <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;background:#f0f2f5;font-family:sans-serif;">
                <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;">
                    <h2 style="color:#128C7E;">Sessão: {SESSION}</h2>
                    <img src="{img_src}" style="max-width:300px;border:1px solid #ddd;border-radius:8px;margin:20px 0;">
                    <p style="color:#666;">Abra o WhatsApp > Menu > Aparelhos conectados > Conectar um aparelho</p>
                    <p style="font-size:12px;color:#999;word-break:break-all;max-width:300px;">{qrcode if not qrcode.startswith('data:') else ''}</p>
                    <button onclick="window.location.reload()" style="padding:10px 20px;background:#128C7E;color:white;border:none;border-radius:5px;cursor:pointer;font-size:16px;">Atualizar</button>
                    <p style="font-size:12px;color:#999;margin-top:10px;">Gerado via Log Scraping/API</p>
                </div>
            </body>
            </html>
            """
            
             with open("qrcode.html", "w", encoding="utf-8") as f:
                f.write(html_content)
            
             print(f"✅ QR Code saved to {os.path.abspath('qrcode.html')}")
             break
        else:
            print("No QR Code yet, waiting...")
            time.sleep(5)
            
    except Exception as e:
        print(f"Error fetching QR code: {e}")
        time.sleep(5)
