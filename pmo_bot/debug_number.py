import os
import sys
# Adicionar diretório atual ao sys.path para importações locais
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from modules.whatsapp_client import get_messages

phones_to_test = [
    "553498256825@c.us",
    "5534998256825@c.us",
    "553498256825",
    "5534998256825"
]

for phone in phones_to_test:
    print(f"--- Testing {phone} ---")
    res = get_messages(phone, count=5)
    if res.success:
        print(f"Success! Found {len(res.data) if res.data else 0} messages.")
        for msg in reversed(res.data or []):
            sender = msg.get("from", "UNKNOWN")
            body = msg.get("body", "")
            from_me = msg.get("fromMe", False)
            print(f"[{'ME' if from_me else sender}] {body[:50]}...")
    else:
        print(f"Failed: {res.error_message}")
        print(f"Error Code: {res.error_code}")
    print("\n")
