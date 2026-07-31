# T-01 Resposta: Estado Atual dos Testes E2E

## Pergunta 1: Testes em tests/ passam?
**Resposta:** PARCIAL
- **Detalhe:** Os testes (`integration_obs_test.go` e `integration_rag_test.go`) executam chamadas reais ao Supabase/Gemini carregando as credenciais de `.env`. Ocorrem falhas por conflitos de dados persistentes, por exemplo, `duplicate key value violates unique constraint "farm_documents_chunk_hash_key"` durante a ingestão, o que mostra que os testes colidem com execuções anteriores.

## Pergunta 2: Existe teste de WhatsApp completo?
**Resposta:** NÃO (HTTP real) / SIM (Simulado)
- **Detalhe:** O ficheiro `internal/webhook/hitl_e2e_simulate_test.go` simula o fluxo completo, mas através de injeção de dependências (`MockHITLController` e `MockWhatsApp`). Não há nenhum teste em `tests/` que envie um JSON payload de webhook real via HTTP e valide a cadeia completa contra a base de dados real.

## Pergunta 3: PMO 333 (e 320) existe em produção?
**Resposta:** DESCONHECIDO / FRÁGIL
- **Detalhe:** Os testes assumem a existência de PMOs hardcoded (333 num teste, 320 no outro) para satisfazer `FK constraints` da base de dados local/produção, mas não criam o PMO no início nem garantem a sua existência.

## Pergunta 4: Existe cleanup?
**Resposta:** NÃO
- **Detalhe:** O código é claro: `t.Log("⚠️ Remember to cleanup PMO_ID 320 in Supabase later.")`. Não há teardown automático; o Supabase fica com o lixo de teste após cada execução.

## Pergunta 5: Há helper partilhado?
**Resposta:** NÃO
- **Detalhe:** Os testes na pasta `tests/` não partilham helpers. Cada teste repete as chamadas para `godotenv.Load("../.env")`, instanciação do `supabase.NewClient`, `gemini.NewClient` e `webhook.NewHandler`. Não utilizam as fixtures em `internal/test/fixtures.go`.

---

## Lacunas Encontradas
- [x] Falta teste E2E de webhook (HTTP) real contra o flow do Evolution API.
- [x] Falta cleanup automático. Os testes deixam side-effects graves (hashes duplicadas) em produção/BD real.
- [x] Falta documentação de PMO de teste ou, preferencialmente, fixtures automáticas (`setup`/`teardown`).
- [x] Falta abstração/helpers: muita repetição de setup de dependências em cada teste de integração.

## Próximo Passo
A lacuna de cleanup é o bloqueio primário. **T-02** deve agora ser abordado para definir a estratégia antes de escrevermos qualquer teste E2E novo.
