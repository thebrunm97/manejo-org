import json
from pathlib import Path

def update_config():
    # Explicit path provided by user
    config_path = Path(r"C:\Users\brunn\.config\antigravity\mcp.json")
    
    print(f"Target config path: {config_path}")
    
    if config_path.exists():
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            print(f"Error reading existing config: {e}")
            return
    else:
        print("Config file not found.")
        return

    mcp_servers = data.get("mcpServers", {})
    
    # Update notebooklm with empty args (correct for stdio)
    if "notebooklm" in mcp_servers:
        mcp_servers["notebooklm"]["args"] = []
        print("Updated args to empty list")
    
    data["mcpServers"] = mcp_servers
    
    try:
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        print("Successfully updated mcp.json")
    except Exception as e:
        print(f"Error writing config: {e}")

if __name__ == "__main__":
    update_config()
