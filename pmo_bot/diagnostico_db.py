import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Carrega chaves
load_dotenv()
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")

if not url or not key:
    print("❌ Erro: .env não configurado corretamente.")
    exit()

supabase: Client = create_client(url, key)

def checar_tabela(nome_tabela):
    print(f"\n🔍 Verificando tabela: '{nome_tabela}'...")
    try:
        # Tenta pegar 1 item apenas para ler as chaves (colunas)
        response = supabase.table(nome_tabela).select("*").limit(1).execute()
        
        # Se a tabela existe mas está vazia, retorna lista vazia
        if response.data is not None:
            print(f"✅ Tabela EXISTE.")
            if len(response.data) > 0:
                colunas = list(response.data[0].keys())
                print(f"   📋 Colunas detectadas: {colunas}")
            else:
                print("   ⚠️ Tabela existe mas está VAZIA (não consigo ler colunas via API).")
        return True
    except Exception as e:
        # O Supabase geralmente retorna erro 404 ou 400 se a tabela não existir na API
        print(f"❌ Tabela NÃO encontrada ou inacessível.")
        print(f"   Erro detalhado: {str(e)}")
        return False

print("=== 🏥 DIAGNÓSTICO DO SUPABASE ===")

# 1. Verificar a tabela antiga de talhões
existe_antiga = checar_tabela("propriedade_talhoes")

# 2. Verificar se já existe a nova (vai que alguém criou...)
existe_nova = checar_tabela("talhoes")

# 3. Verificar canteiros
checar_tabela("canteiros")

print("\n=== FIM DO DIAGNÓSTICO ===")