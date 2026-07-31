# Implementação de Chat Presence (Digitando...)

## Goal
Implementar o indicador de "digitando..." (Chat Presence) para mascarar a latência do LLM e do RAG no Agentic Loop do orquestrador, atualizando a interface `Messenger` (que no código se chama `ports.MessageSender`).

## Tasks
- [ ] Task 1: Adicionar método `SendPresence(ctx context.Context, to string, state string) error` em `internal/ports/whatsapp.go` → Verify: O projeto compila e a interface expõe o novo contrato.
- [ ] Task 2: Implementar o método `SendPresence` na struct concreta `EvolutionAdapter` em `internal/adapter/evolution/adapter.go` → Verify: O `EvolutionAdapter` satisfaz a nova interface.
- [ ] Task 3: Injetar a chamada `SendPresence(ctx, o.Phone, "composing")` no Agentic Loop em `internal/state/orchestrator.go` ANTES de `o.LLM.GenerateContent`. Adicionar o disparo de estado `"paused"` via `defer` → Verify: Durante as requisições, o bot exibe "digitando..." no WhatsApp e "paused" ao finalizar.

## Done When
- [ ] O orquestrador dispara corretamente os estados "composing" antes das chamadas de LLM.
- [ ] Se o LLM demorar mais devido a tool calls repetidas no Agentic Loop, o "digitando..." é re-enviado a cada nova iteração do loop.
- [ ] O estado é pausado ("paused") quando a resposta é entregue ou em caso de erro.
