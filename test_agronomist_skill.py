import json
import subprocess
import sys
import os

def test_skill():
    print("\nTesting Agronomist Consultant Skill...")
    cmd = [r"C:\Python313\python.exe", "-m", "notebooklm_mcp.server"]
    
    # Set environment variables
    env = os.environ.copy()
    env["NOTEBOOKLM_MCP_AUTH_FILE"] = r"C:\Users\brunn\.notebooklm-mcp\auth.json"
    
    try:
        process = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=sys.stderr, # PIPE stderr to see logs if needed
            text=True,
            bufsize=1,
            env=env
        )
    except Exception as e:
        print(f"Failed to start process: {e}")
        return

    # Initialize
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
        process.stdin.write(json.dumps(init_req) + "\n")
        process.stdin.flush()
        process.stdout.readline() # Init response
        
        process.stdin.write(json.dumps({
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
            "params": {}
        }) + "\n")
        process.stdin.flush()
        
        # List Resources to find the notebook
        print("Searching for 'ManejoORG - Especialista'...")
        process.stdin.write(json.dumps({
            "jsonrpc": "2.0",
            "id": 2,
            "method": "resources/list",
            "params": {}
        }) + "\n")
        process.stdin.flush()
        
        resp_line = process.stdout.readline()
        try:
            data = json.loads(resp_line)
        except json.JSONDecodeError:
            print(f"Failed to decode JSON: {resp_line}")
            return
            
        target_notebook_id = None
        if "result" in data and "resources" in data["result"]:
            resources = data["result"]["resources"]
            print(f"Total notebooks found: {len(resources)}")
            for res in resources:
                name = res.get('name', 'Unknown')
                print(f" - Found: '{name}'")
                if name.strip() == "ManejoORG - Especialista":
                    target_notebook_id = res.get("uri")
        else:
            print("No 'resources' found in response.")
            print(f"Full response data: {data}")
                    
        
        if not target_notebook_id:
            print("Notebook 'ManejoORG - Especialista' NOT FOUND in your account.")
        else:
            print(f"Found notebook! ID/URI: {target_notebook_id}")
            # Try to extract ID if it's a URI
            notebook_id = target_notebook_id
            if "notebooklm://" in target_notebook_id:
                # Example: notebooklm://notebook/123456...
                 parts = target_notebook_id.split("/")
                 if len(parts) > 0:
                     notebook_id = parts[-1] 
            
            print(f"Querying ID: {notebook_id}")
            
            query_req = {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "query_notebook",
                    "arguments": {
                        "notebook_id": notebook_id,
                        "query": "Summarize the key points of the Organic Law"
                    }
                }
            }
            process.stdin.write(json.dumps(query_req) + "\n")
            process.stdin.flush()
            
            query_resp = process.stdout.readline()
            print(f"Query Result: {query_resp}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        process.terminate()

if __name__ == "__main__":
    test_skill()
