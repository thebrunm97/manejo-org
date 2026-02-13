
import os
import sys
# Add root to path so we can import things if needed, but here we use simple supabase client
sys.path.append("/app")

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL:
    print("❌ ENV missing")
    sys.exit(1)

client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_users():
    print("🔍 Buscando Brunos...")
    res = client.table("profiles").select("*").ilike("nome", "%Bruno%").execute()
    
    if not res.data:
        print("❌ Nenhum Bruno encontrado.")
    
    for u in res.data:
        print(f"👤 Nome: {u.get('nome')} | Tel: {u.get('telefone')} | ID: {u.get('id')}")

if __name__ == "__main__":
    check_users()
