# 🗺️ Mapa: Pipeline E2E + CI/CD Completo

**Label:** `wayfinder:map`  
**Criado:** 2026-07-31  
**Tracker:** local-markdown (ficheiro neste repo)

---

## Destination

Um pipeline de ponta a ponta onde:
1. **Cada PR** dispara automaticamente build + testes unitários + testes E2E contra o Supabase de produção
2. **Cada merge para `main`** faz deploy automático do container para produção
3. O bot responde corretamente a fluxos reais de WhatsApp num ambiente verificável

O mapa termina quando um PR pode ser criado com confiança de que, se o CI/CD estiver verde, o bot está pronto para 10+ PMOs reais.

---

## Notes

- **Supabase:** mesmo projeto de produção (sem staging separado — risco aceite)
- **Deploy destino:** container Docker (existente: `Dockerfile` + `docker-compose`)
- **Skills a consultar:** `systematic-debugging`, `testing-patterns`, `deployment-procedures`
- **Regra de ouro:** testes E2E **não** podem deixar dados sujos em produção (cleanup obrigatório)
- **Branch de trabalho:** `feature/phase-5-e2e-cicd`

---

## Decisions so far

- [T-01: Mapear o estado actual dos testes de integração](#ticket-t-01) — Concluído. Dados frágeis e sem cleanup identificado.
- [T-02: Decidir estratégia de cleanup de dados E2E](#ticket-t-02) — Usar PMO dedicado (ID 9999) e fazer DELETE rigoroso no teardown. Detalhes em [T-02-RESPONSE](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/.wayfinder/tickets/T-02-RESPONSE.md).
- [T-03: Decidir estrutura do test suite E2E](#ticket-t-03) — Pasta separada `e2e/`, build tag `//go:build e2e`, `go test` + `testify`, cobertura focada nos fluxos críticos. Detalhes em [T-03-RESPONSE](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/.wayfinder/tickets/T-03-RESPONSE.md).
- [T-04: Decidir infra do runner CI/CD](#ticket-t-04) — GitHub Actions para os testes E2E. Deploy continua local via Docker por agora, até existir a VPS. Detalhes em [T-04-RESPONSE](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/.wayfinder/tickets/T-04-RESPONSE.md).

*(Fronteira limpa — o caminho para o destino está livre e totalmente documentado)*

| # | Título | Tipo | Estado | Bloqueia |
|---|--------|------|--------|----------|
| - | O nevoeiro de guerra dissipou-se | | | |

---

## Not yet specified

- Como o deploy automático vai acontecer: qual runner, qual secret, qual host (VPS/Fly.io/Railway?)
- Estratégia de cleanup: rollback de dados após E2E (DELETE by test tag? Supabase transactions?)
- Se há necessidade de um PMO de teste dedicado em produção para o CI não poluir dados reais
- Alertas pós-deploy: health check automático após cada deploy

---

## Out of scope

*(nada descartado ainda)*
