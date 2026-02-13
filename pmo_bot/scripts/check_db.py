import sys
import os
sys.path.append(os.getcwd())

from services.auth_service import AuthService
from modules.database import get_supabase_client

def check_data():
    with get_supabase_client() as supabase:
        print("--- Profiles ---")
        res = supabase.table("profiles").select("*").limit(5).execute()
        for p in res.data:
            print(p)
            
        print("\n--- PMOs ---")
        res2 = supabase.table("pmos").select("*").limit(5).execute()
        for p in res2.data:
            print(p)

if __name__ == "__main__":
    check_data()
