import json
import subprocess
import sys
import os

def list_tools():
    print("\nListing Tools...")
    # Use the verified command
    cmd = [r"C:\Python313\python.exe", "-m", "notebooklm_mcp.server"]
    
    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr,
            text=True,
            bufsize=1
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
        process.stdin.write(json.dumps(init_req) + "\n")
        process.stdin.flush()
        
        # Read Initialize Response
        process.stdout.readline()
        
        # Send Initialized Notification
        initialized_notif = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }
        process.stdin.write(json.dumps(initialized_notif) + "\n")
        process.stdin.flush()
        
        # List Tools
        tools_req = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        }
        
        process.stdin.write(json.dumps(tools_req) + "\n")
        process.stdin.flush()
        
        # Read Response
        resp_line = process.stdout.readline()
        print(f"Received tools: {resp_line.strip()}")
            
    except Exception as e:
        print(f"Error during communication: {e}")
    finally:
        process.terminate()

if __name__ == "__main__":
    list_tools()
