---
globs: ["pmo-bot-go/**/*.go"]
---

# Regras para Backend Go — PMO Bot

## Referências Obrigatórias
Antes de modificar qualquer arquivo Go, consultar:
- **FSM e estados:** [fsm.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/fsm.md)
- **Agentes de IA:** [agents.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/agents.md)
- **Motor de compliance:** [compliance.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/compliance.md)
- **RPCs do Supabase:** [rpcs.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/database/rpcs.md)
- **Variáveis de ambiente:** [env_vars.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/deployment/env_vars.md)

## Regras Arquiteturais
- **Thin Backend & SQL-First:** O Go é orquestrador. Lógica de negócio pesada DEVE residir no PostgreSQL via RPCs (ver [ADR-002](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/architecture/adr/002-fat-database.md)).
- **Hexagonal Architecture (Ports & Adapters):** Para desacoplamento de provedores (ex: WhatsApp), definir interfaces ("ports") no pacote `internal/` e implementações ("adapters") em subpacotes específicos.
- **FSM obrigatória:** Nunca adicionar estado sem documentar em [fsm.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/fsm.md) e seguir o pattern existente em `fsm.go`.
- **Novos agentes:** Devem ter prompt em `prompts/` e documentação em [agents.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/agents.md).

## Concorrência e Performance (Expert)
- **Safe Goroutines:** Sempre usar `errgroup.Group` ou `sync.WaitGroup` para gerenciar ciclos de vida de goroutines. Nunca disparar goroutines "soltas" sem controle de cancelamento via `context.Context`.
- **Mutexes:** Minimizar o tempo de trava. Usar `defer mu.Unlock()` imediatamente após `mu.Lock()`.
- **Benchmarking:** Funções de processamento de mensagens ou IA DEVEM ter testes de benchmark (`testing.B`) para monitorar regressões de performance.
- **Pool de Conexões:** Verificar se o `sql.DB` ou client Supabase está usando pooling adequado para evitar exaustão de conexões em regime de alta carga.

## Regras de Segurança
- **HMAC & Validation:** Webhooks DEVEM validar token HMAC antes de processar.
- **LoopGuard:** Todo loop de tool calling DEVE ser protegido por `LoopGuard` para evitar recursão infinita e quebra de limite de tokens da IA.
- **Secrets:** NUNCA deixar chaves de API ou tokens em logs ou código. Usar `os.Getenv` ou `godotenv`.

## Regras de Qualidade
- **Logs Estruturados:** Incluir `UserID`, `OrgID` e `ConversationID` em todos os logs de erro para facilitar o debug via Supabase.
- **Panic recovery:** DEVE estar ativo em todos os handlers de entrada (webhooks/crons).
