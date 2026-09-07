# CHECKPOINT — Feature Multicanal (2026-09-07)

> Documento de handoff para retomar a implementação na próxima sessão.
> Branch: `feature-multicanal` | Base: `fix/bigpickle-bugfix-loop`

---

## ⚠️ Adendo de verificação (2026-09-07, sessão seguinte)

O checkpoint abaixo registra o estado no momento em que foi escrito. Uma
verificação posterior encontrou dois problemas que mudam a leitura do "quão
perto estamos de fechar a feature":

**1. `go build ./...` limpo não implicava testes passando.** Sete mocks em
`internal/state`, `internal/queue` e `internal/webhook` ainda implementavam a
interface antiga (`MessageSender`: `SendMessage`/`SendButton`/`SendPresence`)
e não compilavam contra `ChannelSender`. `go test ./...` falhava em três
pacotes. Corrigido nesta sessão seguinte — hoje `go build ./...` e
`go test ./...` passam no módulo inteiro, todos os pacotes.

**2. O núcleo de roteamento multicanal existe só no papel — nada está ligado
em produção.** Achados, seguindo a cadeia até `cmd/server/main.go`:

- `IncomingEnvelope.ConversationID` **nunca é atribuído** em nenhum ponto do
  código de produção (nem pelo adapter Evolution, nem por nenhum outro). O
  campo central de toda a Fase A fica permanentemente vazio.
- Isso não quebra nada *hoje* só por sorte de fallback: `fsm.go` cai para
  `msg.From` quando `ConversationID` é vazio, e `EvolutionAdapter.Send` roteia
  entrega por `env.To` (telefone), nunca por `ConversationID`. O WhatsApp
  funciona porque continua sendo tratado como canal único por baixo do capô.
- `GetOrCreateConversation` e `ResolveIdentity`
  (`internal/supabase/identity.go`) **existem e compilam, mas não são
  chamados em lugar nenhum**. As tabelas `conversations`/`channel_links` da
  Fase A não são populadas nem consultadas pelo bot em execução — daí a
  tabela abaixo marcar B.11 como pendente mesmo o tracker externo
  (`task multichannel`) marcando como `[x]`: a função existe, a integração
  não.
- `DeliveryManager` (`internal/ports/delivery.go`) **nunca é instanciado**.
  Não há `NewDeliveryManager()` nem `RegisterAdapter()` fora do próprio
  arquivo que os define. `main.go:238` injeta o `EvolutionAdapter`
  diretamente como `ChannelSender`, sem passar pelo roteador.
- Os documentos citados em "Referências" abaixo
  (~~`docs/PLAN-feature-multicanal.md`~~, `docs/FEATURE-multicanal.md`, o
  `task.md` em `.gemini/antigravity-ide/brain/...`) **não existem neste
  checkout** — correção: `docs/PLAN-feature-multicanal.md` existe (apareceu
  depois desta verificação inicial); os outros dois continuam ausentes.

---

## ✅ Resolução do adendo acima (2026-09-07, mesma sessão seguinte)

As duas peças "órfãs" foram ligadas, com escopo reduzido por decisão
explícita: **sem popular tenant**, porque isso esbarra num bloqueio real e
documentado — `GetOrCreateConversation` exige `tenant_id`, e o
[ADR-011](architecture/adr/011-abstracao-de-canal-de-chat.md) afirma que essa
abstração "não avança sem a decisão do ADR-010", cujo status é "Proposto".
Detalhe achado no caminho: `ResolveIdentity` (mesma arquivo) faz
`profiles!inner(tenant_id,role)`, mas **a coluna `profiles.tenant_id` não
existe em nenhuma migração** — chamá-la quebraria em runtime. Ela continua
não sendo usada por nada; não fazia parte do escopo aprovado corrigir isso.

Mudanças:

1. **`GetOrCreateConversation` tolera `tenantID=""`** — trata como "sem
   tenant ainda" (`tenant_id=is.null` na busca, chave omitida no INSERT) em
   vez de mandar uma string vazia, que o PostgREST rejeitaria como UUID
   inválido (`22P02`).
2. **`DeliveryManager` ganhou fallback de canal vazio → `ChannelWhatsApp`**
   em `Send`/`SendTyping`/`DownloadMedia`. Necessário porque **nenhum ponto
   de saída em produção define `env.Channel`** — sem o fallback, ligar o
   `DeliveryManager` derrubaria toda mensagem de saída do bot.
