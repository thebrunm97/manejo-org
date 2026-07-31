import json

with open('scratch/benchmark_results.json', 'r', encoding='utf-8') as f:
    res = json.load(f)

with open('scratch/portaria52_chunks.json', 'r', encoding='utf-8') as f:
    chunks = {c['id']: c for c in json.load(f)}

discrepancies = []
for d in res['details']:
    if d.get('bge_m3_hit1') and not d.get('gemini_hit1'):
        discrepancies.append(d)

for i, d in enumerate(discrepancies, 1):
    q = d['pergunta']
    exp = d['chunk_esperado']
    bge = d['bge_m3_top1_chunk']
    gem = d['gemini_top1_chunk']
    
    bge_text = chunks.get(bge, {}).get('text', 'NOT FOUND')[:200].replace('\n', ' ')
    gem_text = chunks.get(gem, {}).get('text', 'NOT FOUND')[:200].replace('\n', ' ')
    exp_text = chunks.get(exp, {}).get('text', 'NOT FOUND')[:200].replace('\n', ' ')
    
    print(f"--- Discrepância {i} ---")
    print(f"Pergunta: {q}")
    print(f"Esperado: {exp} -> {exp_text}...")
    print(f"BGE-M3 (ID {bge}): {bge_text}...")
    print(f"Gemini (ID {gem}): {gem_text}...")
    print("")
