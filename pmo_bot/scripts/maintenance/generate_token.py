import requests

secret_key = "TY6oMv4d20a3"
session = "agro_vivo"
url = f"http://localhost:21465/api/{session}/{secret_key}/generate-token"

try:
    print(f"Generating token from {url}...")
    response = requests.post(url, timeout=5)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
