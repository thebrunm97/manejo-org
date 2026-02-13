
import sys
sys.path.append("/app") # Add root to path
import logging
from modules.whatsapp_client import send_text

logging.basicConfig(level=logging.INFO)

def check_conn():
    PHONE = "553497317545@c.us" # Bruno's phone
    print(f"🏥 Health Check: Pingando {PHONE}...")
    
    try:
        res = send_text(PHONE, "✅ Health Check: Bot está online e enviando.")
        if res.success:
            print("✅ Sucesso! Envio funcionando.")
        else:
            print(f"❌ Falha no envio: {res.error}")
    except Exception as e:
        print(f"❌ Exceção Crítica: {e}")

if __name__ == "__main__":
    check_conn()
