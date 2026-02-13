import sys
import os

# Ensure we can import from modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.ai_processor import validar_e_normalizar_json

def testar():
    print("🚀 Iniciando Teste de Tipagem Estrita...")
    
    # Caso 1: Manejo Sujo -> Limpeza Estrita
    entrada = { 
        "tipo_atividade": "manejo", 
        "produto": "alface", 
        "quantidade_unidade": "litros", 
        "detalhes_tecnicos": { "insumo": "Neem" } 
    }
    
    res = validar_e_normalizar_json(entrada)
    
    print(f"\n📊 Resultado Normalizado: {res}")

    # VERIFICAÇÕES
    # 1. Atividade deve ser Title Case ('Manejo')
    assert res['tipo_atividade'] == "Manejo", f"ERRO Atividade: {res['tipo_atividade']}"
    
    # 2. Unidade deve ser Enum ('L' e não 'litros')
    assert res['quantidade_unidade'] == "L", f"ERRO Unidade: {res['quantidade_unidade']}"
    
    # 3. Subtipo deve ser inferido e mapeado para Enum ('APLICACAO_INSUMO')
    # Nota: O teste original pedia "Aplicação de Insumos", mas o objetivo do hardening 
    # é justamente ter o Enum "APLICACAO_INSUMO". Ajustei a expectativa.
    subtipo_obtido = res['detalhes_tecnicos'].get('subtipo')
    assert subtipo_obtido == "APLICACAO_INSUMO", f"ERRO Subtipo: {subtipo_obtido}"
    
    print("\n✅ TODOS OS TESTES PASSARAM! O Backend está Hardened.")

if __name__ == "__main__":
    testar()
