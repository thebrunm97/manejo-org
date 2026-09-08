# AGENTS.md — manejo-org

Roteamento de contexto para agentes de código (Codex, OpenCode, e
compatíveis). Não carregue toda a documentação de uma vez — consulte o
mapa abaixo por assunto.

## Onde procurar o quê

- **Código / dependências / impacto de mudança** → se disponível, use o
  MCP server `cartographer` deste projeto (`.mcp.json`); senão, leia
  `.cartographer/CODEBASE_MAP.md`.
- **Domínio de negócio** (agricultura orgânica, PMO, rastreabilidade,
  entidades do sistema) → `wiki/wiki-index.md` e as páginas em
  `wiki/concepts/`, `wiki/entities/`, `wiki/components/`.
- **Débitos técnicos / o que está pendente** → `pmo-bot-go/docs/debitos_tecnicos.md`.
- **Plano de trabalho ativo** → `pmo-bot-go/docs/PLAN-sprint-pre-viagem-2026-09-08.md`.
- **Regras específicas de stack** → `.agent/rules/`:
  `go-backend.md` (pmo-bot-go), `react-frontend.md` + `navigation.md`
  (pmo-frontend), `supabase.md` (migrations), `adr-protocol.md` (decisões
  arquiteturais), `security-hardening.md` (auth/RLS/secrets),
  `llm-wiki.md` (como manter o `wiki/`).

## Convenções do projeto

- Backend em Go: `pmo-bot-go/`. Frontend em React/Vite: `pmo-frontend/`.
  Migrations SQL: `supabase/migrations/` (timestamp no nome, nunca editar
  uma já aplicada em produção sem necessidade real — ver `.agent/rules/supabase.md`).
- Commits e IDs de débito seguem o padrão `DT-XX` (ex.: `fix: corrige X (DT-42)`).
- Nunca commitar segredos. `.env*` já está no `.gitignore`.
