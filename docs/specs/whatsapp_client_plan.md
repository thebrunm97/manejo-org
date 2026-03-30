# 📱 Especificação: `whatsapp_client.py`

> Módulo centralizado para comunicação com o WPPConnect Server

---

## 📋 Resumo

Criar um módulo `pmo_bot/modules/whatsapp_client.py` que encapsula todas as chamadas HTTP ao WPPConnect Server, substituindo as chamadas diretas feitas atualmente em `webhook.py`.

---

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `WPP_TOKEN` | Token JWT de autenticação | `eyJ...` |
| `WPP_SERVER_URL` | URL base do servidor WPPConnect | `http://localhost:21465` |
| `WPP_SESSION` | Nome da sessão ativa | `NERDWHATS_AMERICA` |

> [!IMPORTANT]
> A constante `SESSION_NAME` atualmente está hardcoded em `webhook.py`. Será migrada para variável de ambiente `WPP_SESSION` para maior flexibilidade.

---

## 🏗️ Interface do Módulo

### Funções Públicas

```python
# pmo_bot/modules/whatsapp_client.py

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

@dataclass
class WppResponse:
    """Resposta padronizada do cliente WPPConnect"""
    success: bool
    data: Optional[dict] = None
    error_code: Optional[str] = None  # "TIMEOUT", "AUTH_ERROR", "SERVER_ERROR", "NETWORK_ERROR"
    error_message: Optional[str] = None


def check_connection() -> WppResponse:
    """
    Verifica se a sessão WPPConnect está ativa e conectada.
    
    Returns:
        WppResponse com success=True se conectado, False caso contrário.
    """
    pass


def send_text(phone: str, message: str) -> WppResponse:
    """
    Envia mensagem de texto para um número de telefone.
    
    Args:
        phone: ID do WhatsApp (ex: 5511999999999@c.us)
        message: Texto da mensagem
        
    Returns:
        WppResponse com resultado da operação.
    """
    pass


def download_media(message_id: str, save_path: Path) -> WppResponse:
    """
    Baixa mídia de uma mensagem específica e salva localmente.
    
    Args:
        message_id: ID da mensagem contendo mídia
        save_path: Caminho completo onde salvar o arquivo
        
    Returns:
        WppResponse com success=True se baixou, data contém {"file_path": str}
    """
    pass
```

---

## ⚠️ Tratamento de Erros

| Cenário | HTTP Status | `error_code` | Ação no `webhook.py` |
|---------|-------------|--------------|----------------------|
| Timeout (>10s) | — | `TIMEOUT` | Log + Retry silencioso (1x) |
| Token inválido | 401 | `AUTH_ERROR` | Log crítico, **não** responde ao usuário |
| Erro no servidor WPP | 500 | `SERVER_ERROR` | Log + Mensagem genérica ao usuário |
| Conexão recusada | — | `NETWORK_ERROR` | Log crítico, **não** responde ao usuário |
| Sucesso | 200/201 | `None` | Continua fluxo normal |

### Exemplo de Uso no `webhook.py`

```python
from modules.whatsapp_client import send_text, download_media, WppResponse

# Enviar mensagem
result = send_text(sender, "✅ Registro salvo!")
if not result.success:
    print(f"❌ Falha ao enviar: {result.error_code} - {result.error_message}")
    # Não tenta novamente se for AUTH_ERROR

# Baixar áudio
audio_path = Path(f"temp_{msg_id}.ogg")
result = download_media(msg_id, audio_path)
if result.success:
    # Processa o arquivo em result.data["file_path"]
    pass
```

---

## 📍 Pontos de Modificação em `webhook.py`

| Linha | Código Atual | Código Novo |
|-------|--------------|-------------|
| 26-27 | `WPP_SERVER_URL = "..."`, `SESSION_NAME = "..."` | **Remover** (movido para o módulo) |
| 36-60 | `def enviar_resposta_wpp(...)` | **Remover** (usar `send_text()`) |
| 75-97 | `def baixar_audio_wppconnect(...)` | **Remover** (usar `download_media()`) |
| 183, 194, 216, 230, 272, 277 | Chamadas a `enviar_resposta_wpp(...)` | Substituir por `send_text(...)` |
| 200 | `baixar_audio_wppconnect(msg_id)` | Substituir por `download_media(...)` |

---

## 📦 Fases de Implementação

### Fase 1: Criar Módulo Base

**Arquivos criados:**
- `pmo_bot/modules/whatsapp_client.py`
- `pmo_bot/tests/test_whatsapp_client.py`

**Tarefas:**
1. Criar dataclass `WppResponse`
2. Implementar `_get_config()` para carregar variáveis de ambiente
3. Implementar `_make_request()` interno com retry e tratamento de erros
4. Implementar `check_connection()` usando endpoint `/api/{session}/check-connection-session`
5. Implementar `send_text()` usando endpoint `/api/{session}/send-message`
6. Implementar `download_media()` usando endpoint `/api/{session}/get-media-by-message/{id}`

**Testes:**
```bash
# Executar testes unitários
cd pmo_bot
python -m pytest tests/test_whatsapp_client.py -v
```

---

### Fase 2: Migrar `webhook.py`

**Arquivos modificados:**
- `pmo_bot/webhook.py`
- `pmo_bot/.env` (adicionar `WPP_SESSION`)

**Tarefas:**
1. Adicionar `WPP_SESSION=NERDWHATS_AMERICA` ao `.env`
2. Adicionar import: `from modules.whatsapp_client import send_text, download_media`
3. Remover constantes `WPP_SERVER_URL` e `SESSION_NAME`
4. Remover função `enviar_resposta_wpp()`
5. Remover função `baixar_audio_wppconnect()`
6. Substituir todas as chamadas por funções do módulo
7. Atualizar tratamento de retorno para usar `WppResponse`

**Teste de integração:**
```bash
# Iniciar WPPConnect Server
cd pmo_bot/wppconnect-server && npm run dev

# Em outro terminal, testar bot
cd pmo_bot && python test_whatsapp_client.py  # Script de teste rápido
```

---

### Fase 3: Limpeza Final

**Arquivos modificados:**
- `pmo_bot/webhook.py` (revisão final)
- `pmo_bot/_ANTIGOS/pegar_senha.py` (avaliar migração ou manter como utilitário)

**Tarefas:**
1. Revisar e remover imports não utilizados (`requests` se não usado em outro lugar)
2. Atualizar docstrings do `webhook.py`
3. Mover `pegar_senha.py` para `scripts/` ou adicionar função `generate_token()` ao módulo
4. Atualizar documentação em `pmo_bot/docs/integration_contracts.md`

---

## 📂 Estrutura Final

```
pmo_bot/
├── modules/
│   ├── __init__.py
│   ├── whatsapp_client.py  # [NOVO]
│   ├── ai_processor.py
│   ├── database_handlers.py
│   ├── business_rules.py
│   └── prompts.py
├── tests/                   # [NOVO diretório]
│   └── test_whatsapp_client.py
├── webhook.py              # [MODIFICADO - mais limpo]
└── .env                    # [MODIFICADO - nova var WPP_SESSION]
```

---

## ✅ Critérios de Aceitação

- [ ] Módulo `whatsapp_client.py` implementado com as 3 funções públicas
- [ ] Todos os erros HTTP tratados com `WppResponse` estruturado
- [ ] Zero chamadas diretas a `requests` em `webhook.py` para WPPConnect
- [ ] Variáveis de ambiente documentadas e utilizadas
- [ ] Testes básicos passando
- [ ] Bot continua funcionando normalmente após migração

---

**Autor:** Claude | **Data:** Janeiro 2026
