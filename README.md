# 🌿 PMO – Assistente de Manejo Orgânico (SaaS)

Plataforma integrada de inteligência artificial para auxílio no manejo orgânico, conectando **WhatsApp** (Bot), **Supabase** (Backend/Dados) e um **Dashboard Administrativo** moderno.

---

## 📐 Arquitetura

```
┌─────────────┐       ┌───────────────┐       ┌─────────┐
│  WhatsApp   │──────▶│  WPPConnect   │──────▶│ FastAPI  │
│  (Produtor) │◀──────│  Server       │  wh   │ Webhook  │
└─────────────┘       └───────────────┘       └────┬─────┘
                                                   │ enqueue
                                              ┌────▼─────┐
                                              │  Redis    │
                                              │  (Queue)  │
                                              └────┬─────┘
                                                   │ dequeue
                                              ┌────▼──────────┐
                                              │  arq Worker    │
                                              │ (LangGraph AI) │
                                              └────┬──────────┘
                                                   │ read/write
                                              ┌────▼─────┐
                                              │ Supabase │
                                              │ (Postgres)│
                                              └────┬─────┘
                                                   │
                                              ┌────▼───────────┐
                                              │  Dashboard     │
                                              │  React + MUI   │
                                              │  (Vercel)      │
                                              └────────────────┘
```

---

## 🚀 Funcionalidades Principais

### 🤖 Bot de WhatsApp (IA + WPPConnect)

| Feature | Descrição |
|---|---|
| **Consultoria Agronômica** | Responde dúvidas técnicas (ex: "Como combater pulgão no tomate?") priorizando manejo orgânico, via agente especialista com RAG. |
| **Registro de Campo** | Entende áudios/textos operacionais (ex: "Apliquei 20ml de óleo de neem no canteiro 3") e salva estruturado no Caderno de Campo. |
| **Extração Inteligente** | Identifica atividade, produto, quantidade, unidade, canteiros (N:N) e observações usando LangGraph com Structured Output (Pydantic). |
| **Validação Orgânica** | Nó de compliance verifica se o insumo/prática é permitida em manejo orgânico antes de registrar. |
| **Onboarding Automático** | Identifica usuários novos e envia mensagem de boas-vindas com orientações de cadastro. |
| **Comando de Conexão** | Vínculo seguro entre WhatsApp e conta Web via `CONECTAR <CODIGO>`. |
| **Comandos do Sistema** | `/saldo`, `/planos`, `/usar <ID>`, `/ajuda` — processados sem custo de IA. |
| **Controle de Créditos** | Sistema de quota (Free/Pro) com custo diferenciado para texto (5) e áudio (15). |
| **TTL de Mensagens** | Descarta mensagens com mais de 10 minutos para evitar reprocessamento após restarts. |
| **Watchdog** | Rotina de saúde periódica que monitora o estado do bot a cada 60s. |

### 📊 Dashboard Web (React + MUI)

| Feature | Descrição |
|---|---|
| **Visão Geral** | Dashboard com métricas (MetricCard), atividades recentes e plano ativo. |
| **Caderno de Campo** | Diário completo com tabela avançada (FieldDiaryTableV2), filtros e detalhes. |
| **Planos de Manejo** | CRUD completo de PMOs com formulário multi-seção (PmoForm). |
| **Mapa da Propriedade** | Visualização geográfica com Leaflet (desenho de talhões, cálculo de área). |
| **Minhas Culturas** | Gestão de culturas cadastradas. |
| **Registro Manual** | Dialog para inserir atividades manualmente (ManualRecordDialog). |
| **Conexão WhatsApp** | Dialog para vincular número via código (WhatsappConnectDialog). |
| **Admin Dashboard** | Painel admin com auditoria de tokens da IA, inputs vs. outputs, player de áudio. |
| **PWA** | Instalável como app mobile (vite-plugin-pwa). |
| **Offline Sync** | Hook `useCadernoSync` para sincronização de dados offline (IndexedDB via `idb`). |

