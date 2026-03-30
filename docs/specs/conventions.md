# 📐 Convenções de Código - PMO Bot

> Padrões e estrutura para desenvolvimento Python

---

## 🏗️ Estrutura de Módulos

```
pmo_bot/
├── webhook.py              # Entry point (Flask app)
├── parsing.py              # 🆕 Parsing centralizado (quantidades, unidades, datas)
├── modules/
│   ├── __init__.py         # Obrigatório para imports
│   ├── ai_processor.py     # Processamento IA
│   ├── database_handlers.py # Operações Supabase
│   ├── business_rules.py   # Regras de negócio
│   ├── migration_utils.py  # Migração de dados legados
│   ├── whatsapp_client.py  # Cliente HTTP WPPConnect
│   └── prompts.py          # System prompts
├── models/                 # 🆕 Pydantic models
│   ├── __init__.py
│   ├── whatsapp.py         # WhatsAppInboundMessage
│   └── records.py          # PlantioRecord, ManejoRecord, ColheitaRecord
├── services/               # 🆕 Abstração de serviços
│   ├── __init__.py         # Factory get_notification_service()
│   ├── notification_service.py  # ABC NotificationService
│   └── wppconnect_adapter.py    # Implementação WPPConnect
├── docs/                   # Documentação
└── tests/                  # Testes (206 testes)
```

### Responsabilidade de Cada Módulo

| Arquivo | Responsabilidade |
|---------|------------------|
| `webhook.py` | Receber HTTP, orquestrar fluxo, enviar respostas via NotificationService |
| `parsing.py` | 🆕 Funções puras: `parse_quantity()`, `normalize_unit()`, `parse_date_br()`, `sanitize_string()` |
| `ai_processor.py` | Chamar Groq, parsear JSON, normalizar dados (usa `parsing.py`) |
| `database_handlers.py` | CRUD Supabase, buscar contexto |
| `business_rules.py` | Validar Lei 10.831, gerar alertas |
| `models/` | 🆕 Pydantic schemas: `WhatsAppInboundMessage`, `PlantioRecord`, etc. |
| `services/` | 🆕 Abstração de notificações: `NotificationService` (ABC) + adapters |
| `prompts.py` | Manter prompts versionados |

---

## 🐍 Convenções Python

### Estilo de Código

- **PEP 8** como base
- **Indentação**: 4 espaços
- **Linha máxima**: 120 caracteres
- **Encoding**: UTF-8

### Imports

```python
# 1. Bibliotecas padrão
import os
import json
from datetime import datetime

# 2. Bibliotecas externas
from flask import Flask, request, jsonify
from groq import Groq
from supabase import create_client
from pydantic import ValidationError

# 3. Módulos internos - parsing centralizado
from parsing import parse_float_br, normalize_unit, parse_date_br

# 4. Módulos internos - models e services
from models.whatsapp import WhatsAppInboundMessage
from services import get_notification_service

# 5. Módulos internos - lógica de negócio
from modules.ai_processor import processar_ia
from modules.database_handlers import inserir_no_caderno_campo
```

### Nomenclatura

```python
# Variáveis e funções: snake_case
dados_usuario = {}
def processar_mensagem(): ...

# Constantes: UPPER_SNAKE_CASE
PRODUTOS_PROIBIDOS = ["GLIFOSATO", ...]
WPP_SERVER_URL = "http://localhost:21465"

# Classes: PascalCase (se houver)
class ManejoValidator: ...
```

### Type Hints

```python
from typing import Dict, Any, Optional, List

def processar_ia(texto: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Processa texto e retorna dados estruturados."""
    ...

def buscar_id_talhao(pmo_id: int, texto_local: str) -> Optional[int]:
    ...
```

---

## 📝 Docstrings

Usar formato Google-style:

```python
def sincronizar_secao_8(supabase_inst, pmo_id: int, dados_ia: Dict) -> bool:
    """
    Sincroniza dados de insumos na Seção 8 do PMO.
    
    Args:
        supabase_inst: Cliente Supabase (ou None para usar global)
        pmo_id: ID do Plano de Manejo
        dados_ia: Dicionário com dados extraídos pela IA
            - produto: Nome do produto (str)
            - talhao_canteiro: Localização (str)
            - quantidade_valor: Valor numérico (float)
    
    Returns:
        True se sincronização bem-sucedida
    
    Raises:
        ValueError: Se pmo_id inválido
    """
```

---

## 🔒 Tratamento de Erros

### Padrão try/except

```python
def buscar_usuario_por_telefone(telefone: str) -> Optional[Dict]:
    """Busca usuário pelo telefone."""
    try:
        res = supabase.table("profiles").select("id, nome").eq("telefone", telefone).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return None
    except Exception as e:
        print(f"❌ Erro ao buscar usuário no banco: {e}")
        return None
```

### Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Uso
logger.info(f"📍 Localização identificada: '{nome}' (ID: {id})")
logger.error(f"❌ Erro no Caderno: {str(e)}", exc_info=True)
```

### Emojis de Log

| Emoji | Significado |
|-------|-------------|
| 🚀 | Startup/Inicialização |
| 📤 | Envio de dados |
| 📥 | Recebimento de dados |
| ✅ | Sucesso |
| ❌ | Erro |
| ⚠️ | Aviso/Alerta |
| 🤖 | Processamento IA |
| 💾 | Operação de banco |
| 📍 | Localização |
| 🔑 | Autenticação |
| 🛡️ | Validação/Compliance |
| ⛔ | Bloqueio |

---

## 🆕 Criando Novos Fluxos

### Template para Nova Atividade

1. **Adicionar tipo no prompt** (`prompts.py`):
```python
SYSTEM_PROMPT = """
...
### 1. CLASSIFICAÇÃO (ActivityType)
- 'NovoTipo': Descrição do que significa
...
"""
```

2. **Mapear no normalizador** (`ai_processor.py`):
```python
mapa_atividades = {
    "novo_verbo": "NovoTipo",
    ...
}
```

3. **Criar handler de banco** (`database_handlers.py`):
```python
def sincronizar_novo_tipo(supabase_inst, pmo_id: int, dados_ia: Dict) -> bool:
    """Sincroniza dados do novo tipo."""
    client = supabase_inst if supabase_inst else supabase
    try:
        # 1. Buscar form_data atual
        resp = client.table("pmos").select("form_data").eq("id", pmo_id).single().execute()
        form_data = resp.data.get("form_data") or {}
        
        # 2. Preparar novo item
        novo_item = {
            "id": str(uuid.uuid4()),
            "campo": dados_ia.get("campo", "default"),
            # ...
        }
        
        # 3. Adicionar na seção correta
        secao = garantir_chaves(form_data, ["secao_X", "sub_secao"])
        if "lista" not in secao:
            secao["lista"] = []
        secao["lista"].append(novo_item)
        
        # 4. Salvar
        client.table("pmos").update({"form_data": form_data}).eq("id", pmo_id).execute()
        return True
        
    except Exception as e:
        logger.error(f"❌ Erro Novo Tipo: {e}")
        return False
```

4. **Rotear no webhook** (`webhook.py`):
```python
elif tipo == 'NovoTipo':
    sincronizar_novo_tipo(supabase, pmo_id, dados)
```

---

## ⚙️ Variáveis de Ambiente

Usar `python-dotenv`:

```python
# No início do arquivo
from dotenv import load_dotenv
load_dotenv()

# Carregar variáveis
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")

# Validar obrigatórias
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ Configure SUPABASE_URL e SUPABASE_KEY no .env")
```

---

## 🧪 Testes

> **206 testes implementados!**

### Estrutura Atual

```
pmo_bot/
├── tests/
│   ├── __init__.py
│   ├── test_parsing.py              # 66 testes - parsing.py
│   ├── test_models_records.py       # 24 testes - Pydantic models
│   ├── test_notification_service.py # 16 testes - NotificationService
│   ├── test_webhook_integration.py  # 7 testes - webhook.py
│   ├── test_ai_processor_integration.py # 14 testes - ai_processor.py
│   ├── test_whatsapp_client.py      # 21 testes - whatsapp_client.py
│   ├── test_migration_utils.py      # 29 testes - migration_utils.py
│   ├── test_ai_retry.py             # 18 testes - retry logic
│   └── test_talhao_normalization.py # 9 testes - talhao normalization
```

### Executar Testes

```bash
cd pmo_bot
python -m pytest tests/ -v
# ou com cobertura:
python -m pytest tests/ --cov=. --cov-report=term-missing
```

### Template de Teste

```python
import pytest
from unittest.mock import patch, MagicMock
from modules.business_rules import validar_regras_negocio

def test_bloqueio_glifosato():
    """Deve bloquear registro com Glifosato."""
    dados = {
        "produto": "GLIFOSATO",
        "tipo_atividade": "Insumo"
    }
    resultado = validar_regras_negocio(dados)
    
    assert resultado["status"] == "BLOQUEADO"
    assert "proibidas" in resultado["mensagem"]

@patch('modules.ai_processor.validar_regras_negocio')
def test_with_mock(mock_rules):
    """Teste com mock."""
    mock_rules.return_value = {"status": "OK", "alertas": []}
    # ...
```

---

## 📦 Dependências

`requirements.txt`:
```
flask>=2.0.0
groq>=0.4.0
supabase>=2.0.0
python-dotenv>=1.0.0
pytz>=2024.1
requests>=2.31.0
pydantic>=2.0.0
pytest
pytest-cov
```

**Instalação**:
```bash
pip install -r requirements.txt
```

---

## 🚀 Execução

### Desenvolvimento
```bash
cd pmo_bot
python webhook.py
# Servidor em http://localhost:5000
```

### Produção (Futuro)
```bash
gunicorn -w 4 -b 0.0.0.0:5000 webhook:app
```

---

**Última atualização**: Janeiro 2026
