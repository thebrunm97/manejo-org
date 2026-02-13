import os
import sys
import logging
import random
from dotenv import load_dotenv

# Garantir que conseguimos importar o modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules.database_handlers import inserir_no_caderno_campo, supabase

# Configuração de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("TEST_MAPA")

def test_mapa():
    """
    Script de teste para validar a Inteligência Espacial
    """
    logger.info("🗺️ Iniciando teste de Inteligência Espacial...")
    
    # 1. Buscar um PMO e um talhão existentes para o teste ser realista
    try:
        # Pega o primeiro talhão que encontrar
        res = supabase.table("talhoes").select("id, nome, pmo_id").limit(1).execute()
        
        if not res.data:
            logger.warning("⚠️ Nenhum talhão encontrado no banco. Criando um fictício se possível ou abortando.")
            # Se não tiver talhão, não dá pra testar a associação.
            # Vamos tentar usar um PMO ID fixo se solicitado, mas melhor abortar.
            logger.error("❌ Abortando teste: Tabela 'talhoes' está vazia.")
            return

        talhao_real = res.data[0]
        pmo_id_teste = talhao_real["pmo_id"]
        nome_talhao = talhao_real["nome"]
        id_talhao_esperado = talhao_real["id"]
        
        logger.info(f"🔎 Alvo do teste: PMO_ID={pmo_id_teste} | Talhão='{nome_talhao}' (ID={id_talhao_esperado})")

        # 2. Simular Payload
        # Vamos criar uma frase que contenha o nome do talhão
        frase_teste = f"Realizei uma poda de limpeza no {nome_talhao} hoje cedo"
        
        payload = {
            "pmo_id": pmo_id_teste,
            "talhao_canteiro": frase_teste, # O texto onde a IA deve achar o local
            "tipo_atividade": "Manejo",
            "produto": "TESTE_BOT_GPS",
            "quantidade_valor": 100,
            "quantidade_unidade": "unidade",
            "observacao_original": "Teste automatizado do script test_mapa.py"
        }
        
        logger.info(f"📤 Enviando payload: {payload}")
        
        # 3. Chamar a função
        id_registro = inserir_no_caderno_campo(payload)
        
        if id_registro:
            logger.info(f"✅ Registro inserido com sucesso! ID: {id_registro}")
            
            # 4. Verificar se o talhao_id foi vinculado corretamente
            check = supabase.table("caderno_campo").select("talhao_id, talhao_canteiro").eq("id", id_registro).single().execute()
            
            if check.data:
                vinculo = check.data.get("talhao_id")
                local_gravado = check.data.get("talhao_canteiro")
                
                logger.info(f"📝 Verificação no Banco: talhao_id={vinculo} | Texto='{local_gravado}'")
                
                if vinculo == id_talhao_esperado:
                    logger.info("🌟 SUCESSO TOTAL! O bot identificou o talhão corretamente pelo nome.")
                else:
                    logger.error(f"❌ FALHA DE VÍNCULO. Esperado: {id_talhao_esperado}, Gravado: {vinculo}")
            else:
                logger.error("❌ Não foi possível ler o registro gravado.")
                
        else:
            logger.error("❌ A função inserir_no_caderno_campo retornou None.")
            
    except Exception as e:
        logger.error(f"💥 Erro durante o teste: {e}", exc_info=True)

if __name__ == "__main__":
    test_mapa()
