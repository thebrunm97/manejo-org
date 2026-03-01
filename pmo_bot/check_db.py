import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

def analyze_db():
    print("Iniciando busca por informações sobre 'cenoura' no Supabase...")
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    supabase: Client = create_client(url, key)
    
    # Busca 1: Todos os chunks que mencionem cenoura
    res = supabase.table("knowledge_chunks").select("chunk_index, content").ilike("content", "%cenoura%").execute()
    
    print(f"\nEncontrados {len(res.data)} chunks mencionando 'cenoura':")
    for row in res.data:
        print(f"\n--- CHUNK {row['chunk_index']} ---")
        print(row['content'])
        print("-" * 30)

if __name__ == "__main__":
    analyze_db()