---

## 🛠️ Stack Tecnológica

### Backend (Bot)
| Tecnologia | Uso |
|---|---|
| **Python 3.10** | Linguagem principal do bot |
| **FastAPI + Uvicorn** | Webhook HTTP (substituiu Flask) |
| **arq + Redis** | Fila de tarefas assíncrona (desacopla webhook do pipeline de IA) |
| **LangGraph + LangChain** | Grafo de agentes com nós: Interpreter → Router → Specialist/Compliance → Execution |
| **Google Gemini** | LLM principal para texto/lógica (via `google-genai` + `langchain-google-genai`) |
| **Groq API** | LLM fallback ultrarrápido (Llama-3/Mixtral) com circuit breaker automático |
| **Supabase** | PostgreSQL, Auth, Storage |
| **Pydantic v2** | Validação de dados e Structured Output da IA |
| **APScheduler** | Tarefas periódicas (watchdog, limpeza de cache) |

### Frontend (Dashboard)
| Tecnologia | Uso |
|---|---|
| **React 19** | Framework UI |
| **TypeScript** | Tipagem estática |
| **Material UI (MUI) v5** | Design system e componentes |
| **Vite** | Build tool |
| **Recharts** | Gráficos e visualizações |
| **Leaflet** | Mapas interativos (desenho de polígonos com `leaflet-draw`) |
| **Supabase JS v2** | Client para Auth, DB e Storage |
| **React Router v7** | Roteamento SPA |
| **Zod** | Validação de formulários |
| **Playwright** | Testes E2E |
| **vite-plugin-pwa** | Progressive Web App |

### Infraestrutura
| Tecnologia | Uso |
|---|---|
| **Docker & Docker Compose** | 4 serviços: `wppconnect`, `redis`, `pmo-bot`, `pmo-worker` |
| **WPPConnect Server** | Gateway WhatsApp (Dockerfile customizado) |
| **Vercel** | Deploy do frontend (SPA rewrite) |
| **ngrok** | Tunnel para desenvolvimento local |

---

## 📦 Serviços Docker

```yaml
services:
  wppconnect:    # Gateway WhatsApp (porta 21465)
  redis:         # Fila de mensagens (Redis 7 Alpine)
  pmo-bot:       # FastAPI webhook (porta 5000) — recebe e enfileira
  pmo-worker:    # arq worker — processa com IA em background
```

A separação **webhook ↔ worker** garante resposta HTTP em < 200ms enquanto o pipeline de IA roda em background.

---

## 🧠 Pipeline de IA (LangGraph)

```
User Message
     │
     ▼
┌─────────────────┐
│ Interpreter Node │  ← Extrai intent + slots via Structured Output (Pydantic)
└────────┬────────┘
         ▼
┌─────────────────┐
│   Router Node   │  ← Decide próximo passo baseado em intent e slots faltantes
└───┬────┬────┬───┘
    │    │    │
    ▼    ▼    ▼
 Inquiry  Specialist  Compliance
 (Pedir   (RAG para   (Validar
  dados)   dúvidas)    orgânico)
    │         │           │
    └─────────┴───────────┘
              ▼
      ┌───────────────┐
      │ Execution Node│  ← Persiste no Supabase (Caderno de Campo)
      └───────────────┘
```

---

## 📁 Estrutura do Projeto

