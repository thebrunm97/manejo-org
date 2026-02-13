
import requests
import json

def fetch_docs():
    try:
        # Try JSON doc
        resp = requests.get("http://wppconnect:21465/api-docs/json", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            # Filter paths for 'webhook'
            paths = [p for p in data.get('paths', {}).keys() if 'webhook' in p.lower() or 'sub' in p.lower()]
            print("Found Webhook Paths:")
            for p in paths:
                print(p)
        else:
            print(f"Failed to fetch docs: {resp.status_code}")
            
        # Also try to check session info
        resp2 = requests.get("http://wppconnect:21465/api/agro_vivo/status-session", 
                             headers={"Authorization": "Bearer " + "TY6oMv4d20a3"}, timeout=5)
        print("Session Status:", resp2.text)

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_docs()
