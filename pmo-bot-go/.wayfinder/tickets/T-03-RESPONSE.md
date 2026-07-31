# T-03 Resposta: Estrutura do Test Suite E2E

## Decisão
Foi escolhida a seguinte estrutura e tooling para o pipeline E2E:

- **Localização:** Pasta separada `e2e/` na raiz do projeto (`pmo-bot-go/e2e/`), agrupando os testes por fluxo de negócio (ex: `e2e/harvest/`, `e2e/expense/`, `e2e/rag/`).
- **Tooling:** Apenas `go test` nativo + `github.com/stretchr/testify` para asserções e simulações HTTP do webhook. (Sem Playwright, já que não temos interface web).
- **Scope Mínimo:** Fluxos críticos de negócio (Colheita, Despesa, RAG) + Smoke checks (autenticação, persistência, e fila). Os restantes handlers continuam a ser cobertos pelos testes unitários e de integração (`tests/`).
- **Separação no CI:** Utilização da build tag `//go:build e2e` no topo de cada ficheiro E2E. Assim, o comando padrão `go test ./...` ignora os E2E locais, e o CI corre explicitamente com `go test -tags=e2e ./e2e/...`.

## O que muda no código?
- A pasta `tests/` mantém-se para integração e apoio (ex: os testes atuais).
- Será criada a diretoria `e2e/` com a nova taxonomia.
- Cada novo ficheiro de teste aí criado começará obrigatoriamente por `//go:build e2e`.

## Próximo Passo
O test suite E2E já tem a sua arquitetura, tooling, e mecânica de isolamento e teardown (do T-02) perfeitamente definidos. O último passo antes de começar a codificar é o **T-04**: definir a infraestrutura onde o CI/CD vai correr (runners, secrets, e estratégia de deploy).
