# ManejoORG PMO Bot (Go Engine)

🚀 **v1.0.0-beta.3** (Stable Release)

O ManejoORG Bot é a evolução de alta performance do sistema legado em Python, reescrito 100% em **Golang** seguindo os preceitos táticos da arquitetura "Golang Guerrilha" (Desacoplamento, Baixa Memória, Concorrência).

## 🏗️ Arquitetura (FSM & Workers)

O coração do bot é a **FSM (Finite State Machine)** em `internal/state/fsm.go`, que orquestra as interações e o estado dos usuários no fluxo do WhatsApp. 

### Componentes Principais:
1. **Webhook Injetor (`gin`)**: Recebe payloads da Evolution API na rota `/webhook/evolution`.
2. **Orquestrador FSM**: Avalia o estado atual do usuário e transita entre os fluxos (ex: Onboarding Simplificado, Extração, Interceptadores Curtos).
3. **Módulo de Mídia (Hands-Free Pipeline)**:
   - **Inbound**: Transcreve PTTs (Push-To-Talk) rurais via **Groq Whisper** (`whisper-large-v3-turbo`).
   - **Outbound**: Gera feedback de áudio localmente via TTS Híbrido (Piper / Google Translate).
4. **Módulo RAG (Gemini/OpenRouter)**: Recuperação e análise documental.
5. **Harness (Processamento em Fila)**: Através da flag `HARNESS_ENABLED=true`, utiliza uma fila no PostgreSQL gerenciada por workers (Media Workers & AI Workers) para concorrência resiliente.
6. **Guardrails & HITL**: Avaliador determinístico, logger de violações e Human-In-The-Loop (`HITL`) para interceptar ações destrutivas ou finalizações de onboarding (ex: confirmações de "Sim").

## ⚙️ Stack Tecnológica

- **Código:** Go 1.22+
- **API Web:** Gin Gonic
- **Integração WhatsApp:** Evolution API
- **Banco de Dados / Fila:** Supabase (PostgreSQL + PostgREST)
- **LLMs:** Groq (Whisper/JSON) & Gemini/OpenRouter (RAG e Agentes)

## 🛡️ Fluxo de Onboarding
- **Onboarding Simplificado:** O usuário recém-chegado é questionado apenas sobre o **Nome**.
- Após a extração via Groq e a confirmação via webhook (HITL), o sistema invoca a RPC `create_basic_profile` alocando-o na tabela `profiles` com `role='user'`.

## 🚀 Como Iniciar

1. Clone o repositório.
2. Configure o `.env` (use `.env.example` como base).
3. Baixe as dependências: `go mod tidy`
4. Suba a infraestrutura: `docker-compose up --build -d`

## 🧪 Como Testar o Webhook Localmente

Para simular uma mensagem sem precisar do WhatsApp, você pode bater na rota local do webhook usando o payload padrão da Evolution API:

```bash
curl -X POST "http://localhost:8080/webhook/evolution?token=SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "messages.upsert",
    "instance": "pmo-instance-dev",
    "data": {
      "key": {
        "remoteJid": "5511999999999@s.whatsapp.net",
        "fromMe": false,
        "id": "MSG_TESTE_001"
      },
      "pushName": "Teste",
      "message": {
        "conversation": "Oi, tudo bem?"
      }
    }
  }'
```
