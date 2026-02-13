import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def find_and_upgrade():
    # Find free users with high daily usage
    res = supabase.table("profiles").select("*").gt("daily_request_count", 90).eq("plan_tier", "free").execute()
    
    users = res.data
    print(f"Found {len(users)} users nearing limit:")
    
    for u in users:
        print(f"- ID: {u.get('id')} | Name: {u.get('nome')} | Phone: {u.get('whatsapp')} | Usage: {u.get('daily_request_count')}/100")
        
        # Upgrade logic
        if u.get('daily_request_count') >= 100:
            print(f"  -> Upgrading {u.get('nome')} to PRO...")
            up = supabase.table("profiles").update({"plan_tier": "pro"}).eq("id", u.get('id')).execute()
            print("  ✅ Upgraded successfully!")

if __name__ == "__main__":
    find_and_upgrade()
