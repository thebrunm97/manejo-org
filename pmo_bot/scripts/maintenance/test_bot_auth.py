
import unittest
from unittest.mock import patch, MagicMock
import os
import sys

# Adiciona o diretório atual ao path para importar modules
sys.path.append(os.getcwd())

from modules.whatsapp_client import _generate_token_if_needed, _force_refresh_token, _make_request, WppResponse, check_connection

class TestBotAuth(unittest.TestCase):

    def setUp(self):
        # Limpa token a cada teste
        _force_refresh_token()
        os.environ["WPP_SECRET_KEY"] = "mock_secret"
        os.environ["WPP_SESSION"] = "mock_session"
        os.environ["WPP_SERVER_URL"] = "http://mock-server"
        # Limpa token estático se houver
        if "WPP_TOKEN" in os.environ:
            del os.environ["WPP_TOKEN"]

    @patch('modules.whatsapp_client.requests.post')
    def test_generate_token_success(self, mock_post):
        # Mock da resposta de geração de token
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"token": "dynamic_token_123"}
        mock_post.return_value = mock_response

        token = _generate_token_if_needed()
        
        self.assertEqual(token, "dynamic_token_123")
        # Verifica se chamou a URL correta
        mock_post.assert_called_with(
            "http://mock-server/api/mock_session/mock_secret/generate-token",
            timeout=5
        )

    @patch('modules.whatsapp_client.requests.post')
    @patch('modules.whatsapp_client.requests.get')
    def test_auto_refresh_on_401(self, mock_get, mock_post):
        # Mock geração de token
        mock_post.return_value.status_code = 201
        mock_post.return_value.json.return_value = {"token": "new_token"}

        # Define comportamento do GET: primeiro 401, depois 200
        response_401 = MagicMock()
        response_401.status_code = 401
        response_401.text = "Unauthorized"

        response_200 = MagicMock()
        response_200.status_code = 200
        response_200.json.return_value = {"status": "success"}

        mock_get.side_effect = [response_401, response_200]

        # Executa request
        result = _make_request("GET", "/test-endpoint")

        self.assertTrue(result.success)
        # Deve ter tentado gerar token novamente
        self.assertTrue(mock_post.called)
        # Deve ter chamado GET duas vezes
        self.assertEqual(mock_get.call_count, 2)

    def test_live_connection(self):
        """Teste real de conexão (requer servidor rodando)"""
        if os.getenv("SKIP_LIVE_TEST"):
            print("Skipping live test")
            return

        print("\n--- Live Connection Test ---")
        # Usa .env real se disponível
        from dotenv import load_dotenv
        load_dotenv()
        
        try:
            result = check_connection()
            if result.success:
                print(f"✅ Live Connection Success: {result.data}")
            else:
                print(f"❌ Live Connection Failed: {result.error_code} - {result.error_message}")
                self.fail("Live connection failed")
        except Exception as e:
                print(f"❌ Exception in live test: {e}")
                self.fail(f"Exception: {e}")

if __name__ == '__main__':
    unittest.main()
