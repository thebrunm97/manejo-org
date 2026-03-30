# 🔐 Variáveis de Ambiente (Secrets)

Este documento centraliza todas as configurações necessárias para rodar o ecossistema ManejoORG.

---

## ⚙️ Backend (`pmo-bot-go`)
Localização: `pmo-bot-go/.env`

| Variável | Descrição | Exemplo/Valor |
|---|---|---|
| `SUPABASE_URL` | Endpoint da sua instância Supabase | `https://xyz.supabase.co` |
| `SUPABASE_KEY` | Service Role Key (para bypass de RLS se necessário) | `eyJh...` |
| `GROQ_API_KEY` | Chave para modelos Llama 3 (Whisper/STT) | `gsk_...` |
| `GEMINI_API_KEY` | Chave para o motor de IA principal | `AIza...` |
| `GEMINI_MODEL` | Versão do modelo Gemini | `gemini-2.0-flash` |
| `WPPCONNECT_URL` | URL do serviço gateway de WhatsApp | `http://wppconnect:21465` |
| `WPPCONNECT_TOKEN` | Secret compartilhado com o WPPConnect | `MY_SECRET_TOKEN` |
| `WPP_SESSION` | Nome da sessão no WhatsApp Web | `pmo-session` |
| `WEBHOOK_URL` | URL onde o bot receberá mensagens | `https://seu-dominio.com/webhook` |
| `GIN_MODE` | Modo do framework Gin | `release` ou `debug` |
| `WEATHER_API_KEY` | Chave para integração de clima (OpenWeather) | `12345...` |
| `GEMINI_API_VERSION` | Versão da API (padrão v1beta) | `v1beta` |
| `SUPABASE_SERVICE_ROLE_KEY` | Key de serviço usada no knowledge_loader | Mesma que `SUPABASE_KEY` |
| `MOCK_WHATSAPP` | Ativa simulação do WhatsApp (testes) | `true` ou `false` |

---

## 🖥️ Frontend (`pmo-frontend`)
Localização: `pmo-frontend/.env`

> [!IMPORTANT]
> No Vite, variáveis devem começar com `VITE_` para serem expostas ao client-side.

| Variável | Descrição | Valor Sugerido |
|---|---|---|
| `VITE_APP_NAME` | Nome exibido na interface e PWA | `ManejoORG` |
| `VITE_SUPABASE_URL` | URL do Supabase para o client | Mesma do backend |
| `VITE_SUPABASE_ANON_KEY` | Chave Anon do Supabase | `eyJh...` (Anon Key) |
| `VITE_BOT_API_URL` | URL base da API do Bot Go | `http://localhost:8080` |
| `VITE_BOT_API_TOKEN` | Token de segurança para chamadas Frontend -> Bot | `shared_secret_token` |
| `VITE_WHATSAPP_BOT_NUMBER` | Número oficial do bot (para links de ajuda) | `55349...` |

---

## 🏗️ Infraestrutura (Docker)
Localização: `pmo_bot/.env` (opcional, se usar centralizado)

No `docker-compose.yml`, as variáveis são passadas via `environment:`. Recomenda-se usar um arquivo `.env` na raiz da pasta de deploy para facilitar a gestão.

---

## 📋 Template para Copiar (`.env.example`)

```bash
# SUPABASE
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# AI ENGINES
GEMINI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_API_VERSION=v1beta
GROQ_API_KEY=your-groq-key

# WHATSAPP GATEWAY
WPPCONNECT_URL=http://localhost:21465
WPPCONNECT_TOKEN=your-secret-token
WPP_SESSION=pmo-bot
MOCK_WHATSAPP=false

# APP CONFIG
PORT=8080
GIN_MODE=release
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_APP_NAME=ManejoORG
VITE_BOT_API_URL=http://localhost:8080
VITE_BOT_API_TOKEN=your-secret-token
```
