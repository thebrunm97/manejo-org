import requests
import os
from dotenv import load_dotenv

load_dotenv()

URL = "http://localhost:21465/api/agro_vivo/status-session"
KEY = os.getenv("WPP_SECRET_KEY")

print(f"--- Iniciando Diagnóstico de Autenticação ---")
print(f"Chave utilizada: {KEY}\n")

# Teste 1: Header 'key'
try:
    print("[Teste 1] Tentando com header 'key' (Descontinuado)...")
    r1 = requests.get(URL, headers={"key": KEY})
    print(f"Resultado: {r1.status_code}")
except Exception as e: 
    print(f"Erro no Teste 1: {e}")
    r1 = type('obj', (object,), {'status_code': 500})

# Teste 2: Authorization com Token Gerado (Fluxo Correto)
try:
    print("\n[Teste 2] Gerando Token JWT via API...")
    # URL para gerar token: /api/:session/:secret/generate-token
    GEN_TOKEN_URL = f"http://localhost:21465/api/agro_vivo/{KEY}/generate-token"
    
    r_gen = requests.post(GEN_TOKEN_URL)
    
    if r_gen.status_code == 201:
        token = r_gen.json().get('token')
        print(f"✅ Token gerado com sucesso!")
        
        print("\n[Teste 2b] Validando Token no Status da Sessão...")
        r2 = requests.get(URL, headers={"Authorization": f"Bearer {token}"})
        print(f"Resultado: {r2.status_code}")
        if r2.status_code == 200:
            print(f"Status: {r2.json()}")
    else:
        print(f"❌ Falha ao gerar token: {r_gen.status_code} - {r_gen.text}")
        r2 = r_gen

except Exception as e: 
    print(f"Erro no Teste 2: {e}")
    r2 = type('obj', (object,), {'status_code': 500})

if r2.status_code == 200:
    print("\n✅ SOLUÇÃO CONFIRMADA: O servidor exige geração de token.")
    print("Use o fluxo: POST /generate-token -> Authorization: Bearer <token>")
else:
    print("\n❌ AINDA FALHANDO. Verifique logs do container.")
