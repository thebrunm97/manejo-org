# ADR-011: Abstração de Canal de Chat — WhatsApp e app como adaptadores de um núcleo único

## Status: Proposto

## Contexto

O assistente conversacional só existe hoje dentro do WhatsApp, e não por acidente
de nomenclatura: a identidade do usuário **é o número de telefone** em praticamente
todo o pipeline. `GetProfileByPhone`
([`pmo-bot-go/internal/supabase/client.go:570-629`](../../../pmo-bot-go/internal/supabase/client.go))
resolve o perfil por telefone com três fallbacks em cascata, sendo o terceiro
`telefone=ilike.*<últimos 8 dígitos>*` (`:616-618`) — um casamento por substring na
própria coluna de identidade, que colide se dois produtores tiverem os mesmos 8
dígitos finais. O estado da conversa (`history.Manager`) é
`map[phone]*Conversation` **em memória**
([`pmo-bot-go/internal/history/manager.go:26`](../../../pmo-bot-go/internal/history/manager.go)),
com TTL de 45 minutos em produção, e **morre a cada deploy** — registrado como DT-58.
O mutex de concorrência por sessão também é keyed em telefone
([`pmo-bot-go/internal/state/fsm.go:50-56`](../../../pmo-bot-go/internal/state/fsm.go)),
assim como a chave de idempotência de chamada de ferramenta
(`SHA256(phone + ":" + message_id + ...)` em
[`pmo-bot-go/internal/guardrails/idempotency.go:59-67`](../../../pmo-bot-go/internal/guardrails/idempotency.go)).
**Não existe, em nenhum lugar do sistema, uma entidade de sessão ou conversa** — a
telemetria loga um campo `conversation_id`, mas o valor que ele recebe é o telefone.

A tabela `messages` reflete a mesma premissa:
`(message_id, timestamp, status, source, phone, content, role)`
([`supabase/migrations/20260402120000_create_operational_tables.sql:152-161`](../../../supabase/migrations/20260402120000_create_operational_tables.sql)),
sem `user_id`, sem `conversation_id`, e com uma única policy de RLS —
"Admins acessam mensagens" — o que significa que **o próprio produtor não pode ler
o histórico da própria conversa** via API.

A porta de saída, no entanto, não parte do zero. `ports.MessageSender` em
[`pmo-bot-go/internal/ports/whatsapp.go:9-19`](../../../pmo-bot-go/internal/ports/whatsapp.go)
e o `IncomingMessage` associado já são comentados como "agnóstica ao provider", e há
um plano de refatoração hexagonal já escrito
([`pmo-bot-go/docs/plans/WHATSAPP_REFACTOR_PLAN.md`](../../../pmo-bot-go/docs/plans/WHATSAPP_REFACTOR_PLAN.md)).
Mas a interface ainda vaza conceitos de WhatsApp por todo lado: `to string` é
telefone, `SendVoice(to, base64Audio, isPtt bool)` carrega um parâmetro que só
existe porque WhatsApp distingue nota de voz de áudio comum, `SendButton(to, title,
description, footer string, buttons []map[string]string)` serializa botões no
formato do Baileys, e `DownloadAudio(messageID string, rawPayload []byte)` só faz
sentido para quem recebeu um webhook — um upload de app já tem os bytes em mãos e
não tem `messageID` nenhum para consultar. Cerca de 30 pontos do código (em `state/`
e `webhook/`) chamam a porta diretamente, contornando a única camada de entrega que
já existe (`queue/delivery.go`). **A hexagonalização foi começada e parou no meio**
— este ADR continua um trabalho já iniciado, não inaugura um.

