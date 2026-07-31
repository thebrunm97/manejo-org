import os
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

key = os.getenv("OPENROUTER_API_KEY", "SUA_CHAVE_AQUI")
url = "https://openrouter.ai/api/v1/audio/speech"
headers = {
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}
data = {
    "model": "openai/tts-1",
    "input": "Hello world",
    "voice": "alloy",
    "response_format": "opus"
}
try:
    response = requests.post(url, headers=headers, json=data, verify=False)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        with open("test.opus", "wb") as f:
            f.write(response.content)
        with open("test.opus", "rb") as f:
            bytes_read = f.read(4)
            print(f"First 4 bytes: {bytes_read.hex().upper()} (ASCII: {bytes_read})")
    else:
        print(f"Error: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
