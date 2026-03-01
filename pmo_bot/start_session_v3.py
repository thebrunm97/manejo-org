import requests
import time
import os

from dotenv import load_dotenv

load_dotenv()

session_name = os.environ.get("WPP_SESSION", "agro_vivo")
secret_key = os.environ.get("WPP_SECRET_KEY")
webhook_token = os.environ.get("WPPCONNECT_TOKEN")
webhook_url = f"http://pmo-bot:5000/webhook?token={webhook_token}"

# 1. Generate Token
print(f"Generating token for session {session_name}...")
token_url = f"http://localhost:21465/api/{session_name}/{secret_key}/generate-token"
resp = requests.post(token_url)
resp_data = resp.json()

if 'token' not in resp_data:
    print(f"Failed to generate token: {resp_data}")
    exit(1)

token = resp_data['token']
print(f"Generated Token: {token}")

headers = {"Authorization": f"Bearer {token}"}

# 2. Start Session
url_start = f"http://localhost:21465/api/{session_name}/start-session"
print(f"Starting session at {url_start}...")
try:
    resp = requests.post(url_start, headers=headers, json={"webhook": webhook_url}, timeout=10)
    print(f"Start Response: {resp.status_code} - {resp.text}")
except Exception as e:
    print(f"Error starting: {e}")

# Wait a bit
time.sleep(2)

url_status = f"http://localhost:21465/api/{session_name}/status-session"

# Poll status for 30 seconds
print("Polling session status...")
for i in range(30):
    try:
        resp = requests.get(url_status, headers=headers, timeout=5)
        data = resp.json()
        status = data.get('status')
        qrcode = data.get('qrcode')
        print(f"[{i}s] Status: {status} | QrCode: {'YES' if qrcode else 'NO'}")
        
        if qrcode:
            print("✅ QR CODE GENERATED!")
            # Save to HTML for easy scanning
            html_content = f"""
            <html>
            <head><title>Scan QR Code</title></head>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#222;color:white;flex-direction:column;">
                <h1>Scan this Code</h1>
                <img src="{qrcode}" style="background:white;padding:20px;border-radius:10px;"/>
                <p>Status: {status}</p>
            </body>
            </html>
            """
            with open("latest_qrcode.html", "w") as f:
                f.write(html_content)
            print("✅ Saved to latest_qrcode.html")
            break
            
        if status == 'CONNECTED':
            print("✅ ALREADY CONNECTED!")
            break
            
    except Exception as e:
        print(f"Error polling: {e}")
    
    time.sleep(1)
