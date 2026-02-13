
import os
from dotenv import load_dotenv
from modules.whatsapp_client import _get_env_config, _generate_token_if_needed, check_connection

load_dotenv()

print("--- Debugging WhatsApp Client ---")
print(f"CWD: {os.getcwd()}")
print(f"Items in dir: {os.listdir('.')}")

config = _get_env_config()
print(f"Config Loaded: {config}")

print("\nAttempts to generate token...")
try:
    token = _generate_token_if_needed()
    print(f"Token Gen Result: {token}")
except Exception as e:
    print(f"Token Gen Failed: {e}")

print("\nChecking Connection...")
res = check_connection()
print(f"Connection Result: {res}")