Do outro lado, há ativos prontos que reduzem bastante o que falta construir.
`LiveChatMonitor.tsx` já assina Supabase Realtime sobre a tabela `messages`
([`pmo-frontend/src/pages/admin/LiveChatMonitor.tsx:135`](../../../pmo-frontend/src/pages/admin/LiveChatMonitor.tsx)) —
o transporte para um chat web já roda em produção, só falta o consumidor certo.
`ports.Synthesizer` (TTS) e `ResolveResponseModeFor` já são genuinamente agnósticos
de canal. `domain.ProcessAudioMessage(ctx, audioData, mimeType, …)` em
[`pmo-bot-go/internal/domain/router.go:44-50`](../../../pmo-bot-go/internal/domain/router.go)
já tem a assinatura certa — recebe bytes crus, não um `messageID` de provider — mas
está **desligada**, com `TODO(fase-5-ou-switchover)` nos dois caminhos de produção
que ainda duplicam a lógica de transcrição. E o gateway web já resolve identidade
por JWT: `internal/middleware/auth.go` decodifica o token ES256 do Supabase e expõe
`ContextUserID` (o `sub` do token, isto é, `auth.users.id`) para os handlers — que é
exatamente o modelo de identidade que um chat no app deveria usar, e que hoje é
**completamente disjunto** do pipeline do bot, que nunca vê um JWT.

Existe também um spike já escrito para essa direção:
[`pmo-frontend/docs/specs/future_spike_in_app_bot.md`](../../../pmo-frontend/docs/specs/future_spike_in_app_bot.md)
("In-App AI Assistant — Omnichannel"), mas está desatualizado — assume um backend
FastAPI que não existe mais; o backend é este serviço Go.

Por fim, este ADR tem uma dependência direta do [ADR-010](./010-multitenancy-por-organizacao.md):
hoje o "tenant ativo" de um usuário vive em `profiles.pmo_ativo_id`, um campo global
mutável, lido inclusive dentro de predicados de RLS. Se um chat no app e uma
conversa no WhatsApp coexistirem sem o tenant viajar dentro da própria sessão, trocar
de contexto num canal muda silenciosamente o que o outro canal vê — o pior tipo de
bug de multitenancy, porque não aparece em teste unitário, só em uso concorrente
real.

## Decisão

O núcleo conversacional passa a ser agnóstico de transporte. WhatsApp e o chat do
app (web/PWA primeiro, nativo depois) são dois **adaptadores** do mesmo contrato,
não dois sistemas paralelos. A primeira implementação nova é o chat web/PWA, sobre
Supabase Realtime.

1. **Identidade canônica passa a ser `user_id`** (o mesmo `auth.users.id` que o
   gateway web já resolve por JWT). Telefone deixa de ser chave primária de nada e
   vira **um identificador de canal entre outros**, guardado numa tabela de vínculo
   canal↔usuário. O fallback por `ilike` dos últimos 8 dígitos não sobrevive à
   migração — ele só existe porque telefone é hoje a única chave; com `user_id`
   como identidade, essa ambiguidade deixa de ter motivo para existir.

2. **Conversa/sessão vira entidade de primeira classe, persistida.** Isso resolve
   dois problemas ao mesmo tempo: o estado que hoje mora só em memória e morre a
   cada deploy (DT-58), e a possibilidade de um mesmo usuário continuar a mesma
   conversa saindo do celular para o navegador.

3. **O tenant ativo viaja na sessão, não em `profiles`.** Consequência direta do
   ADR-010: uma sessão de chat carrega o `organizacao_id` (ou `pmo_id`, conforme o
   ADR-010 definir) sob o qual ela está operando, em vez de depender de um campo
   global por usuário. Sem isso, este ADR reintroduz o bug de contexto compartilhado
   descrito no Contexto assim que dois canais coexistirem.

4. **Capacidades são declaradas por canal, não assumidas pelo núcleo.** O app
   suporta streaming de resposta e componentes ricos; o WhatsApp não suporta nem um
   nem outro. O núcleo não deve nivelar por baixo (perder streaming no app) nem
   quebrar no canal mais simples (mandar um card React para o WhatsApp). Isso
   substitui os parâmetros WhatsApp-específicos da porta atual (`isPtt`, string de
   `presence`, `[]map[string]string` de botões) por um envelope de saída tipado, com
   um conjunto de capacidades que cada adaptador declara suportar.

5. **Mídia de entrada passa a aceitar bytes diretamente**, não só
   `(messageID, rawPayload)` — um upload de app já tem o blob em mãos. A função
   `domain.ProcessAudioMessage` já tem essa assinatura; a decisão aqui é ligá-la como
   caminho único, em vez de manter as duas implementações duplicadas que hoje
   existem em `queue/media_worker.go` e `state/fsm.go`.

6. **O transporte do chat no app é o Supabase Realtime já em produção**, sobre uma
   `messages` reformulada para carregar `user_id`, `conversation_id` e `canal`, com
   RLS que finalmente permita ao dono da conversa ler o próprio histórico — hoje
   nem isso é possível.

