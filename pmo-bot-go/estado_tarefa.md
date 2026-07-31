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
