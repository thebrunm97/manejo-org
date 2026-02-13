
import sys
import os

# Add the current directory to sys.path so we can import modules
sys.path.append(os.getcwd())

from modules.ai_processor import processar_ia, validar_e_normalizar_json

# Mock input data that simulates what IA would produce for Glifosato
mock_ia_data = {
    "tipo_atividade": "Insumo",
    "produto": "GLIFOSATO",
    "quantidade_valor": 5,
    "quantidade_unidade": "L",
    "detalhes_tecnicos": {
        "subtipo": "Aplicacao de Insumos"
    }
}

print("--- Testing processar_ia RETURN STRUCTURE (Simulated) ---")
# We can't easily run full processar_ia without API key and real text,
# but we can simulate the internal flow by running normalizing+blocking check manually
# or simply ensuring the function signature matches our expectation.

# Let's test `validar_e_normalizar_json` first to ensure it still produces the block dict
result_norm = validar_e_normalizar_json(mock_ia_data)
print("Normalized Result:", result_norm)

if result_norm.get("_bloqueio"):
    print("✅ Normalizer correctly inferred blocking.")
    
    # Now verify if the AI processor wrapper (if we could run it) would handle this.
    # Since we modified the code, we manually inspect the logic:
    # if data.get("_bloqueio") -> returns {status: blocked, message: ...}
    
    expected_structure = {
        "status": "blocked",
        "message": result_norm["_bloqueio"],
        "data": result_norm
    }
    print(f"EXPECTED STRUCTURE: {expected_structure['status']}")
else:
    print("❌ Normalizer FAILED to infer blocking.")

# Verify webhook.py syntax (simple import check)
try:
    import webhook
    print("✅ Webhook module imported successfully (Syntax OK).")
except ImportError as e:
    print(f"❌ Webhook module import FAILED: {e}")
except Exception as e:
    print(f"❌ Webhook module syntax error or other issue: {e}")
