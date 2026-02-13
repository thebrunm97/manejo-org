
import os
import sys
import requests
from dotenv import load_dotenv

# Add parent directory to path to import modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import get_notification_service

def verify_wpp():
    load_dotenv()
    
    server_url = os.getenv("WPP_SERVER_URL", "http://localhost:21465")
    session = os.getenv("WPP_SESSION", "NERDWHATS_AMERICA")
    token = os.getenv("WPP_TOKEN")
    
    print(f"--- Configuration ---")
    print(f"URL: {server_url}")
    print(f"Session: {session}")
    print(f"Token: {token[:5]}...{token[-5:] if token else ''}" if token else "None")
    
    if not token:
        print("❌ Missing WPP_TOKEN text in .env")
        return

    # 1. Check Connection
    print("\n--- 1. Checking Connection Status (Direct HTTP) ---")
    status_url = f"{server_url}/api/{session}/check-connection-session"
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        print(f"GET {status_url}")
        # Note: WPPConnect usually wants the session in the path as /api/{session}/... 
        # But verify checking docs or previous code:
        # whatsapp_client.py: url = f"{config['server_url']}/api/{config['session']}{endpoint}"
        # So /check-connection-session becomes /api/{session}/check-connection-session
        
        response = requests.get(status_url, headers=headers, timeout=5)
        print(f"Status Code: {response.status_code}")
        try:
             print(f"Response: {response.json()}")
        except:
             print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            is_connected = False
            if isinstance(data, dict):
                 if data.get("status") == "connected" or data.get("success") or data.get("connected"):
                      is_connected = True
                 # Handle direct boolean True with message
                 if data.get("status") is True and data.get("message") == "Connected":
                      is_connected = True

                 if "response" in data and isinstance(data["response"], dict):
                      if data["response"].get("status") == "connected": 
                           is_connected = True
            
            if is_connected:
                print("✅ Connection Status: OK")
            else:
                print("⚠️ Connection Status: Not connected (Check QR Code)")
        else:
            print("❌ Connection Status: HTTP Error")
            
    except Exception as e:
        print(f"❌ Exception checking connection: {e}")

    # 2. Test NotificationService
    print("\n--- 2. Testing NotificationService (Backend Code) ---")
    try:
        service = get_notification_service()
        target_phone = "5531999999999@c.us" 
        
        print(f"Sending test message to {target_phone}...")
        result = service.send_text(target_phone, "Bot verified connectivity ✅")
        
        print(f"Result: {result}")
        if result.success:
             print("✅ NotificationService Send: OK")
             print(f"Message ID: {result.message_id}")
        else:
             print(f"❌ NotificationService Send: Failed - {result.error}")

    except Exception as e:
        print(f"❌ Exception testing NotificationService: {e}")

if __name__ == "__main__":
    verify_wpp()
