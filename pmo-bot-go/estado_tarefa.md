# Estado Tarefa: Fase 2 do Agentic Loop (Mutações, Idempotência e HITL)
task_id: AGENTIC-MUTATIONS-001
objetivo_atual: Concluir validação da Fase 2.1 com histórico de migrations alinhado e testes reais no PostgreSQL (Docker Staging).
hipotese_de_falha: N/A
evidencia: 
  - Migração SQL 20260816000000_add_idempotency_to_mutations.sql criada e validada contra PostgreSQL 17.6 Docker real.
  - Testes reais (TestIdempotency_RealPostgreSQL_Integration) cobrindo as 4 operações de escrita (caderno_campo, compra_insumo, transacoes_com_rateio, cotas_produtores) e invariância de NULLs passando 100%.
  - Reversão mínima dos arquivos de migração históricos no Git aplicada com sucesso.
  - Suíte completa do repositório (go test ./...) 100% verde.
tentativas_restantes: 4
proxima_acao: Aguardar confirmação da query de leitura do schema_migrations pelo usuário para iniciar a Fase 2.2.
criterio_de_escalonamento: N/A
Status: FASE_2_1_VALIDADA
