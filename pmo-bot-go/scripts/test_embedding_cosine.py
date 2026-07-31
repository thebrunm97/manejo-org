import requests
import numpy as np
import os

# Configuration
OLLAMA_URL = "http://localhost:11434/api/embeddings"
OPENROUTER_URL = "https://openrouter.ai/api/v1/embeddings"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "SUA_CHAVE_AQUI") # Pego do .env

phrases = [
    "Dose recomendada de fungicida para controle de requeima no tomate",
    "Manejo integrado de pragas em lavoura de soja transgênica",
    "Sintomas foliares de deficiência de nitrogênio no milho",
    "Época ideal para plantio de trigo na região sul do Brasil",
    "Rotação de culturas com aveia preta e azevém para adubação verde"
]

def get_ollama_embedding(text):
    try:
        response = requests.post(OLLAMA_URL, json={
            "model": "bge-m3",
            "prompt": text
        })
        response.raise_for_status()
        return np.array(response.json()["embedding"])
    except Exception as e:
        print(f"Ollama erro: {e}")
        return None

def get_openrouter_embedding(text):
    try:
        response = requests.post(OPENROUTER_URL, headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }, json={
            "model": "baai/bge-m3",
            "input": text
        })
        response.raise_for_status()
        data = response.json()
        return np.array(data["data"][0]["embedding"])
    except Exception as e:
        print(f"OpenRouter erro: {e}")
        if 'response' in locals():
            print(response.text)
        return None

def cosine_similarity(vec1, vec2):
    if vec1 is None or vec2 is None:
        return 0.0
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    return dot_product / (norm1 * norm2)

print("Iniciando Teste de Pooling: Ollama Local vs OpenRouter API")
print("-" * 60)

for i, phrase in enumerate(phrases, 1):
    print(f"\n[{i}/5] Extraindo: '{phrase}'")
    
    vec_ollama = get_ollama_embedding(phrase)
    vec_openrouter = get_openrouter_embedding(phrase)
    
    if vec_ollama is not None and vec_openrouter is not None:
        sim = cosine_similarity(vec_ollama, vec_openrouter)
        print(f"   => Similaridade de Cosseno: {sim:.4f}")
    else:
        print("   => Falha ao extrair um ou ambos os vetores.")

print("\n" + "-" * 60)
print("Teste finalizado.")
