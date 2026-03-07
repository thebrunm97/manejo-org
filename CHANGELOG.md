# Changelog
Este arquivo documenta as mudanças importantes e refatorações realizadas no Pmo Bot Go Backend.

## [1.1.0] - 2026-03-07
### Added
- **Final Legacy Purge**: Remoção completa de todos os scripts Python obsoletos, diretórios de configuração e binários legados da PoC anterior.
- **Gemini 3.1 Migration**: Transição para o modelo `gemini-3.1-flash-lite` para otimização de cotas e melhor performance em multimodularidade.
- **WPPConnect Session Automation**: Implementação de sistema de recuperação automática de sessão e atualização dinâmica de webhooks sem intervenção manual.

### Added
- **PWA & Offline-First Sync**:
  - Migração para `vite-plugin-pwa` com estratégias de cache Workbox (Fontes, Assets, Navigation).
  - Implementação da `offline_sync_queue` no IndexedDB para sincronização agnóstica de dados.
  - Refatoração total do motor de sincronização (`useSyncEngine.ts`) com migração automática de dados legados.
  - Disponibilidade offline garantida para Planos de Manejo (PMO) e Caderno de Campo.

### Changed
- **TypeScript Strict Mode**: Migração completa do Frontend para TypeScript Estrito (`strict: true`), unificando os tipos de `Talhão` e `CadernoEntry`.
- **CSS Architecture**: Resolução de conflitos de regras `@apply` no Tailwind CSS e padronização do `index.css`.

### Performance
- **Code Splitting & Lazy Loading**: Otimização agressiva das rotas no `App.tsx`, reduzindo o bundle inicial de ~1.2MB para **< 300kB** (294kB).

### Fixed
- **Vite Path Resolution**: Correção de caminhos (aliases) para compatibilidade com Windows e preservação do CSS do `leaflet-draw` via regex alias.

## [1.0.5] - 2026-03-06
### Added
- **Gemini Tool Calling**: Integração nativa do SDK da Gemini com suporte a chamadas de função (MCP), permitindo transações complexas via linguagem natural.
- **RAG Performance Optimization**: Implementação de Worker Pool e Channels em Go para ingestão paralela de documentos PDF com controle de concorrência.
- **Rate Limit Resilience**: Sistema de retry com backoff exponencial e tratamento de erro 429 para a API da Gemini.

### Changed
- **Go Engine Stability**: Finalização da migração do motor principal de processamento de mensagens para Go, substituindo permanentemente o middleware em Python.
- **Improved Webhook Logic**: Injeção nativa de webhooks e melhor tratamento de networking no Docker.

## [1.0.1] - 2026-03-05
### Added
- **Ingestion Versioning**: Tag `v1.0.0-python-legacy` criada como snapshot de segurança pré-migração total.
- **Enhanced Logging**: Implementação de logs de ingestão detalhados para monitoramento do processo de RAG.

## [1.0.0] - 2026-03-04
### Added
- **Paridade de Dados & Extração de Descartes**:
  - `internal/groq/client.go`: Adicionados campos `HouveDescartes` e `QtdDescartes` à extração.
  - `internal/supabase/client.go`: Mapeamento inteligente para o campo JSONB `detalhes_tecnicos` (compatível com o frontend).
  - `internal/state/fsm.go`: Orquestração completa de descartes no fluxo de salvamento.
- **Governança de Logs & Dashboard**:
  - `internal/supabase/client.go`: Implementado `InsertLogTreinamento` para paridade com o Dashboard administrativo atual.
  - `internal/state/fsm.go`: Sistema de log duplo (Auditoria + Treinamento) para visibilidade imediata no painel Admin.
- **Extração e Salvamento N:N de Canteiros**:
  - `internal/groq/client.go`: Extração de múltiplos canteiros.
  - `internal/supabase/client.go`: Métodos para vinculação relacional de canteiros.
  - `internal/state/fsm.go`: Sucesso no registro com detalhamento de canteiros vinculados.

### Added
- **RPI Infrastructure & Automation**: Implementado o framework Research-Plan-Implement (RPI) para automação e segurança no desenvolvimento.
  - Criada regra `.agent/rules/always_use_rpi.md` para forçar o fluxo de trabalho.
  - Criados workflows nativos: `/research`, `/plan` e `/implement`.
- **Skill Migration (Progressive Disclosure)**: Migração de toda a documentação técnica para o sistema de Skills do Antigravity.
  - Criado `golang-guerrilha` skill: Padrões de alta performance (stdlib, FSM, goroutines).
  - Criada `groq-integration` skill: recursos movidos para `.agent/skills/groq-integration/resources/`.
  - Criada `gemini-integration` skill: recursos movidos para `.agent/skills/gemini-integration/resources/`.
  - Removidos diretórios obsoletos `internal/*/docs`.

