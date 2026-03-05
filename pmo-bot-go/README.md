# ManejoORG PMO Bot (Go Engine)

🚀 **v1.0.0-beta.2** (Stable Release)

O ManejoORG Bot é a evolução de alta performance do sistema legado em Python, reescrito 100% em **Golang** seguindo os preceitos táticos da arquitetura "Golang Guerrilha" (Desacoplamento, Baixa Memória, Concorrência).

## 🏗️ Arquitetura (FSM)

O coração do bot é a **FSM (Finite State Machine)** em `internal/state/fsm.go`. Ela orquestra as interações entre os componentes isolados, garantindo previsibilidade e evitando side-effects durante o fluxo assíncrono do WhatsApp.

### Componentes Principais:
1. **Webhook Injetor (`gin`)**: Recebe payloads do WPPConnect.
2. **Orquestrador FSM**: Avalia o estado atual do usuário e transita entre Extração, Validação e Interceptadores Curtos (`/saldo`, `CONECTAR`).
3. **Módulo de Mídia (Hands-Free Pipeline)**:
   - **Inbound**: Transcreve PTTs (Push-To-Talk) rurais via **Groq Whisper** (`whisper-large-v3-turbo`).
   - **Outbound**: Gera feedback de áudio localmente via TTS Fallback (`pt-BR-AnaNeural` -> Google Translate TTS -> Texto).
4. **Módulo RAG (Gemini)**: Recuperação e análise documental em PDF hospedada no Google.
5. **Módulo Supabase**: Persistência tipada e segura (`caderno_campo`, `profiles`, `logs`, `canteiros`). Interações N:N e UUIDs robustos.

## ⚙️ Stack Tecnológica

- **Código:** Go 1.22+
- **API Web:** Gin Gonic
- **Integração WhatsApp:** WPPConnect Server (API REST / Base64 Data URI)
- **Banco de Dados:** Supabase (PostgreSQL + PostgREST)
- **LLMs:** Groq (STT Rápido / JSON Extraction) & Gemini (RAG Long Context)

## 🛡️ Sistema de Quotas
- Gerenciamento *in-memory* com reset diário inteligente guiado pelas colunas `daily_request_count`, `plan_tier` e `last_usage_date` da tabela de `profiles`.
- Limite Free: 100 créditos diários (Desconto de 5 moedas para texto e 15 para áudio).

## 🚀 Como Iniciar

1. Clone o repositório.
2. Defina as credenciais em `.env`.
3. Rode `go mod tidy`
4. Levante a stack: `docker-compose up --build -d`
