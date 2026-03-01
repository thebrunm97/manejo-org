import os, requests
from dotenv import load_dotenv
load_dotenv('.env')
key = os.getenv('GOOGLE_API_KEY')
r = requests.get(f'https://generativelanguage.googleapis.com/v1beta/models?key={key}')
if r.status_code == 200:
    for m in r.json().get('models', []):
        print(m['name'])
else:
    print(r.status_code, r.text)
