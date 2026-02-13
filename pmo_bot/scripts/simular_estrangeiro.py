import requests
import json
import uuid
import time

# Configurações do seu bot
WEBHOOK_URL = "http://localhost:5000/webhook?token=TY6oMv4d20a3"

def testar_numero(telefone_id, corpo_mensagem="Olá, teste de número"):
    """
    Simula o recebimento de uma mensagem via WPPConnect
    """
    payload = {
        "event": "onmessage",
        "session": "agro_vivo",
        "id": f"false_{telefone_id}_{uuid.uuid4().hex[:10]}",
        "from": telefone_id,
        "fromMe": False,
        "chatId": telefone_id, # Importante: o fix usa o chatId como prioridade
        "body": corpo_mensagem,
        "type": "chat",
        "notifyName": "Teste Estrangeiro",
        "t": int(time.time()),
        "sender": {
            "id": telefone_id,
            "name": "Usuário Teste",
            "pushname": "Usuário Teste"
        }
    }

    print(f"\n🚀 Enviando teste para ID: {telefone_id}")
    try:
        response = requests.post(WEBHOOK_URL, json=payload, timeout=10)
        if response.status_code == 200:
            print(f"✅ Webhook aceitou a mensagem (Status 200)")
            print("👀 Agora olhe os LOGS do Docker para ver se ele tentou responder para o ID correto.")
        else:
            print(f"❌ Erro no Webhook: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Erro ao conectar no bot: {e}")

if __name__ == "__main__":
    # CASO 1: Número dos EUA (DDI +1)
    testar_numero("12025550123@c.us", "Como está o clima nos EUA?")

    # CASO 2: ID de dispositivo pareado (@lid) que estava falhando
    testar_numero("10857845141643@lid", "Teste de ID tipo LID")

    # CASO 3: Número de Portugal (DDI +351)
    testar_numero("351912345678@c.us", "Teste de Portugal")
