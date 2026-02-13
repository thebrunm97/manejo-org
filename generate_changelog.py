
import re
from datetime import datetime
import subprocess

def parse_line(line):
    parts = line.strip().split('|')
    if len(parts) < 3: return None
    hash_id = parts[0]
    date_str = parts[1]
    msg = parts[2]
    return {'hash': hash_id, 'date': date_str, 'msg': msg}

def categorize(msg):
    lower_msg = msg.lower()
    if lower_msg.startswith('feat'): return 'New'
    if lower_msg.startswith('fix'): return 'Fixes'
    if lower_msg.startswith('refactor') or 'ux' in lower_msg or 'improve' in lower_msg: return 'Improvements'
    if lower_msg.startswith('perf'): return 'Improvements'
    if 'ajuste' in lower_msg: return 'Patches'
    if 'corrige' in lower_msg: return 'Fixes'
    if 'adiciona' in lower_msg or 'novo' in lower_msg: return 'New'
    return None # Ignore chore, docs, style, etc mostly

def clean_msg(msg):
    # Remove prefix like "feat(ui): " or "fix: "
    cleaned = re.sub(r'^(feat|fix|refactor|chore|style|docs|test|perf|ci)(\([a-z0-9\-_]+\))?:\s*', '', msg, flags=re.IGNORECASE)
    return cleaned.capitalize()

def get_version(date_str):
    date = datetime.strptime(date_str, '%Y-%m-%d')
    if date >= datetime(2026, 1, 24): return ('2.2.0', '26 de Janeiro, 2026', 'Atualizações de IA & Dashboard')
    if date >= datetime(2026, 1, 19): return ('2.1.0', '23 de Janeiro, 2026', 'Migração TypeScript & Clean Arch')
    if date >= datetime(2026, 1, 14): return ('2.0.0', '19 de Janeiro, 2026', 'Novo Sistema de Rastreabilidade')
    if date >= datetime(2026, 1, 1): return ('1.5.0', '13 de Janeiro, 2026', 'Refatoração da Interface')
    if date >= datetime(2025, 12, 1): return ('1.1.0', '18 de Dezembro, 2025', 'Gestão de Propriedade')
    return ('1.0.0', '06 de Outubro, 2025', 'Lançamento Inicial')

entries = []

# Get log directly
try:
    # Force utf-8 encoding for git output
    raw_log = subprocess.check_output(
        ['git', 'log', '--pretty=format:%h|%ad|%s', '--date=short'], 
        encoding='utf-8', 
        errors='replace'
    )
    lines = raw_log.splitlines()
except Exception as e:
    print(f"Error getting git log: {e}")
    lines = []

for line in lines:
    data = parse_line(line)
    if not data: continue
    
    category = categorize(data['msg'])
    if not category: continue
    
    version, date_display, title = get_version(data['date'])
    
    # Find or create version entry
    entry = next((e for e in entries if e['version'] == version), None)
    if not entry:
        entry = {
            'version': version,
            'date': date_display,
            'title': title,
            'description': 'Atualizações e melhorias na plataforma.',
            'sections': {}
        }
        entries.append(entry)
        
    # Add item to section
    if category not in entry['sections']:
        entry['sections'][category] = []
    
    cleaned = clean_msg(data['msg'])
    if cleaned not in entry['sections'][category]:
            entry['sections'][category].append(cleaned)

# Format as TS
ts_output = """export interface ChangelogEntry {
    version: string;
    date: string;
    title: string;
    description: string;
    sections: {
        type: 'Improvements' | 'Fixes' | 'Patches' | 'New';
        items: string[];
    }[];
}

export const changelogData: ChangelogEntry[] = [
"""

for entry in entries:
    ts_output += "    {\n"
    ts_output += f'        version: "{entry["version"]}",\n'
    ts_output += f'        date: "{entry["date"]}",\n'
    ts_output += f'        title: "{entry["title"]}",\n'
    ts_output += f'        description: "{entry["description"]}",\n'
    ts_output += "        sections: [\n"
    for cat in ['New', 'Improvements', 'Fixes', 'Patches']:
        if cat in entry['sections'] and entry['sections'][cat]:
            ts_output += "            {\n"
            ts_output += f'                type: "{cat}",\n'
            ts_output += "                items: [\n"
            for item in entry['sections'][cat]:
                    # Escape quotes just in case
                    safe_item = item.replace('"', '\\"')
                    ts_output += f'                    "{safe_item}",\n'
            ts_output += "                ]\n"
            ts_output += "            },\n"
    ts_output += "        ]\n"
    ts_output += "    },\n"

ts_output += "];\n"

# Write to file
try:
    with open('pmo-frontend/src/data/changelog.ts', 'w', encoding='utf-8') as f:
        f.write(ts_output)
    print("Successfully wrote changelog.ts")
except Exception as e:
    print(f"Error writing file: {e}")
