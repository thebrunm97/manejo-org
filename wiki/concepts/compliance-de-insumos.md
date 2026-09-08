# Compliance de insumos

Nem tudo pode entrar em uma lavoura orgânica. A lista de substâncias
permitidas e vedadas muda por instrução normativa — portanto a validação
**não pode estar hardcoded** no binário.

## Decisão de arquitetura

A lista vive no banco, na tabela `insumos_proibidos`, legível por qualquer
usuário autenticado (`SELECT` liberado por RLS) e consultada em tempo de
execução pelo [[pmo-bot-go]] via PostgREST:

```
GET {SUPABASE_URL}/rest/v1/insumos_proibidos?select=nome
```
(`pmo-bot-go/internal/supabase/client.go:418`)

Atualizar a regulação é um `INSERT`, não um deploy.

## Camada de guardrails

A checagem de insumo é uma das barreiras do pipeline em
`pmo-bot-go/internal/guardrails/`, que também cobre:

- `filter_injection.go` — tentativa de prompt injection na mensagem do produtor.
- `filter_pii.go` — dados pessoais.
- `business.go` — regras de negócio.
- `sensitivity.go` + `hitl.go` — escalonamento para revisão humana
  (*human in the loop*), com rascunhos em `mutation_drafts`.
- `judge_gemini.go` — avaliação por LLM juiz.
- `idempotency.go` — evita registro duplicado da mesma mensagem.

Relacionado: [[certificacao-organica]], [[roteador-de-agentes-ia]].
