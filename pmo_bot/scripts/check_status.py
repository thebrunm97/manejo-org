
import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.whatsapp_client import check_connection

print("--- STATUS CHECK ---")
res = check_connection()
print(f"Success: {res.success}")
if res.data:
    print(json.dumps(res.data, indent=2))
else:
    print(f"Error: {res.error_message}")
print("--- END ---")
