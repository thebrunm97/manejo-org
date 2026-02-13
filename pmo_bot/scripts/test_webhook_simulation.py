
import requests
import json
import time

URL = "http://localhost:5000/webhook?token=TY6oMv4d20a3"

payload = {
  "event": "onmessage",
  "from": "553499999999@c.us",
  "type": "chat",
  "fromMe": False,
  "id": "TestMsgID12345",
  "timestamp": int(time.time()),
  "body": "Plantei 50 mudas de alface no Talhão 1, canteiros 1 e 2",
  "sender": {
    "id": "553499999999@c.us",
    "name": "Tester"
  }
}

print(f"Sending payload to {URL}...")
try:
    resp = requests.post(URL, json=payload)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
