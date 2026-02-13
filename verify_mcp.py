import subprocess
import json
import sys
import time
import os

def verify_mcp():
    # Use the manual path provided WITHOUT 'run' argument (it caused error)
    cmd = [r"C:\Python313\Scripts\notebooklm-mcp.exe"]
    
    print(f"Starting server with command: {' '.join(cmd)}")
    
    # Set env var if needed, though user said it's in default location
    env = os.environ.copy()
    # env["NOTEBOOKLM_MCP_AUTH_FILE"] = r"C:\Users\brunn\.notebooklm-mcp\auth.json"
    
    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            text=True,
            bufsize=1,
            env=env
        )
    except Exception as e:
        print(f"Failed to start process: {e}")
        return

    # JSON-RPC 2.0 initialization
    init_req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-client", "version": "1.0"}
        }
    }
    
    try:
        # Send Initialize
        print("Sending initialize...")
        process.stdin.write(json.dumps(init_req) + "\n")
        process.stdin.flush()
        
        # Read Initialize Response
        print("Waiting for response...")
        resp_line = process.stdout.readline()
        print(f"Received: {resp_line.strip()}")
        
        # Send Initialized Notification
        initialized_notif = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        process.stdin.write(json.dumps(initialized_notif) + "\n")
        process.stdin.flush()
        
        # 2. List Resources
        list_req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "resources/list",
            "params": {}
        }
        
        print("Sending resources/list...")
        process.stdin.write(json.dumps(list_req) + "\n")
        process.stdin.flush()
        
        # Read Response
        resp_line = process.stdout.readline()
        print(f"Received resources: {resp_line.strip()}")
        
        data = json.loads(resp_line)
        if "result" in data and "resources" in data["result"]:
            resources = data["result"]["resources"]
            print(f"Found {len(resources)} notebooks:")
            for res in resources:
                print(f"- {res.get('name', 'Unknown')} ({res.get('uri', 'No URI')})")
        else:
            print("No resources found or error in response.")
            
    except Exception as e:
        print(f"Error during communication: {e}")
    finally:
        process.terminate()

if __name__ == "__main__":
    verify_mcp()
