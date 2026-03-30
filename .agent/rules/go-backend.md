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
- **Thin Backend:** O Go é orquestrador. Lógica de negócio pesada DEVE residir no PostgreSQL via RPCs (ver [ADR-002](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/architecture/adr/002-fat-database.md)).
- **FSM obrigatória:** Nunca adicionar estado sem documentar em [fsm.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/fsm.md) e seguir o pattern existente em `fsm.go`.
- **Novos agentes:** Devem ter prompt em `prompts/` e documentação em [agents.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/agents.md). Seguir pattern de `agronomist`/`db_operator`.
- **RPCs novas:** Toda RPC criada no Supabase deve ser documentada em [rpcs.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/database/rpcs.md) com parâmetros e retorno.

## Regras de Segurança
- **HMAC:** Webhooks DEVEM validar token HMAC antes de processar.
- **LoopGuard:** Todo loop de tool calling DEVE ser protegido por LoopGuard para evitar recursão infinita da IA.
- **Blacklist:** Substâncias proibidas estão em [compliance.md](file:///c:/Users/brunn/Documents/PROGRAMAÇÃO/manejo-org-app-clean/docs/backend/compliance.md). Nunca remover itens da blacklist sem aprovação explícita.
- **Deduplificação:** Mensagens duplicadas do WPPConnect devem ser filtradas antes de processamento.

## Regras de Qualidade
- **Logs:** DEVEM incluir PMO ID e User ID para rastreabilidade.
- **Erros de IA:** Devem ser logados em `logs_processamento` no Supabase.
- **Panic recovery:** DEVE estar ativo em todos os handlers.
- **Variáveis de ambiente:** usar constantes, nunca strings hardcoded.
