
import unittest
from unittest.mock import MagicMock, patch
import json
import os
import sys

# Ensure the pmo_bot directory is in the path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from modules import ai_processor

class TestComplianceFlow(unittest.TestCase):
    
    def setUp(self):
        # Setup specific mock for the LLM client
        self.mock_groq_client = MagicMock()
        self.mock_chat = self.mock_groq_client.chat.completions.create
        self.user_id = "user_123_test"

    def mock_llm_response(self, json_data):
        """Helper to configure the mock LLM to return specific JSON."""
        mock_response = MagicMock()
        # The AI processor expects response.choices[0].message.content
        mock_response.choices = [MagicMock()]
        mock_message = MagicMock()
        mock_message.content = f"```json\n{json.dumps(json_data)}\n```"
        mock_response.choices[0].message = mock_message
        self.mock_chat.return_value = mock_response

    # NOTE: We patch where the functions are USED, not where they are defined, 
    # because ai_processor imports them directly.
    @patch('modules.ai_processor.get_latest_pmo_id')
    @patch('modules.ai_processor.validar_insumo_pmo')
    @patch('modules.ai_processor.validar_regras_negocio')
    def test_insumo_proibido(self, mock_regras, mock_validar, mock_get_pmo):
        """
        Cenário: Insumo (Glifosato) não autorizado no planejamento.
        Esperado: Alerta no campo observacao_original.
        """
        # 0. Mock Regras de Negocio (Ignorar bloqueio legal)
        mock_regras.return_value = {"status": "OK", "alertas": []}

        # 1. Configurar Mocks DB
        mock_get_pmo.return_value = 101
        mock_validar.return_value = False # Insumo NÃO autorizado

        # 2. Configurar Resposta da IA (Entrada simulada)
        input_json = {
            "tipo_atividade": "Manejo",
            "produto": "GLIFOSATO",
            "detalhes_tecnicos": {
                "subtipo": "Aplicação de Insumos",
                "insumo": "Glifosato"
            }
        }
        self.mock_llm_response(input_json)

        # 3. Executar
        resultado = ai_processor.processar_ia(
            "Apliquei Glifosato no Tomate", 
            user_id=self.user_id, 
            client_groq=self.mock_groq_client
        )

        # 4. Asserts
        self.assertIsNotNone(resultado)
        self.assertEqual(resultado['status'], 'success')
        dados = resultado['data']
        print(f"\n[test_insumo_proibido] Obs gerada: {dados['observacao_original']}")
        
        # O sistema deve adicionar um alerta na observação
        self.assertTrue(
            "não consta no planejamento" in dados['observacao_original'] or 
            "⚠️" in dados['observacao_original'],
            "Deveria ter um alerta de insumo não autorizado"
        )
        # Verifica se chamou a validação com os parâmetros certos
        mock_validar.assert_called_with(101, "GLIFOSATO")

    @patch('modules.ai_processor.get_latest_pmo_id')
    @patch('modules.ai_processor.validar_insumo_pmo')
    @patch('modules.ai_processor.validar_regras_negocio')
    def test_insumo_permitido(self, mock_regras, mock_validar, mock_get_pmo):
        """
        Cenário: Insumo (Bokashi) autorizado.
        Esperado: Sem alertas de sistema.
        """
        # 0. Mock Regras
        mock_regras.return_value = {"status": "OK", "alertas": []}

        # 1. Configurar Mocks DB
        mock_get_pmo.return_value = 101
        mock_validar.return_value = True # Insumo autorizado

        # 2. Configurar Resposta da IA
        input_json = {
            "tipo_atividade": "Manejo",
            "produto": "BOKASHI",
            "detalhes_tecnicos": {
                "subtipo": "Aplicação de Insumos",
                "insumo": "Bokashi"
            }
        }
        self.mock_llm_response(input_json)

        # 3. Executar
        resultado = ai_processor.processar_ia(
            "Apliquei Bokashi",
            user_id=self.user_id,
            client_groq=self.mock_groq_client
        )

        # 4. Asserts
        self.assertEqual(resultado['status'], 'success')
        dados = resultado['data']
        print(f"\n[test_insumo_permitido] Obs gerada: {dados['observacao_original']}")
        self.assertNotIn("SISTEMA:", dados['observacao_original'])
        self.assertNotIn("⚠️", dados['observacao_original'])

    @patch('modules.ai_processor.get_latest_pmo_id')
    @patch('modules.ai_processor.get_talhao_status')
    @patch('modules.ai_processor.validar_regras_negocio')
    def test_talhao_irregular(self, mock_regras, mock_get_status, mock_get_pmo):
        """
        Cenário: Atividade em talhão 'Não Orgânico'.
        Esperado: Alerta sobre status do talhão.
        """
        # 0. Mock Regras
        mock_regras.return_value = {"status": "OK", "alertas": []}

        # 1. Configurar Mocks DB
        mock_get_pmo.return_value = 101
        mock_get_status.return_value = "Não Orgânico"

        # 2. Configurar Resposta da IA
        input_json = {
            "tipo_atividade": "Colheita",
            "produto": "TOMATE",
            "talhao_canteiro": "Talhão Z",
            "detalhes_tecnicos": {}
        }
        self.mock_llm_response(input_json)

        # 3. Executar
        resultado = ai_processor.processar_ia(
            "Colhi no Talhão Z",
            user_id=self.user_id,
            client_groq=self.mock_groq_client
        )

        # 4. Asserts
        self.assertEqual(resultado['status'], 'success')
        dados = resultado['data']
        print(f"\n[test_talhao_irregular] Obs gerada: {dados['observacao_original']}")
        
        self.assertTrue(
            "consta como 'Não Orgânico'" in dados['observacao_original'] or 
            "⚠️" in dados['observacao_original'],
            "Deveria avisar sobre talhão não orgânico"
        )
        mock_get_status.assert_called_with(101, "Talhão Z")

if __name__ == '__main__':
    unittest.main()
