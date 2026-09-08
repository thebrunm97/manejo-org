# Activity Log (Linha do Tempo)

Registro cronológico de todas as operações de ingestão, consultas complexas e health checks (lint) realizados no Wiki.

## [2026-04-05] Setup | Inicialização do LLM Wiki
- **Ação**: Criação da estrutura de diretórios e arquivos base (`index.md`, `log.md`, `llm-wiki.md`).
- **Status**: Concluído.
- **Autor**: Antigravity (LLM Agent).


## [2026-04-05] Ingest | Reorganização Inicial
- **Ação**: Movimentação de pesquisas da raiz para `docs/raw/` e PRDs/Estratégias para `docs/concepts/`.
- **Arquivos**: 4 fontes brutas (Research) e 3 conceitos (PRD, Sync, RPI).
- **Status**: Concluído.

## [2026-09-08] Ingest | DT-127 — Autenticação do webhook evolution-go
- **Ação**: Criada página de conceito `[[webhook-auth-evolution]]` documentando a migração da autenticação do webhook (evolution-go → pmo-bot-go) de `?token=` na query para header `Authorization: Bearer`, e a armadilha de produção rodando um binário desatualizado que mascarou o bug por um tempo.
- **Fonte**: Investigação ao vivo na VPS de produção (SSH + `docker logs`) na mesma sessão que fechou o `DT-127` em `pmo-bot-go/docs/debitos_tecnicos.md`.
- **Status**: Concluído.

---
> [!TIP]
> Use `grep "^## [" log.md | tail -5` para ver as últimas 5 atividades.
