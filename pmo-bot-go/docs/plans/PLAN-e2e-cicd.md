# Overview

Implementação do Pipeline E2E e CI/CD para o `pmo-bot-go` (Phase 5). O objetivo é garantir que cada Pull Request no repositório dispare automaticamente testes E2E reais contra o Supabase de produção (com isolamento via PMO de testes dedicado) e valide os fluxos críticos de negócio sem corromper dados reais.

# Project Type
BACKEND (Go, PostgreSQL/Supabase, Webhooks WhatsApp)

# Success Criteria
- ✅ O PMO `9999` é criado e verificado no banco de dados e usado exclusivamente para testes E2E.
- ✅ A suite de testes E2E é isolada na pasta `e2e/` com a tag `//go:build e2e`.
- ✅ Os fluxos de Colheita, Despesa e RAG são validados contra a API real (HTTP webhook simulation + BD real).
- ✅ A função de `teardown` apaga 100% dos dados gerados pelo PMO `9999` ao final de cada teste, independentemente de falhas.
- ✅ O CI (GitHub Actions) executa `go test -tags=e2e ./e2e/...` automaticamente nos PRs e na `main`.

# Tech Stack
- **Go 1.23+**: Backend engine e suite nativa (`go test`).
- **Testify**: Biblioteca para asserções e simulação de requisições HTTP (`net/http/httptest`).
- **GitHub Actions**: Runner de CI para garantir a qualidade em PRs.
- **Supabase**: Base de dados de testes/produção interagida pelos testes.

# File Structure
```text
pmo-bot-go/
├── e2e/
│   ├── harvest_test.go      # Fluxo de colheita
│   ├── expense_test.go      # Fluxo de despesa
│   ├── rag_test.go          # Fluxo de assistente/RAG
│   ├── smoke_test.go        # Autenticação e persistência básica
│   └── e2e_utils.go         # Helpers: setup do webhook, teardown (DELETE) do PMO 9999
├── internal/
│   └── ... (sem alterações profundas, injeção de flags de teste se necessário)
└── .github/workflows/
    └── backend-e2e.yml      # (novo ou merge no existente) Workflow do GitHub Actions para backend
```

# Task Breakdown

### Task 1: Setup do PMO de Testes Dedicado e Utils de Teardown
- **Agent:** `backend-specialist`
- **Skills:** `testing-patterns`, `clean-code`
- **Priority:** P0
- **Dependencies:** Nenhuma.
- **INPUT:** Ambiente Supabase real conectado; Decisão do T-02.
- **OUTPUT:** Registo do PMO `9999` na BD e ficheiro `e2e/e2e_utils.go` com a função `teardownE2E(pmoID int64)` executando os DELETEs (farm_documents_chunks, farm_documents, operacoes_agronomicas, memoria_llm).
- **VERIFY:** A execução do `teardown` com um ID temporário remove as linhas criadas e deixa as tabelas limpas.

### Task 2: Estruturar a Suite E2E e Workflow Base (Build Tags)
- **Agent:** `backend-specialist`
- **Skills:** `testing-patterns`
- **Priority:** P1
- **Dependencies:** Task 1.
- **INPUT:** Decisão do T-03.
- **OUTPUT:** Criação do primeiro teste em `e2e/smoke_test.go`, com cabeçalho `//go:build e2e`.
- **VERIFY:** O comando `go test ./...` ignora a pasta `e2e/`. O comando `go test -tags=e2e ./e2e/...` executa os testes e invoca o teardown.

### Task 3: Implementar Fluxos E2E Críticos (Colheita, Despesa, RAG)
- **Agent:** `backend-specialist`
- **Skills:** `testing-patterns`
- **Priority:** P1
- **Dependencies:** Task 2.
- **INPUT:** Casos de uso do bot para parsing de Twilio e execução dos commands.
- **OUTPUT:** Ficheiros `harvest_test.go`, `expense_test.go`, `rag_test.go`. Devem iniciar handlers HTTP, enviar JSON mock e realizar asserts tanto no output LLM como na BD real via Supabase API.
- **VERIFY:** Todos os testes E2E executam e passam, terminando com o teardown bem sucedido.

### Task 4: Configurar GitHub Actions (Runner CI)
- **Agent:** `backend-specialist`
- **Skills:** `deployment-procedures`
- **Priority:** P2
- **Dependencies:** Task 3.
- **INPUT:** Decisão do T-04 e secrets do GitHub.
- **OUTPUT:** Workflow YAML (ex: `e2e-tests-backend.yml`) que instala Go, importa as ENVs/Secrets e corre `go test -tags=e2e ./e2e/...`.
- **VERIFY:** Um trigger manual ou mock PR comprova a execução da action e a interação correta com a DB de produção via PMO 9999.

# Phase X: Final Verification (MANDATORY)
- [ ] O `teardownE2E(9999)` garante 0 resíduos nas tabelas de produção (teste de fuga)?
- [ ] Os testes locais passam perfeitamente isolados com `go test -tags=e2e ./e2e/...`?
- [x] O CI no GitHub Actions foi implementado e está 'verde'?
- [x] As build tags garantem que não poluímos execuções normais de `go test ./...`?
