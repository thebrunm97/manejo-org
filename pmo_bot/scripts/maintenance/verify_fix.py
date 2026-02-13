
import os
import sys
import re
import logging

# Configuração de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("TestFix")

# Mock das funções para não precisar de DB real
# Vamos testar a lógica de regex e fluxo, sem insert real

def mock_get_supabase_client():
    class MockClient:
        def __enter__(self): return self
        def __exit__(self, exc_type, exc_val, exc_tb): pass
        def table(self, name): return self
        def select(self, *args, **kwargs): return self
        def eq(self, *args, **kwargs): return self
        def ilike(self, *args, **kwargs): return self
        def execute(self):
            # Mock responses
            return type('obj', (object,), {'data': []})
    return MockClient()

# Importar o módulo a ser testado
sys.path.append(os.getcwd())
# Vamos redeclarar as funções críticas AQUI para testar a lógica ISOLADAMENTE
# ou importar se conseguirmos mockar o DB. 
# Como o arquivo original tem imports de DB globais, melhor copiar a lógica de regex para teste unitário
# ou tentar importar e mockar.

# Tentar importar aplicando patch no get_supabase_client seria ideal, mas complexo sem framework.
# Vamos testar AS REGEXES usadas no código modificado.

def test_normalization_regex(texto):
    print(f"Testing Normalization Regex on: '{texto}'")
    # O regex novo no código
    match = re.search(r'canteiros?\s+([\d\s,e]+)', texto, re.IGNORECASE)
    if match:
        resultado = match.group(1).strip()
        print(f"CAPTURED: '{resultado}'")
        return resultado
    else:
        print("NO MATCH")
        return None

def test_extraction_regex(texto_raw):
    print(f"Testing Extraction Regex on RAW: '{texto_raw}'")
    # O regex novo no código de extração
    match_lote = re.search(r'canteiros?\s+([\d\s,e]+)', texto_raw, re.IGNORECASE)
    
    numeros_encontrados = []
    if match_lote:
        parte_numeros = match_lote.group(1).replace(' e ', ',')
        candidatos = [n.strip() for n in parte_numeros.split(',') if n.strip().isdigit()]
        numeros_encontrados.extend(candidatos)
    else:
         match_single = re.search(r'canteiro\s*(\d+)', texto_raw, re.IGNORECASE)
         if match_single:
             numeros_encontrados.append(match_single.group(1))
    
    numeros_encontrados = list(set(numeros_encontrados))
    print(f"EXTRACTED IDs: {numeros_encontrados}")
    return numeros_encontrados

if __name__ == "__main__":
    print("=== VERIFICATION SCRIPT ===")
    
    scenarios = [
        "Talhão 1, Canteiros 2 e 3",
        "Talhão 1, Canteiros 2, 3 e 4",
        "No Canteiro 5 do Talhão 2",
        "Talhão 1, Canteiro 10",
        "Talhão 1, canteiros 1 e 2"
    ]
    
    print("\n--- 1. Testing Normalization Regex (Should capture the list string) ---")
    for s in scenarios:
        test_normalization_regex(s)
        
    print("\n--- 2. Testing ID Extraction Logic (Should parse individual numbers) ---")
    for s in scenarios:
        test_extraction_regex(s)

    print("\n=== CONCLUSION ===")
    print("If 'EXTRACTED IDs' contains all numbers for 'Canteiros 2 e 3' (['2', '3']), the fix is WORKING.")
