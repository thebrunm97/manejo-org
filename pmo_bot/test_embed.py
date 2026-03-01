import os
import requests
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('GOOGLE_API_KEY')
if not api_key:
    print('No API key')
    exit(1)

model_name = "models/text-embedding-004"
url = f'https://generativelanguage.googleapis.com/v1beta/{model_name}:embedContent?key={api_key}'
data = {
    "model": model_name,
    "content": {
        "parts": [{"text": "Hello world"}]
    }
}
resp = requests.post(url, json=data)
print(resp.status_code)
print(resp.text)
