## Question

O Supabase de produção será usado para os E2E. Isso levanta a questão crítica: **como garantir que os testes não deixam dados sujos?**

Opções a avaliar (após T-01 revelar o estado actual):
- Usar um `pmo_id` de teste dedicado e fazer DELETE no teardown
- Usar Supabase transactions com rollback (se a RPC suportar)
- Tags nos registos de teste (ex: `observacao_original LIKE '%[TEST]%'`) + cleanup job
- Aceitar dados de teste em produção (não recomendado)
