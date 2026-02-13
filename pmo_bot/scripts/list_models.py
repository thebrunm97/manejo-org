
import os
from google import genai

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("❌ No API Key")
    exit(1)

client = genai.Client(api_key=api_key)

print("🔍 Listing Models...")
try:
    # SDK v1 (latest) uses different methods, let's try standard list
    # client.models.list() returns an iterator
    for m in client.models.list():
        print(f"Model: {m.name}")
except Exception as e:
    print(f"❌ Error: {e}")
