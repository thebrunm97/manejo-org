"""
test_alive.py - Connectivity test for Flask webhook
"""
import requests

WEBHOOK_URL = "http://localhost:5000/webhook"
# Use the token from .env
TOKEN = "TY6oMv4d20a3"

try:
    print(f"🔄 Testing POST to {WEBHOOK_URL}?token={TOKEN}...")
    r = requests.post(
        f"{WEBHOOK_URL}?token={TOKEN}",
        json={"test": "ping", "event": "status-find"},
        timeout=10
    )
    print(f"✅ Status: {r.status_code}")
    print(f"📦 Response: {r.text[:500]}")
except requests.exceptions.ConnectionError as e:
    print(f"❌ Connection Error: Flask não está acessível na porta 5000")
    print(f"   Detalhes: {e}")
except requests.exceptions.Timeout:
    print(f"❌ Timeout: Flask demorou mais de 10s para responder")
except Exception as e:
    print(f"❌ Erro inesperado: {type(e).__name__}: {e}")