3. **`ProcessMessage` (`fsm.go`) agora popula `msg.ConversationID`**, um
   único call site, logo após resolver o perfil por telefone — best-effort,
   nunca bloqueia o atendimento.
4. **`main.go` instancia o `DeliveryManager`** e registra o `EvolutionAdapter`
   sob `ChannelWhatsApp`; os 7 pontos que recebiam `wpClient` como
   `ChannelSender` passam a receber o `deliveryManager`. `wpClient`
   (tipo concreto) continua injetado só onde a interface `ChannelSender` não
   basta: as duas chamadas de configuração de webhook, e `selfheal.NewHealer`
   (que exige `selfheal.Gateway`, com `FetchInfo`/`FetchStatus`/
   `ForceReconnect` — específicos do Evolution, fora de `ChannelSender`).

Build e suíte de testes completos, módulo inteiro:
```
go build -p 2 ./...  → exit 0
go test -p 2 ./...   → ok em todos os pacotes
```
Três arquivos de teste novos cobrindo especificamente este trabalho:
`internal/supabase/identity_test.go`, `internal/ports/delivery_test.go`,
`internal/state/conversation_wiring_test.go`.

**O que continua fora do escopo**, sem mudança nesta sessão:
- Tenant real por conversa — trancado até o ADR-010 sair de "Proposto".
- `ResolveIdentity` e `channel_links` — ainda não usados por nada; o bug da
  coluna inexistente segue lá, documentado no código.
- Fase C (Web/PWA) — zero código.

**Conclusão prática:** a Fase B não é "faltam B.8–B.11" — é "o esqueleto de
dados e as interfaces estão prontos e testados, mas a integração que faria
mais de um canal conviver ainda não começou". Antes de B.8 (idempotência) ou
B.10 (quota por canal) fazerem sentido, alguém precisa: (a) religar
`GetOrCreateConversation` nos adapters de entrada, populando `ConversationID`
de verdade; (b) instanciar o `DeliveryManager` em `main.go` no lugar da
injeção direta do `EvolutionAdapter`. A Fase C (Web) não tem nenhuma linha de
código — nem pasta de adapter, nem SSE, nem WebSocket.

---

## ✅ Estado atual: BUILD LIMPO

```
go build ./...  → exit code 0  (03:15 BRT, 2026-09-07)
go test ./...   → exit code 0, todos os pacotes  (verificado na sessão seguinte)
```

---

## O que foi feito até aqui

### Fase A — Schema & Ports (COMPLETA)

- Migração do schema Supabase (`conversations`, `channel_links`, mensagens com `channel` + `channel_message_id`)
- Políticas RLS completas (produtor, admin, HITL)
- Interface `ports.ChannelSender` definida em `internal/ports/channel.go`
- `ports.OutboundEnvelope` como struct único para toda saída
- `ports.IncomingEnvelope` expandido com `ChannelMsgID`, `ConversationID`, `UserID`

### Fase B — Core Refactor (COMPLETA exceto B.8/B.9/B.10)

| Item | Status | Notas |
|------|--------|-------|
| B.1 — `ChannelSender` interface | ✅ | `internal/ports/channel.go` |
| B.2 — `OutboundEnvelope` | ✅ | campos: text, audio, buttons, reply |
| B.3 — `DeliveryManager` | ✅ | `internal/ports/delivery.go` |
| B.4 — FSM usa `ChannelSender` | ✅ | `internal/state/fsm.go` |
| B.5 — `sendFeedback` migrado | ✅ | `internal/state/utils.go` |
| B.6 — `onboarding.go` migrado | ✅ | usa `OutboundEnvelope` |
| B.7 — `response_preference_command.go` | ✅ | |
| B.8 — Idempotência (Redis check) | ❌ **PENDENTE** | No `DeliveryManager` |
| B.9 — HITL/Pausa logic | ❌ **PENDENTE** | integração com `DeliveryManager` |
| B.10 — Quota por canal com pesos | ❌ **PENDENTE** | |
| B.11 — `GetOrCreateConversation` | ❌ **PENDENTE** | centralizar em todos os adapters |
| B.X — `EvolutionAdapter.Send()` | ✅ | adicionado nesta sessão |
| B.X — `WppConnect.Send()` | ✅ | adicionado nesta sessão |
| B.X — `SendTyping()` nos adapters | ✅ | implementado/no-op |
| B.X — `DownloadMedia` unificado | ✅ | queue/media_worker usa `DownloadMedia` |

### Fase C — Web/PWA Channel

