import json
from pathlib import Path

def update_config():
    # Explicit path provided by user
    config_path = Path(r"C:\Users\brunn\.config\antigravity\mcp.json")
    
    print(f"Target config path: {config_path}")
    
    # Ensure directory exists
    config_path.parent.mkdir(parents=True, exist_ok=True)
    
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading existing config: {e}")
            data = {"mcpServers": {}}
    else:
        print("Config file not found, creating new one.")
        data = {"mcpServers": {}}

    mcp_servers = data.get("mcpServers", {})
    
    # Add notebooklm with manual path
    # User specified: C:\Python313\Scripts\notebooklm-mcp.exe
    # Arguments: run
    mcp_servers["notebooklm"] = {
        "command": r"C:\Python313\Scripts\notebooklm-mcp.exe",
        "args": [], 
        "env": {}
    }
    
    data["mcpServers"] = mcp_servers
    
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Successfully updated mcp.json")
    except Exception as e:
        print(f"Error writing config: {e}")

if __name__ == "__main__":
    update_config()
