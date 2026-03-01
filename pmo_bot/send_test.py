import os
import requests
from dotenv import load_dotenv

load_dotenv()
WPP_SESSION = os.getenv("WPP_SESSION", "agro_vivo")
WPP_URL = "http://localhost:21465"

# Get token
token_url = f"{WPP_URL}/api/{WPP_SESSION}/1AbRJh6y78FPWuE/generate-token"
t_resp = requests.post(token_url)
token = t_resp.json().get('token')
headers = {"Authorization": f"Bearer {token}"}

phone = "553498256825"
message = "Olá! Identificamos uma instabilidade com seu número no nosso sistema. Este é um teste automático do Suporte. Você está recebendo essa mensagem?"

url = f"{WPP_URL}/api/{WPP_SESSION}/send-message"
payload = {
    "phone": phone,
    "message": message,
    "isGroup": False
}
print(f"--- Sending Message to {phone} ---")
resp = requests.post(url, headers=headers, json=payload)
print(resp.status_code, resp.json())
