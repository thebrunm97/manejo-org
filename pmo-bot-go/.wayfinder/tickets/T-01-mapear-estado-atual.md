## Question

Antes de decidir o que construir, precisamos de saber o que já existe e o que falta.

O repositório tem:
- `tests/integration_obs_test.go` — usa `godotenv.Load("../.env")`, autentica com Supabase real, testa upload de PDF via HTTP
- `tests/integration_rag_test.go` — testa RAG query
- `internal/mcp/*_test.go` — testes unitários (Phase 3) com skip sem DATABASE_URL
- `internal/test/fixtures.go` — mock profiles para PMOs

**Questões a resolver neste ticket:**

1. Os testes em `tests/` passam actualmente? Ou estão com TODO/skip?
2. Existe algum teste que simule uma mensagem WhatsApp completa (webhook → LLM → tool → BD)?
3. O `integration_obs_test.go` usa `pmo_id` hardcoded (333) — este PMO existe em produção e é seguro usar para testes?
4. Existe algum mecanismo de cleanup (DELETE após teste)?
5. Há algum test helper partilhado ou cada teste faz o seu próprio setup?
