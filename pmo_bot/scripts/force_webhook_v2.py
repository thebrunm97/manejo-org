
import os
import requests
import json
import time

# Config
SERVER_URL = "http://wppconnect:21465"
SESSION = "agro_vivo"
SECRET_KEY = "TY6oMv4d20a3"
WEBHOOK_TARGET = "http://pmo-bot:5000/webhook"

def get_token():
    url = f"{SERVER_URL}/api/{SESSION}/{SECRET_KEY}/generate-token"
    print(f"🔑 Gerando token em {url}...")
    try:
        resp = requests.post(url, timeout=5)
        if resp.status_code == 201:
            data = resp.json()
            return data.get('token')
        else:
            print(f"❌ Falha auth: {resp.text}")
            return None
    except Exception as e:
        print(f"❌ Erro auth: {e}")
        return None

def force_webhook():
    token = get_token()
    if not token:
        return

    print(f"✅ Token gerado. Configurando webhook...")
    
    # Payload
    payload = {
        "url": WEBHOOK_TARGET,
        "enabled": True,
        "webhook": {
             "url": WEBHOOK_TARGET,
             "autoDownload": False, # Reduce load
             "readMessage": True,
             "allUnreadOnStart": False,
             "listenAcks": False,
             "onPresenceChanged": False,
             "onParticipantsChanged": False,
        }
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Lista de endpoints candidatos
    endpoints = [
        f"{SERVER_URL}/api/{SESSION}/webhook",
        f"{SERVER_URL}/api/{SESSION}/subscribe",
        f"{SERVER_URL}/api/{SESSION}/set-webhook",
        f"{SERVER_URL}/api/{SESSION}/configure-webhook"
    ]

    for url in endpoints:
        print(f"📡 Tentando endpoint: {url}...")
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=5)
            print(f"Status: {resp.status_code}")
            if resp.status_code in [200, 201]:
                print(f"✅ SUCESSO! Webhook configurado em: {url}")
                return
        except Exception as e:
            print(f"❌ Erro: {e}")
    
    print("❌ Falha: Nenhum endpoint funcionou.")

if __name__ == "__main__":
    force_webhook()
