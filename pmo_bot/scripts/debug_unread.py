import requests
import os
from dotenv import load_dotenv

load_dotenv()

SERVER_URL = os.getenv("WPP_SERVER_URL", "http://wppconnect:21465")
SESSION = os.getenv("WPP_SESSION", "agro_vivo")
SECRET_KEY = os.getenv("WPP_SECRET_KEY")

def get_token():
    url = f"{SERVER_URL}/api/{SESSION}/{SECRET_KEY}/generate-token"
    print(f"🔑 Generating Token... {url}")
    try:
        resp = requests.post(url, timeout=5)
        if resp.status_code == 201:
            return resp.json().get('token')
        else:
            print(f"❌ Token Gen Error: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"❌ Token Gen Exception: {e}")
    return None

def check_unread():
    token = get_token()
    if not token:
        return

    url = f"{SERVER_URL}/api/{SESSION}/all-unread-messages"
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"🔍 Querying: {url}")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Raw Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"✅ Unread Messages Count: {len(data)}")
                for msg in data:
                    print(f" - From: {msg.get('from')} | ID: {msg.get('id')}")
            else:
                print(f"⚠️ Response is not a list: {type(data)}")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_unread()
