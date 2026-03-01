import os
import requests
from dotenv import load_dotenv

load_dotenv()
WPP_SESSION = os.getenv("WPP_SESSION", "agro_vivo")
WPP_URL = "http://localhost:21465"
# Get token first
token_url = f"{WPP_URL}/api/{WPP_SESSION}/1AbRJh6y78FPWuE/generate-token"
t_resp = requests.post(token_url)
token = t_resp.json().get('token')
headers = {"Authorization": f"Bearer {token}"}

phones_to_test = [
    "553498256825",
    "5534998256825"
]

for phone in phones_to_test:
    url = f"{WPP_URL}/api/{WPP_SESSION}/check-number-status/{phone}"
    resp = requests.get(url, headers=headers)
    print(f"--- Checking {phone} ---")
    print(resp.status_code, resp.json())
