# T-04 Resposta: Infraestrutura e Runner CI/CD

## Estado Atual da Infraestrutura
1. **Host de Produção:** Atualmente corre em local (Docker Desktop via `docker-compose`). O objetivo futuro é uma **VPS**.
2. **Deploy:** Atualmente é **manual** e **local** (Docker).
3. **CI/CD Existente:** 
   - A pasta `.github/workflows/` contém `test.yml` (que corre testes unitários Go) e `e2e-tests.yml` (que corre Playwright para o *frontend* `pmo-frontend`). 
   - **Não existe nenhum pipeline de Deploy contínuo (CD)** nem de testes E2E do *bot/backend* contra o Supabase real.

## Decisão para o Novo Pipeline
Considerando a transição futura para uma VPS e a estrutura atual do repositório:

- **Runner:** GitHub Actions (já em uso no repositório).
- **Secrets Necessários no GitHub:** `SUPABASE_URL`, `SUPABASE_KEY` (da BD de produção/testes), `GEMINI_API_KEY` (para os fluxos RAG/LLM E2E). Futuramente, quando migrar para VPS, precisará de `SSH_HOST`, `SSH_USER` e `SSH_PRIVATE_KEY` para o deploy automático.
- **Estratégia de Deploy (Faseada):**
  - **Fase A (Atual - CI E2E):** Implementar apenas a corrida dos testes E2E no GitHub Actions em cada PR, garantindo a qualidade. O deploy continua a ser manual via Docker localmente.
  - **Fase B (Futuro - Deploy em VPS):** Adicionar um step de CD que, ao fazer merge para a `main` e os E2E passarem, faz um SSH remoto para a VPS, executa `git pull`, `docker compose build` e `docker compose up -d`.

## Conclusão do Mapa
O mapa `map-phase5-e2e-cicd.md` atingiu o seu destino! Todas as decisões necessárias para a implementação de E2E e CI/CD estão agora perfeitamente delineadas e documentadas em `.wayfinder/tickets/`.
