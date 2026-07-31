import json
import re

with open('pmo-bot-go/internal/mcp/tools_registry.go', 'r', encoding='utf-8') as f:
    content = f.read()

# very basic parser for properties and required.
# Actually, since it's Go code, let's just use regex to find tools.
tool_blocks = content.split('Name:')
for block in tool_blocks[1:]:
    name_match = re.search(r'^\s*"([^"]+)"', block)
    if not name_match: continue
    name = name_match.group(1)
    
    props_match = re.search(r'"properties":\s*map\[string\]interface\{\}\{(.*?)\n\t\t\t\},', block, re.DOTALL)
    props = []
    if props_match:
        props = re.findall(r'"([^"]+)":\s*map\[string\]', props_match.group(1))
    
    req_match = re.search(r'"required":\s*\[\]string\{([^}]+)\}', block)
    reqs = []
    if req_match:
        req_str = req_match.group(1)
        reqs = re.findall(r'"([^"]+)"', req_str)
        
    missing = [r for r in reqs if r not in props]
    if missing:
        print(f"Tool: {name} is missing properties for required fields: {missing}")
