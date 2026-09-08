# Roteamento de contexto — manejo-org

> Objetivo: não carregar toda a wiki/documentação de uma vez. Antes de
> investigar um assunto, consulte esta tabela e leia só o que se aplica.

## Tabela de roteamento

| Assunto | Onde consultar | Quando |
|---|---|---|
| Estrutura de código, dependências, "quem chama o quê", impacto de uma mudança | MCP `cartographer` (`mcp__cartographer__context`, `_view`, `_brief`, `_impact`) | Pergunta é sobre código/arquitetura, não sobre domínio de negócio. Prefira sempre isso a grep manual — o grafo já está indexado. |
| Domínio de negócio (agricultura orgânica, PMO, rastreabilidade, certificação, entidades) | MCP `mcpvault` (busca/leitura do `wiki/`) ou `wiki/wiki-index.md` diretamente | Pergunta é conceitual/de domínio, não de implementação. |
| Débitos técnicos abertos, histórico de decisões de segurança/infra | [`pmo-bot-go/docs/debitos_tecnicos.md`](pmo-bot-go/docs/debitos_tecnicos.md) | Antes de responder "o que falta fazer" ou investigar um bug que pode já estar documentado. |
| Plano de sprint ativo | [`pmo-bot-go/docs/PLAN-sprint-pre-viagem-2026-09-08.md`](pmo-bot-go/docs/PLAN-sprint-pre-viagem-2026-09-08.md) | Antes de escolher em que trabalhar, se não houver instrução explícita do usuário. |
| Regras de Go/backend | [`.agent/rules/go-backend.md`](.agent/rules/go-backend.md) | Editando `pmo-bot-go/`. |
| Regras de React/frontend, navegação | [`.agent/rules/react-frontend.md`](.agent/rules/react-frontend.md), [`.agent/rules/navigation.md`](.agent/rules/navigation.md) | Editando `pmo-frontend/`. |
| Regras de Supabase/migrations | [`.agent/rules/supabase.md`](.agent/rules/supabase.md) | Editando `supabase/migrations/`. |
| Protocolo de ADR | [`.agent/rules/adr-protocol.md`](.agent/rules/adr-protocol.md) | Antes de propor uma decisão arquitetural nova. |
| Hardening de segurança | [`.agent/rules/security-hardening.md`](.agent/rules/security-hardening.md) | Ao tocar auth, RLS, secrets, superfície de rede. |
| Protocolo do LLM Wiki (como ler/escrever `wiki/`) | [`.agent/rules/llm-wiki.md`](.agent/rules/llm-wiki.md) | Antes de criar ou editar uma página do `wiki/`. |

## Notas

- O Cartographer é a fonte de verdade para **código** — mais confiável que
  qualquer resumo estático, porque é reindexado (`.cartographer/`, ver
  `manifest.json` para saber a data do último índice).
- O `wiki/` é a fonte de verdade para **domínio** — curado manualmente,
  não regenerado automaticamente.
- Não leia os dois de uma vez "por garantia" — o custo em tokens é real e
  a tabela acima cobre a esmagadora maioria dos casos.
