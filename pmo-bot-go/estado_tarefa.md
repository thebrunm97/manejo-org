# Estado Tarefa: Integração TTS (Voice Notes)
task_id: TTS-001
objetivo_atual: Implementar client_test.go e client.go do TTS seguindo os contratos de erros e magic bytes (MP3/ID3).
hipotese_de_falha: N/A
evidencia: Loop TDD finalizado com sucesso. Testes passando (RED -> GREEN). Refatoração Client -> Orchestrator aplicada globalmente sem quebrar build.
tentativas_restantes: 4
proxima_acao: Informar o usuário que a Fase 3 (Execute) foi concluída e o contrato PTT/MP3 validado via testes.
criterio_de_escalonamento: Esgotar tentativas ou o provedor falhar de forma não mapeada.
Status: CONCLUÍDO

## Pendências (Bug Tracking)
- **RAG Integration**: O teste `TestIngestionObservability` (em `tests/integration_obs_test.go`) e dependentes falham intermitentemente com o erro Supabase `PGRST204: Could not find the 'file_name' column of 'ingestion_jobs'`.
  - **Motivo provável**: Falha de cache do PostgREST ou schema `migrations/20240305_create_ingestion_jobs.sql` desatualizado/não rodou no ambiente do teste.
  - **Status**: Anotado para investigação em ciclo independente, já que não pertence ao escopo de Voice Notes e antecede essa implementação.

- **Nemotron Monitoring (Tech Debt)**: Implementar infraestrutura de monitorização contínua do hit-rate do Nemotron S3 para detetar regressões no OpenRouter.
  - **Motivo**: O `nemotron-3-ultra-550b-a55b:free` obedece perfeitamente ao schema (100% hit-rate), mas a sua estabilidade provou-se estruturalmente inconsistente dependendo do provedor/rota ativa no OpenRouter (ocasionais `empty responses` e latências flutuantes entre 600ms e 14s).
  - **Plano Operacional**:
    1. Ajustar `nemotron_baseline.go` para escrever as métricas (`timestamp`, `hit_rate`, `latency`, etc) num `nemotron_monitoring.csv`.
    2. Criar workflow de GitHub Actions (`.github/workflows/nemotron-monitor.yml`) com cron (`0 14 * * *`) que corre o script, faz push do CSV e envia notificação (Slack) caso o *hit-rate* caia < 90%.
  - **Status**: Pendente implementação futura (desenhado no Wayfinder Map: Nemotron Schema Compliance).
