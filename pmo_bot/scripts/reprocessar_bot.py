import requests
import json
import os
from dotenv import load_dotenv

# Carrega variáveis do .env do bot se existir localmente
load_dotenv()

SERVER_URL = "http://localhost:5000"
# Se não achar no ENV, usa o token padrão que vimos ser o do usuário
TOKEN = os.getenv("WPPCONNECT_TOKEN", "TY6oMv4d20a3")

def reprocessar(telefone, limite=1):
    """
    Força o bot a reprocessar as últimas N mensagens de um chat.
    """
    url = f"{SERVER_URL}/reprocess"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }
    payload = {
        "phone": telefone,
        "limit": limite
    }
    
    print(f"🔄 Solicitando reprocessamento para {telefone} (Últimas {limite} msgs)...")
    
    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=15)
        
        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Sucesso! Processadas: {data.get('processed')} mensagens.")
        else:
            print(f"❌ Erro {resp.status_code}: {resp.text}")
            
    except Exception as e:
        print(f"❌ Falha na conexão: {e}")
        print(f"   Certifique-se que o pmo-bot está rodando na porta 5000.")

if __name__ == "__main__":
    import sys
    
    # Uso via linha de comando ou interativo
    if len(sys.argv) > 1:
        phone = sys.argv[1]
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        reprocessar(phone, limit)
    else:
        print("--- Ferramenta de Reprocessamento Manual ---")
        phone = input("Digite o número (com ou sem @c.us ou @lid): ").strip()
        if phone:
            # Auto-suffix check
            if "@" not in phone:
                 if len(phone) > 13:
                     phone = f"{phone}@lid"
                     print(f"ℹ️ Detectado ID longo (>13), usando sufixo @lid: {phone}")
                 else:
                     phone = f"{phone}@c.us"
                     print(f"ℹ️ Detectado número padrão, usando sufixo @c.us: {phone}")
                     
            reprocessar(phone, limite=2)
