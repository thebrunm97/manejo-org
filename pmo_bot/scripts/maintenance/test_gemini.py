import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("❌ GOOGLE_API_KEY not found in environment variables.")
    exit(1)

genai.configure(api_key=api_key)

print("📋 Checking available models...")
try:
    found_any = False
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"✅ {model.name}")
            found_any = True
    
    if not found_any:
        print("⚠️ No models found with 'generateContent' capability.")

    # Test specific models regarding the user's request
    print("\n🧪 Testing specific generation...")
    test_models = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-pro"]
    
    for m in test_models:
        print(f"   Testing {m}...", end=" ")
        try:
            model = genai.GenerativeModel(m)
            response = model.generate_content("Hello")
            print(f"✅ OK")
        except Exception as e:
            print(f"❌ Failed: {str(e)[:100]}...")

except Exception as e:
    print(f"❌ Error listing models: {e}")
