
import os
import requests
import json

# Config
SERVER_URL = "http://wppconnect:21465"
SESSION = "agro_vivo"
WEBHOOK_TARGET = "http://pmo-bot:5000/webhook"
TOKEN = os.getenv("WPPCONNECT_TOKEN")

def force_webhook():
    print(f"🔧 Configurando Webhook para {SESSION}...")
    
    # Endpoint de configuração de webhook (WPPConnect Server)
    # A documentação varia, mas comumente é /api/{session}/webhook
    url = f"{SERVER_URL}/api/{SESSION}/webhook"
    
    payload = {
        "url": WEBHOOK_TARGET,
        "enabled": True,
        # Pode ser necessário especificar eventos se a versão exigir
        "webhook": {
             "url": WEBHOOK_TARGET,
             "autoDownload": True,
             "uploadS3": False,
             "readMessage": True,
             "allUnreadOnStart": True,
             "listenAcks": True,
             "onPresenceChanged": True,
             "onParticipantsChanged": True,
             "onReactionMessage": True,
             "onPollResponse": True,
             "onRevokedMessage": True,
             "onLabelUpdated": True,
             "onSelfMessage": True 
        }
    }
    
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        print(f"📡 Enviando POST para {url}...")
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        print(f"Status: {resp.status_code}")
        print(f"Response: {resp.text}")
        
        if resp.status_code == 200 or resp.status_code == 201:
            print("✅ Webhook configurado com sucesso!")
        else:
            print("⚠️ Falha ao configurar webhook. Tentando endpoint alternativo...")
            # Try set-webhook?
    except Exception as e:
        print(f"❌ Erro de conexão com WPPConnect: {e}")

if __name__ == "__main__":
    force_webhook()
