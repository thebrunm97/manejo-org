# ADR-011: Abstração de Canal de Chat

## Goal
Desacoplar o núcleo do bot do WhatsApp, transformando-o em um motor agnóstico que atenda WhatsApp e Web simultaneamente, com sessões persistidas e identidade baseada em `user_id`.

## Tasks
- [ ] Task 1: **Schema de Sessões Persistidas** (Supabase) - Criar tabela `conversations` (`id`, `user_id`, `pmo_id`, `channel`) e migrar `messages` para usar `conversation_id` em vez de `phone`. Ajustar RLS para permitir leitura pelo próprio usuário. → Verify: Rodar `python .agent/skills/database-design/scripts/schema_validator.py .` e garantir que as migrations aplicam com sucesso.
- [ ] Task 2: **Refatoração de Identidade e Tenant** (Backend) - Alterar `history.Manager`, FSM e checagem de idempotência para usar `conversation_id` como chave. Remover fallback por `ilike` nos últimos 8 dígitos. O `pmo_id` ativo deve viajar na sessão. → Verify: `go test ./internal/history ./internal/state` passando com a nova chave.
- [ ] Task 3: **Portas e Envelopes Agnósticos** (Backend) - Remover parâmetros específicos de WhatsApp de `ports.MessageSender`. Criar `OutboundEnvelope` tipado e alterar a entrada de mídia para aceitar bytes diretamente (`domain.ProcessAudioMessage`). → Verify: O código Go compila sem vazamento de domínios específicos (ex: Baileys) no núcleo.
- [ ] Task 4: **Adaptador WhatsApp** (Backend) - Atualizar `webhook/handler.go` para mapear telefone para `user_id` e inicializar/recuperar o `conversation_id`. Implementar o novo `MessageSender` mapeando o envelope para o WhatsApp. → Verify: Simular payload do webhook da Evolution API e verificar se cria a conversa no banco.
- [ ] Task 5: **Funil de Entrega Único** (Backend) - Centralizar todas as ~30 chamadas espalhadas (`state/`, `webhook/`) para usar estritamente `queue/delivery.go`. O funil roteará para o adaptador correto com base no canal da conversa. → Verify: Buscar chamadas diretas à porta do WhatsApp fora do adaptador e garantir que retornam zero resultados.
- [ ] Task 6: **Adaptador Web/PWA** (Backend) - Criar endpoint `/api/v1/chat` autenticado (recebendo bytes) e implementar envio de saída via Supabase Realtime (escrevendo na tabela `messages`). → Verify: Enviar um `POST /api/v1/chat` sintético e verificar a gravação da resposta do LLM no banco via Realtime.
- [ ] Task 7: **Integração no Frontend** (Frontend) - Criar componente de chat na UI web. O componente deve enviar mensagens pelo `goApiClient.ts` e escutar respostas via Supabase Realtime na tabela `messages`. → Verify: Rodar `python .agent/skills/frontend-design/scripts/ux_audit.py .` e testar o fluxo de ponta a ponta no navegador (mensagens enviadas aparecem, bot responde na interface).

## Done When
- [ ] Um produtor consegue conversar com o assistente pelo app da web, o histórico é persistido no Supabase (não se perde em deploies), e o WhatsApp continua funcionando paralelamente sem vazamento de tenant entre canais.

## Notes
- Dependência direta do ADR-010 para a resolução do tenant (o `pmo_id` deve estar na sessão, não apenas em `profiles`).
- A lógica de negócio e os guardrails devem permanecer unificados (evitar criar um bot secundário duplicado no frontend).
