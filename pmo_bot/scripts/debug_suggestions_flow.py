import os
import json
import sys
from dotenv import load_dotenv
from supabase import create_client

# Locate .env file
current_dir = os.path.dirname(os.path.abspath(__file__))
pmo_bot_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(pmo_bot_dir) 

env_path = os.path.join(pmo_bot_dir, '.env')
if not os.path.exists(env_path):
    env_path = os.path.join(root_dir, '.env')

print(f"📂 Loading .env from: {env_path}")
load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_KEY not found.")
    sys.exit(1)

print(f"🔌 Connecting to Supabase...")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("\n🕵️  INVESTIGATION: Inspecting 'logs_treinamento' columns...")
try:
    # Fetch 1 record without ordering to avoid column error
    response = supabase.table("logs_treinamento")\
        .select("*")\
        .limit(1)\
        .execute()

    if not response.data:
        print("⚠️  Table 'logs_treinamento' is EMPTY.")
    else:
        record = response.data[0]
        print(f"✅ Found data. Valid Columns detected:")
        print(f"Keys: {list(record.keys())}")
        
        # Check specific columns
        has_created_at = 'created_at' in record
        has_processado = 'processado' in record
        
        print(f"\n- created_at: {'✅ Present' if has_created_at else '❌ MISSING'}")
        print(f"- processado: {'✅ Present' if has_processado else '❌ MISSING'}")

except Exception as e:
    print(f"❌ Error querying database: {e}")
