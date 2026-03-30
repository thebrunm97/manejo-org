# 📱 PMO Bot - Visão Geral

> Assistente virtual para Planos de Manejo Orgânico via WhatsApp

---

## 🎯 O Que o Bot Faz

O **ManejoORG Bot** recebe mensagens de produtores rurais via WhatsApp (texto ou áudio), extrai dados estruturados usando IA, e registra automaticamente no sistema de gestão de Planos de Manejo Orgânico.

---

## 🔄 Fluxos Principais

### 1. Vinculação de Usuário
```
Usuário envia código (6 chars) → Bot valida na tabela `profiles` 
→ Vincula telefone ao perfil → Confirmação
```

### 2. Registro de Atividade (Texto)
```
Usuário envia mensagem texto → Saudação? → Resposta rápida
                             ↓ Não
                     Processamento IA (Llama 3.3)
                             ↓
                 Validação de Regras de Negócio (Lei 10.831)
                             ↓
              Bloqueado? → Aviso de compliance
                   ↓ Não
            Normalização de dados
                   ↓
          Inserção no `caderno_campo`
                   ↓
   Roteamento por tipo: Plantio→Seção2 | Manejo/Insumo→Seção8
                   ↓
            Feedback para usuário ✅
```

### 3. Registro de Atividade (Áudio)
```
Usuário envia áudio (PTT) → Download via WPPConnect API
                                  ↓
                      Transcrição (Whisper Large V3)
                                  ↓
                      [Continua fluxo de texto]
```

### 4. Compliance Check
Durante processamento, o bot verifica:
- **Produtos proibidos**: Glifosato, Paraquat, 2,4-D, etc. → Bloqueio
- **Limite de Cobre**: Alerta se usar Calda Bordalesa
- **Esterco**: Alerta sobre período de compostagem
- **Insumo não cadastrado**: Alerta se não consta no PMO
- **Talhão não certificado**: Alerta sobre status

---

## 🔌 Integrações

### WPPConnect Server
- **URL**: `http://localhost:21465`
- **Sessão**: `NERDWHATS_AMERICA`
- **Funções**:
  - Receber webhooks de mensagens (`POST /webhook`)
  - Enviar respostas (`POST /api/{session}/send-message`)
  - Baixar mídia (`GET /api/{session}/get-media-by-message/{id}`)

### Supabase
- **Tabelas principais**:
  - `profiles` - Dados de usuários + `pmo_ativo_id`
  - `pmos` - Planos de Manejo (`form_data` JSONB)
  - `caderno_campo` - Log de todas atividades
  - `talhoes` - Áreas/parcelas das propriedades
  - `pmo_equipamentos` - Inventário de equipamentos
  - `pmo_manejo` - Planejamento de insumos

### Groq API
- **Modelo LLM**: `llama-3.3-70b-versatile`
  - Extração estruturada de dados
  - Temperature: 0.0 (determinístico)
  - Max tokens: 600
- **Modelo STT**: `whisper-large-v3`
  - Transcrição de áudios em português

---

## 📁 Estrutura de Arquivos

```
pmo_bot/
├── webhook.py              # Servidor Flask (porta 5000)
├── modules/
│   ├── __init__.py
│   ├── ai_processor.py     # Processamento IA + normalização
│   ├── database_handlers.py # Operações Supabase
│   ├── business_rules.py   # Validação Lei 10.831
│   └── prompts.py          # System prompt do Llama
├── docs/
│   ├── overview.md         # Este arquivo
│   ├── business_rules.md   # Regras agronômicas
│   ├── integration_contracts.md
│   ├── conventions.md
│   ├── PMO_DATA_STRUCTURE.md
│   └── README.md
├── audios_recebidos/       # Temp de áudios baixados
└── wppconnect-server/      # Servidor WPPConnect
```

---

## 🚀 Como Executar

```bash
# 1. Iniciar WPPConnect Server
cd wppconnect-server
npm run dev

# 2. Iniciar Bot
cd pmo_bot
python webhook.py
```

**Variáveis de ambiente necessárias** (`.env`):
```env
GROQ_API_KEY=gsk_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJ...
WPP_TOKEN=seu_token_wppconnect
```

---

**Última atualização**: Janeiro 2026
