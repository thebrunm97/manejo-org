import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

def list_models():
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY not set.")
        return

    try:
        client = genai.Client(api_key=api_key)
        print("🔍 Modelos disponíveis no Google GenAI:")
        for model in client.models.list():
            print(f"- {model.name} (Methods: {model.supported_methods})")
    except Exception as e:
        print(f"❌ Erro ao listar modelos: {e}")

if __name__ == "__main__":
    list_models()