### Changed
- **Fase 5: RAG Ingestion (Gemini File Search API)**: Implementado `cmd/knowledge_loader/main.go` para ler PDFs do diretório `docs/knowledge_base`.
  - Scripts realiza uploads automatizados e cria um `FileSearchStore`.
  - Proteção agressiva de Rate Limit engatilhada (15s por requisição).
  - Integrado o `GEMINI_STORE_ID` dinamicamente no webhook (v3 `generateContent`) via array de `tools`.
- **Fase 4: Feedback Loop & Agente Especialista**: Implementação do WhatsApp Client nativo (via WPPConnect API) para responder com status de "Sucesso" ou "Falha" nos salvamentos do DB. Implementado `gemini.Client` invocando a API do Gemini de maneira "zero-dependências".
  - Modelo alterado para `gemini-1.5-flash` para respeitar o Rate Limit mais agressivo da quota gratuíta (20 Requisições por Dia). 
  - Tratamento nativo do erro HTTP 429 para instruir o produtor amigavelmente.
  - O `system_prompt.md` agora age como um Consultor Focado com Resgate Obrigatório caso o tema desvie de manejo orgânico.
- **Fase 3: State Machine (FSM) & Supabase Client**: Adição de cliente nativo (`net/http`) para o Supabase interagindo com as tabelas `profiles` e `caderno_campo`. Implementação de FSM para controle de fluxo de intenções, chamando o banco e abortando na presença de alertas orgânicos.mIdByPhone` (consulta `profiles.pmo_ativo_id`)
  - Implementado `InsertCadernoCampo` (salva NER na tabela `caderno_campo`)
- ✅ `internal/state/fsm.go` — Máquina de Estados (Substitui complexidade do LangGraph)
  - Fluxo Linear Seguro: Resolve Telefone → Obtém PMO → Groq NER → Bloqueia Orgânico → Salva Supabase
- ✅ `internal/webhook/handler.go` adaptado:
  - Delega processamento para `go state.ProcessMessage(...)` (assíncrono)
  - Retorna HTTP 200 instantaneamente para o WPPConnect
- ✅ Integração no `cmd/server/main.go` com variáveis `SUPABASE_URL` e `SUPABASE_KEY`
### Refatoração Arquitetural + Testes E2E (2026-03-04)
- ✅ `cmd/tester/main.go` — Stress tester E2E com 21 casos Table-Driven
  - Categorias: proibidos orgânicos, permitidos, ações de campo, intenções variadas
  - **Resultado: 20/21 (95%) — 100% de acerto em compliance orgânico**
  - Único falso: "Vou almoçar" classificado como `saudacao` em vez de `ignorar` (aceito)
- ✅ `internal/groq/prompts/system_prompt.md` — System Prompt extraído para ficheiro Markdown
  - Adicionado "farinha de osso" à lista de insumos permitidos (alinhado com IN 46)
- ✅ `internal/groq/client.go` — `go:embed prompts/system_prompt.md`
  - `const systemPrompt` removido; carregado em compile-time via `//go:embed`
  - Regras de compliance editáveis sem recompilar binário

### Fase 2: Groq Integration — NER Brain (2026-03-04)
- ✅ `internal/groq/client.go` — Client HTTP nativo para API da Groq
  - Modelo: `llama-3.3-70b-versatile`
  - Struct `ExtractionResult` com 8 campos + `Localizacao` nested
  - **JSON Schema** com `response_format: json_schema` (enums, required, additionalProperties:false)
  - System Prompt enriched com regras orgânicas (@AgronomoOrganico / Lei 10.831 / IN 46)
  - Retry com backoff (até 2 retries), logging de token usage
- ✅ **Conexão Fase 1 ↔ Fase 2**: webhook → Groq Extract → json.MarshalIndent no terminal
  - `cmd/server/main.go` — fail-fast se `GROQ_API_KEY` vazia, injeção do Groq client
  - `internal/webhook/handler.go` — chama `Extract()`, log de 🚨 ALERTA ORGÂNICO se `alerta_organico: true`
  - Regra de ouro mantida: HTTP 200 OK mesmo se Groq falhar
- ✅ Docs Groq movidos para `internal/groq/docs/`

### Fase 1: Fundação HTTP & WPPConnect (2026-03-03)
- ✅ `cmd/server/main.go` — Servidor Gin (release mode, recovery middleware)
- ✅ `internal/webhook/handler.go` — Structs WPPConnect mapeadas 1:1 do Python
  - Token auth (query param `?token=` + Bearer header)
  - Broadcast filter, TTL check, self-message filter
  - Normalização de chatId (string e dict/LID)
  - **Regra de ouro**: sempre devolve HTTP 200 OK
- ✅ `Dockerfile` multi-stage com cache de módulos (~42MB com Gin)
- ✅ `.gitignore`, `.env.example`
- ✅ Fundação: `PLAN.md`, Skill `@AgronomoOrganico`, `CHANGELOG.md`

### PoC (2026-03-03)
- ✅ Criado `main.go` (PoC) — webhook ultraleve com stdlib Go
- ✅ Testado chamadas à API da Groq com `llama-3.1-8b-instant`
