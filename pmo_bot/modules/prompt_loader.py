import os
import json
from functools import lru_cache

PROMPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'prompts')

@lru_cache(maxsize=1)
def get_system_prompt() -> str:
    """
    Constructs the full system prompt from modular markdown files.
    Cached to avoid disk I/O on every request.
    """
    def read_file(filename):
        path = os.path.join(PROMPTS_DIR, filename)
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read().strip()
        except FileNotFoundError:
            return f"ERROR: File {filename} not found."

    core = read_file('core_instructions.md')
    intents = read_file('intents_definitions.md')
    rules = read_file('business_rules.md')
    schema = read_file('response_schema.json')
    examples = read_file('few_shot_examples.md')

    prompt = f"""
{core}

{intents}

{rules}

### SAÍDA JSON
{schema}

{examples}
"""
    return prompt

@lru_cache(maxsize=1)
def get_retry_correction_prompt() -> str:
    path = os.path.join(PROMPTS_DIR, 'retry_correction.md')
    with open(path, 'r', encoding='utf-8') as f:
        return f.read().strip()

@lru_cache(maxsize=1)
def get_minimal_prompt() -> str:
    path = os.path.join(PROMPTS_DIR, 'minimal_prompt.md')
    with open(path, 'r', encoding='utf-8') as f:
        return f.read().strip()

@lru_cache(maxsize=1)
def get_pmo_sections_registry() -> dict:
    path = os.path.join(PROMPTS_DIR, 'pmo_sections.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        # Convert keys to int/float where appropriate for strict compatibility
        # though usually string (json keys) is fine
        registry = {}
        for k, v in data.items():
            try:
                if '.' in k:
                    key = float(k)
                else:
                    key = int(k)
            except ValueError:
                key = k
            registry[key] = v
        return registry