| Item | Status |
|------|--------|
| C.1 — Adapter Web (SSE/WebSocket) | ❌ PENDENTE |
| C.2 — Auth PKCE para chat web | ❌ PENDENTE (branch separada: `PLAN-f1-auth-pkce.md`) |
| C.3 — RLS para chat web | ❌ PENDENTE |

---

## Arquivos modificados nesta sessão

```
internal/
  state/
    fsm.go                          — locking por ConversationID; sendFeedback corrigido
    utils.go                        — sendFeedback usa OutboundEnvelope; stale 'channel' removido
    orchestrator.go                 — SendPresence → SendTyping
    onboarding.go                   — botões via OutboundEnvelope
    response_preference_command.go  — msg.* → from; context import adicionado
    tool_pipeline.go                — SendButton → OutboundEnvelope
  adapter/
    evolution/adapter.go            — Send() + SendTyping() IMPLEMENTADOS
    wppconnect/adapter.go           — Send() + SendTyping() IMPLEMENTADOS
  queue/
    delivery.go                     — SendVoice → Send(OutboundEnvelope)
    media_worker.go                 — DownloadAudio/Image → DownloadMedia; strings corrigidas
    ai_worker.go                    — SendTyping corrigido; defer SetPresence removido
  webhook/
    handler.go                      — SendTyping corrigido; MessageSender → ChannelSender
  jobs/
    plantio.go                      — MessageSender → ChannelSender
  proactivity/
    worker.go                       — MessageSender → ChannelSender
  api/
    chat_admin.go                   — MessageSender → ChannelSender
  gemini/
    client.go                       — session.Send restaurado (genai.Part*)
cmd/
  server/main.go                    — MessageSender → ChannelSender
```

---

## Próximos passos (ordem recomendada)

### 1. B.11 — `GetOrCreateConversation` (Alta prioridade)

Centralizar a lógica de criação/reativação de conversa. Todos os adapters de entrada devem chamar este método antes de invocar `ProcessMessage`.

```go
// internal/state/conversation.go (novo)
func GetOrCreateConversation(ctx context.Context, sb *supabase.Client, tenantID, userID, channel string) (conversationID string, err error)
```

- Chaveado por `(tenant_id, user_id)` — histórico unificado
- Cria se não existe, reactiva se `status = closed`
- Registra `channel_links(channel, channel_user_id, user_id)`

### 2. B.8 — Idempotência no `DeliveryManager`

Em `internal/ports/delivery.go`, antes de despachar:
```go
// Check Redis para OutboundEnvelope.ID (idempotency key)
// Se já entregue → skip silencioso com log
```

### 3. B.10 — Quota com pesos por canal

Arquivo: `internal/state/fsm.go` (seção de quota check)
- Web: peso 1.0
- WhatsApp: peso 1.0  
- Telegram: peso 0.8 (definido no plano)

### 4. Fase C — Adapter Web

Criar `internal/adapter/web/adapter.go`:
- Implementa `ChannelSender`
- `Send()` publica no canal SSE/Redis da conversa
- `SendTyping()` emite evento `typing` via SSE
- Registrar no `DeliveryManager` com `ChannelWeb`

---

## Referências

| Documento | Caminho |
|-----------|---------|
| Plano completo (v2) | `docs/PLAN-feature-multicanal.md` |
| Feature doc | `docs/FEATURE-multicanal.md` |
| Auth PKCE (paralelo) | `docs/PLAN-f1-auth-pkce.md` |
| Task list | `.gemini/antigravity-ide/brain/bf6aa1f5-.../task.md` |
| Implementation plan | `.gemini/antigravity-ide/brain/bf6aa1f5-.../implementation_plan.md` |

---

## Convenções estabelecidas

- **Nunca** usar `MessageSender` — interface removida, usar `ChannelSender`
- **Nunca** chamar `SendMessage(phone, text)` diretamente — usar `Send(ctx, OutboundEnvelope)`
- **Nunca** chamar `SendPresence/SetPresence` — usar `SendTyping(ctx, channel, to)`
- **Nunca** chamar `DownloadAudio/DownloadImage` — usar `DownloadMedia(ctx, msgID, rawPayload)`
- `sendFeedback(sbClient, wpClient, ttsClient, convID, to, message, respondWithAudio)` — 7 params
- Botões interativos: `OutboundTypeButtons` + `Buttons []map[string]string` com keys `id`, `displayText`, `type`

---

*Gerado automaticamente em 2026-09-07T03:15 BRT*
