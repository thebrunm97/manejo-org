import json

# Validate chunks
chunks = json.load(open('scratch/portaria52_chunks.json', encoding='utf-8'))
print(f'Chunks: {len(chunks)} total')
ids = set(c['id'] for c in chunks)

# Validate dataset
dataset = json.load(open('scratch/dataset_dourado.json', encoding='utf-8'))
print(f'Dataset: {len(dataset)} perguntas')

# Cross-check
missing = []
for q in dataset:
    if q['chunk_esperado_id'] not in ids:
        missing.append(q['chunk_esperado_id'])

if missing:
    print(f'ERRO: IDs faltando nos chunks: {missing}')
else:
    print('OK: Todos os chunk_esperado_id existem nos chunks!')

# Show stats
tipos = {}
for c in chunks:
    t = c.get('tipo', '?')
    tipos[t] = tipos.get(t, 0) + 1
print(f'Tipos de chunks: {tipos}')

# Show first 5 questions
print('\nPrimeiras 5 perguntas do dataset:')
for i, q in enumerate(dataset[:5]):
    print(f'  [{i+1}] {q["pergunta"][:80]}...')
    print(f'       -> chunk: {q["chunk_esperado_id"]}')