7. **Toda chamada de saída passa a ir por um único funil de entrega.** As ~30
   chamadas diretas à porta hoje espalhadas por `state/` e `webhook/` convergem para
   o que `queue/delivery.go` já quase é.

## Por que não um segundo bot dentro do app

A alternativa mais rápida seria implementar um assistente separado, direto no
frontend, chamando o LLM sem passar pelo pipeline do bot. Foi descartada porque
duplicaria os guardrails que hoje só existem do lado do bot — blacklist de insumos
proibidos, HITL para mutações sensíveis — exatamente o mesmo problema que o
[ADR-009](./009-gateway-go-complementa-fat-database.md) já identificou para escrita
via web ("essas checagens hoje só existem do lado do bot"). Um segundo bot duplicaria
a lógica em dois lugares até divergir; um núcleo único com adaptadores por canal
mantém a lógica de negócio (e as guardrails) num único ponto de verdade.

## Justificativa

- **Reaproveita infraestrutura real**: Supabase Realtime já roda em produção
  (`LiveChatMonitor`), então o chat do app não precisa de WebSocket novo nem de
  polling.
- **Conclui um trabalho já começado**: a porta `MessageSender`/`IncomingMessage` e o
  plano de refatoração hexagonal já existem; este ADR dá a eles um destino concreto
  em vez de deixá-los como intenção documentada e não terminada.
- **Reaproveita a camada de TTS e de preferência de resposta**, que já são
  agnósticas de canal — o trabalho novo se concentra onde a WhatsApp-specificidade
  realmente está: identidade, sessão e a porta de saída.
- **Depende do ADR-010 de forma explícita**, em vez de reinventar isolamente uma
  noção própria de "contexto ativo" que divergiria da decisão de tenant.

## Consequências

- (+) O mesmo núcleo de conversa, guardrails e ferramentas atende WhatsApp e app,
  sem duplicação de lógica de negócio.
- (+) O usuário passa a poder ler o próprio histórico de conversa — hoje bloqueado
  por uma RLS que só permite acesso de admin.
- (+) Estado de conversa deixa de morrer a cada deploy.
- (-) Migrar identidade de telefone para `user_id` toca cerca de 20 pontos do
  código (resolução de perfil, chave de FSM, mutex de sessão, idempotência de tool,
  auditoria) — é um trabalho transversal, não uma mudança isolada.
- (-) Strings de copy hoje hardcoded para WhatsApp (`onboarding.go`, mensagens de
  erro em `media_worker.go`, o prompt de sistema em `proactivity/worker.go` que
  assume "é para WhatsApp") precisam ser parametrizadas por canal.
- (-) `IsFromMe` e `IsBroadcast`, hoje campos do `IncomingMessage` genérico, são
  conceitos que só fazem sentido para o adaptador WhatsApp e deveriam parar de
  vazar para o núcleo.
- (-) **Este ADR não avança sem a decisão do ADR-010 sobre identidade e tenant** — a
  ordem de implementação depende de qual dos dois anda primeiro na prática, mas o
  desenho de sessão aqui pressupõe que o tenant ativo é resolvido do jeito que o
  ADR-010 decidir.

**Escopo desta fatia**: este ADR decide a direção — identidade canônica, sessão
persistida, contrato de porta por capacidades, e transporte via Realtime. Nenhum
código muda nesta rodada. O documento
[`future_spike_in_app_bot.md`](../../../pmo-frontend/docs/specs/future_spike_in_app_bot.md)
fica superado por este ADR quanto à decisão arquitetural, ainda que seus requisitos
táticos (MediaRecorder, permissões de microfone no iOS) continuem válidos como
insumo para o plano de implementação.

Referências: [ADR-010](./010-multitenancy-por-organizacao.md) (dependência de
identidade e tenant), [ADR-009](./009-gateway-go-complementa-fat-database.md),
[`WHATSAPP_REFACTOR_PLAN.md`](../../../pmo-bot-go/docs/plans/WHATSAPP_REFACTOR_PLAN.md),
[`pmo-bot-go/docs/debitos_tecnicos.md`](../../../pmo-bot-go/docs/debitos_tecnicos.md)
(DT-58).
