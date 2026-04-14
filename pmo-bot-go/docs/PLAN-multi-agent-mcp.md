# PLAN-multi-agent-mcp.md
# Refatoração: Single-Agent → Hierarchical Multi-Agent (MCP)

> Documento de Planejamento Tático — para aprovação antes da implementação.
> Referência técnica completa em: `pmo-bot-go/MULTI_AGENT_ARCHITECTURE.md`

---

## Objetivo

Evoluir o `pmo-bot-go` de um modelo monolítico para uma arquitetura Hierarchical Multi-Agent com roteamento dinâmico, prompts modulares e injeção inteligente de ferramentas.

---

## Fases de Implementação

### ✅ Fase 1 — Router (Orquestrador Leve) `[PRIORIDADE ALTA]`
- [ ] Criar `internal/gemini/router.go` com `ClassifyIntent()` usando `ResponseMIMEType: "application/json"` e temperatura 0
- [ ] Adicionar tipos `Intent` (RAG, DATABASE, CHAT) e `RouterResult`
- [ ] Integrar no `state/fsm.go` substituindo o bloco `if/else` de intenção

### ✅ Fase 2 — Prompts Modulares `[PRIORIDADE MÉDIA]`
- [ ] Criar `internal/gemini/prompts/agronomist.md` (especialista em dúvidas técnicas + RAG)
- [ ] Criar `internal/gemini/prompts/db_operator.md` (especialista em CRUD de fazenda)
- [ ] Adicionar `//go:embed` para os novos arquivos em `client.go`
- [ ] Criar função `GetPromptForIntent(intent Intent) string`

### ✅ Fase 3 — Injeção Dinâmica de Ferramentas `[PRIORIDADE MÉDIA]`
- [ ] Adicionar campo `Category ToolCategory` à struct `Tool` em `mcp/server.go`
- [ ] Categorizar as 11 tools existentes em `RAG` ou `DATABASE` em `tools.go`
- [ ] Criar `GetToolsForIntent(intent gemini.Intent) []*genai.Tool` em `server.go`
- [ ] Substituir `mcpServer.GetToolDeclarations()` por `mcpServer.GetToolsForIntent()` no `fsm.go`

### ✅ Fase 4a — LoopGuard Middleware `[PRIORIDADE MÉDIA]`
- [ ] Criar struct `LoopGuard` com `CheckAndRecord()` e `buildCallKey()` em `mcp/server.go`
- [ ] Criar `CallToolWithGuard()` como wrapper de `CallTool()`
- [ ] Instanciar `LoopGuard` por sessão no tool loop do `fsm.go`

### ✅ Fase 4b — Memória Curta (Post-Tool Injection) `[PRIORIDADE BAIXA]`
- [ ] Criar `InjectSystemNote()` em `internal/history/manager.go`
- [ ] Chamar após cada tool bem-sucedida no `fsm.go`

---

## Arquivos Modificados

| Arquivo | Tipo | Fase |
|---|---|---|
| `internal/gemini/router.go` | **NOVO** | 1 |
| `internal/gemini/prompts/agronomist.md` | **NOVO** | 2 |
| `internal/gemini/prompts/db_operator.md` | **NOVO** | 2 |
| `internal/gemini/client.go` | MODIFY | 2 |
| `internal/mcp/server.go` | MODIFY | 3, 4a |
| `internal/mcp/tools.go` | MODIFY | 3 |
| `internal/state/fsm.go` | MODIFY | 1, 3, 4a, 4b |
| `internal/history/manager.go` | MODIFY | 4b |

---

## Plano de Verificação

### Testes Existentes
```bash
# Rodar suite de testes existentes
cd pmo-bot-go && go test ./...
```

### Novos Testes Unitários a Criar

1. **`internal/gemini/router_test.go`** — Testar `ClassifyIntent()` com mensagens de cada intent:
   - `"qual o pH ideal para alface orgânica?"` → deve retornar `RAG`
   - `"crie o talhão A com 2 hectares"` → deve retornar `DATABASE`
   - `"oi tudo bem?"` → deve retornar `CHAT`

2. **`internal/mcp/loopguard_test.go`** — Testar `LoopGuard`:
   - Mesma call 2x → passa
   - Mesma call 3x → bloqueada

3. **`internal/mcp/server_test.go`** — Testar `GetToolsForIntent()`:
   - `IntentRAG` → apenas `consultar_base_conhecimento` na lista
   - `IntentDatabase` → `criar_talhao`, `registrar_colheita`, etc., mas não `consultar_base_conhecimento`

### Build de Verificação
```bash
cd pmo-bot-go && go build ./...
```

---

*Referência técnica completa: `pmo-bot-go/MULTI_AGENT_ARCHITECTURE.md`*
