import requests
import os
import sys
from dotenv import load_dotenv

load_dotenv()

SERVER_URL = "http://wppconnect:21465" # Internal docker network URL
SESSION = os.getenv("WPP_SESSION", "agro_vivo")
SECRET_KEY = os.getenv("WPP_SECRET_KEY")

def get_token():
    """Gera token JWT usando a Secret Key."""
    if not SECRET_KEY:
        print("❌ WPP_SECRET_KEY não definida.")
        sys.exit(1)
        
    url = f"{SERVER_URL}/api/{SESSION}/{SECRET_KEY}/generate-token"
    try:
        resp = requests.post(url, timeout=10)
        if resp.status_code == 201:
            return resp.json().get('token')
        else:
            print(f"❌ Falha ao gerar token: {resp.text}")
    except Exception as e:
        print(f"❌ Erro ao conectar WPP: {e}")
    sys.exit(1)

def send_hello(phone):
    """Envia uma mensagem de teste para o número informado."""
    
    # Auto-suffix
    if "@" not in phone:
        if len(phone) > 13:
            phone = f"{phone}@lid"
        else:
            phone = f"{phone}@c.us"
    
    token = get_token()
    
    url = f"{SERVER_URL}/api/{SESSION}/send-message"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    payload = {
        "phone": phone,
        "message": "👋 Olá! Teste de conexão do bot.",
        "isGroup": False
    }

    print(f"📤 Enviando teste para: {phone}...")
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=20)
        
        if resp.status_code in [200, 201]:
             print("✅ Mensagem enviada com sucesso!")
             print(resp.json())
        else:
             print(f"❌ Erro {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"❌ Falha de conexão: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        phone = sys.argv[1]
        send_hello(phone)
    else:
        print("Uso: python send_hello.py <numero>")