```
manejo-org-app-clean/
├── pmo_bot/                    # 🐍 Backend (Python)
│   ├── webhook.py              # FastAPI entrypoint
│   ├── worker.py               # arq task worker
│   ├── docker-compose.yml      # Stack completa (4 serviços)
│   ├── Dockerfile              # Python 3.10 slim
│   ├── modules/
│   │   ├── agent_graph.py      # LangGraph (Interpreter → Router → Execution)
│   │   ├── ai_processor.py     # Processamento de IA (legacy)
│   │   ├── expert_agent.py     # Agente especialista (RAG)
│   │   ├── database_handlers.py # Handlers Supabase
│   │   ├── whatsapp_client.py  # Client WPPConnect
│   │   ├── watchdog.py         # Health check periódico
│   │   ├── lid_manager.py      # Mapeamento LID ↔ Phone
│   │   └── ...
│   ├── services/
│   │   ├── bot_orchestrator.py # Pipeline central (Auth → Commands → Quota → IA)
│   │   ├── auth_service.py     # Autenticação e resolução de usuários
│   │   ├── quota_service.py    # Sistema de créditos (Free/Pro)
│   │   ├── media_service.py    # Download e transcrição de áudio
│   │   └── notification_service.py
│   ├── models/                 # Pydantic models (records, whatsapp)
│   ├── prompts/                # System prompts modulares (MD + JSON)
│   └── migrations/             # SQL migrations (RLS, admin, etc.)
│
├── pmo-frontend/               # ⚛️ Frontend (React + TypeScript)
│   ├── src/
│   │   ├── pages/              # Dashboard, PMO, Login, SignUp, Map, Admin...
│   │   ├── components/         # Dashboard widgets, Forms, Dialogs, Maps
│   │   ├── services/           # Supabase queries (dashboard, caderno, PMO, weather)
│   │   ├── hooks/              # Custom hooks (offline sync, etc.)
│   │   ├── context/            # AuthContext (Supabase Auth + Admin)
│   │   └── types/              # TypeScript interfaces
│   ├── supabase/               # Edge Functions e configs
│   ├── e2e/                    # Testes Playwright
│   └── vercel.json             # Deploy config
│
└── wppconnect-server/          # 📱 WPPConnect (fork customizado)
```

---

## ⚙️ Instalação e Configuração

### 1. Pré-requisitos
- **Docker & Docker Compose** instalados
- Conta no **Supabase** (PostgreSQL + Auth + Storage)
- Chave de API do **Google Gemini** (`GOOGLE_API_KEY`)
- Chave de API do **Groq** (`GROQ_API_KEY`) — opcional, usado como fallback

### 2. Variáveis de Ambiente

Crie o arquivo `pmo_bot/.env`:

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=sua_service_role_key
DATABASE_URL=postgresql://postgres:senha@db.xxxxx.supabase.co:5432/postgres?sslmode=require

# IA
GOOGLE_API_KEY=sua_chave_gemini
GROQ_API_KEY=sua_chave_groq

# WPPConnect
WPPCONNECT_TOKEN=seu_token_fixo
WPP_SECRET_KEY=sua_secret
WPP_SESSION=agro_vivo

# Opcional
DEBUG=false
```

Crie o arquivo `pmo-frontend/.env.local`:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua_anon_key
```

### 3. Subir o Backend

```bash
cd pmo_bot
docker-compose up --build -d
```

Isso inicia os 4 serviços: `wppconnect`, `redis`, `pmo-bot` e `pmo-worker`.

### 4. Conectar WhatsApp

Acesse `http://localhost:21465` ou use o script `qrcode.html` para gerar e escanear o QR Code.

### 5. Subir o Frontend (Dev)

```bash
cd pmo-frontend
npm install
npm run dev
```

---

## 🧪 Testes

```bash
# Backend — testes unitários
cd pmo_bot
python -m pytest tests/

# Frontend — testes unitários
cd pmo-frontend
npm run test

# Frontend — testes E2E
npm run test:e2e
```

---

## 🚢 Deploy

| Componente | Plataforma |
|---|---|
| **Frontend** | Vercel (SPA com `vercel.json` rewrite) |
| **Bot + Worker** | VPS com Docker Compose |
| **WhatsApp Gateway** | Mesmo Docker Compose (WPPConnect) |
| **Database** | Supabase Cloud (PostgreSQL gerenciado) |

---

## 📄 Licença

Projeto privado. Todos os direitos reservados.
