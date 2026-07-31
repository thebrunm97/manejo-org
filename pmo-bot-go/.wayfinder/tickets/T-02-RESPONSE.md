# T-02 Resposta: Estratégia de Cleanup de Dados E2E

## Decisão
Foi escolhida a **Opção A: PMO de Teste Dedicado (pmo_id=9999) + DELETE no teardown**.

## Racional
- **Segurança:** O sistema já implementa isolamento multi-tenant robusto (comprovado na Phase 4). Usar um `pmo_id` fixo de E2E (9999) garante que os dados nunca se misturam com PMOs reais.
- **Determinismo:** O teardown pode simplesmente executar `DELETE FROM <tabelas> WHERE pmo_id = 9999`, removendo 100% dos resíduos gerados pelo teste.
- **Limitação da Opção C:** Transações Supabase (PostgREST) não suportam rollbacks fáceis através de múltiplos requests HTTP sequenciais (como os que um E2E faria ao webhook).
- **Limitação da Opção B:** Tags são frágeis e deixariam a base de dados poluída se um teste falhar a meio.

## O que muda no código?
- O Supabase de Produção (e Staging/Local) deverá ter sempre um registo na tabela `pmos` com `id = 9999` e `nome = 'PMO_TEST_E2E'`.
- Deverá ser criado um utilitário `teardownE2E(pmoID int64)` que executa os comandos SQL necessários para limpar: `farm_documents_chunks`, `farm_documents`, `operacoes_agronomicas`, `memoria_llm`, etc.

## Próximo Passo
A estratégia de cleanup está definida. O **T-03** ajudará a definir onde e como este teardown será invocado (e como organizamos a suite de testes).
