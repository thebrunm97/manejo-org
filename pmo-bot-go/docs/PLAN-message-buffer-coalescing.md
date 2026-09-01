# PLAN-message-buffer-coalescing

> **Status:** 🟢 **DT-68 EM PRODUÇÃO DE VERDADE desde 2026-09-01** —
> `MESSAGE_BUFFER_WINDOW=4s`/`MESSAGE_BUFFER_MAX=12s`, valores reais, não mais o kill-switch.
> Rollout completo: schema em staging (validado 5/5) e produção, deploy do binário em duas
> etapas (primeiro com kill-switch para confirmar deploy saudável, depois com os valores reais),
> cada etapa com confirmação explícita do responsável. Dois efeitos colaterais descobertos e
> resolvidos no caminho, nenhum causando incidente: (1) editar `.env.prod` recria também o
> `evolution-go` (mesmo `env_file`) — reconectou sozinho ao WhatsApp duas vezes, sem pedir QR
> novo, sessão persistida no volume `evolution_data` confirmada intacta nas duas; (2) o
> classificador de auto mode bloqueou o segundo `docker compose up` (comando idêntico ao já
> rodado antes na mesma sessão) — passou na segunda tentativa após reconfirmação em chat.
> **Falta só:** o passo 5 (observar `message_buffer_parts_per_turn`/`merged_total`/
> `added_latency_seconds` por pelo menos um dia de uso real antes de considerar encerrado —
> ainda não decorreu tempo suficiente no momento em que isto foi escrito). Achados de teste
> corrigidos no caminho: `msg_id` fixo colidindo com índice único aplicado por tarefa paralela;
> `supabase db reset` de outra sessão/worktree revertendo o schema LOCAL (staging/produção
> nunca afetados, só
> retrabalho local) — ver seção 6.3. · **Data:** 2026-09-01 · **Rastreio:** DT-68
> **Componentes:** `internal/queue`, `internal/config`, `supabase/migrations/`, RPC `claim_next_message_job`

## 🎯 Objetivo

Agrupar as mensagens fragmentadas que um mesmo produtor envia em sequência, de modo que um
turno de conversa gere **um** raciocínio de IA e **uma** resposta, em vez de um por fragmento.

## 🛑 Problema

Agricultor escreve como fala. "plantei alface hoje" / "no talhão 3" / "umas 200 mudas"
chegam como três mensagens em ~4 segundos. Hoje cada uma vira um job independente na
`message_queue` (`Manager.Enqueue`, `internal/queue/manager.go:98`), é reivindicada
separadamente pelo AI Worker e produz sua própria resposta.

Três custos:

1. **Custo direto:** 3× chamadas de LLM, 3× tool calls, 3× TTS. Numa VPS de 2 vCPUs onde o
   Piper é o único gargalo de CPU (ver DT-38), isso é capacidade desperdiçada.
2. **Confusão do produtor:** três respostas para um pedido só.
3. **Registro incompleto:** o FSM pode chamar `RegistrarPlantio` com "alface" antes de o
   talhão e a quantidade chegarem, obrigando a correção depois — exatamente o tipo de
   registro meia-boca que o caderno de campo não deveria aceitar.

O único debounce existente hoje é o de *avisos de erro*
(`sendDebouncedWarning`, `internal/webhook/handler.go:852`), que não tem nenhuma relação
com este problema.

## 🧭 Decisão de arquitetura

**A coalescência acontece no claim do AI Worker, sobre jobs já em `ai_pending`** — ou seja,
depois da resolução de mídia.

Alternativas descartadas:

- **Timer em memória no webhook.** Perde mensagens em restart/deploy e não sobrevive a mais
  de uma réplica. É o mesmo defeito que o `history.Manager` (`internal/history/manager.go`)
  já tem hoje, e não queremos uma segunda ocorrência dele.
- **Merge no momento do `Enqueue`.** Não resolve o caso "áudio + texto complementar": o job
  de áudio está travado pelo `MediaWorker` em transcrição (segundos de I/O) e não pode
  receber merge nenhum enquanto isso.

Bufferizar **depois** da mídia faz o caso áudio+texto funcionar de graça: os dois chegam a
`ai_pending` já como texto e são drenados juntos.

### O que o código já oferece (verificado)

Dois achados que encurtam bastante a implementação:

1. **Não precisa de coluna nova de agendamento.** A `message_queue` já tem
   `next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   (`supabase/migrations/20260402120000_create_operational_tables.sql:184`) e a RPC de claim
   **já filtra por `next_retry_at <= NOW()`**
   (`supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:146`). O portão de
   "ainda não elegível" existe e está em produção. Basta escrever nele na promoção para
   `ai_pending`.
2. **Só existe um caminho de promoção para `ai_pending`.** É `Manager.MarkAIPending`
   (`internal/queue/manager.go:252`), chamado de um único lugar
   (`internal/queue/media_worker.go:153`). Mensagem de texto puro também passa pelo
   MediaWorker — não há atalho `pending → ai_pending` em outro lugar. Logo o cálculo da
   janela nasce centralizado, sem risco de divergir entre dois produtores de job.

Sobre reusar `next_retry_at` em vez de criar `buffer_until`: os outros dois escritores da
coluna são o backoff de retry (`manager.go:323`) e o reaper (`reaper.go:175`), que atuam em
fases distintas do ciclo de vida do job. A semântica é a mesma — "não elegível antes de X" —
e o reaper, no pior caso, apenas antecipa a elegibilidade de um job já velho. Reuso é
seguro; a única perda é de expressividade no nome da coluna.

## ⚙️ Mecanismo

1. **Janela.** Em `MarkAIPending`, definir
   `next_retry_at = LEAST(now() + MESSAGE_BUFFER_WINDOW, created_at + MESSAGE_BUFFER_MAX)`.
   O teto garante que uma rajada contínua não adie a resposta indefinidamente.
2. **Dreno no claim.** A RPC `claim_next_message_job`, quando `p_from_status = 'ai_pending'`,
   passa a — **na mesma transação do claim do pai** — selecionar os demais jobs do
   **mesmo `from_phone`** em `ai_pending` com `next_retry_at <= now()`, sob
   `FOR UPDATE SKIP LOCKED`, concatenar os `body_text` em ordem de `created_at` (separador
   `\n`), marcar os filhos com `status = 'merged'` + `merged_into_job_id` e devolver o pai
   com o texto combinado e `parts_count` preenchido.
3. **Desligado é no-op.** `MESSAGE_BUFFER_WINDOW=0` faz `next_retry_at = now()` e a RPC não
   encontra irmãos elegíveis com folga — comportamento idêntico ao de hoje.

## 🔧 Parâmetros

| Env | Default | Nota |
|-----|---------|------|
| `MESSAGE_BUFFER_WINDOW` | `4s` | `0` desativa a feature por completo |
| `MESSAGE_BUFFER_MAX` | `12s` | teto absoluto contado de `created_at` do primeiro fragmento |

Lidos em `internal/config/config.go`, no mesmo padrão `os.Getenv` do resto. Sob feature flag
no Flagsmith (`FLAGSMITH_ENV_KEY` já configurado) para rollout gradual e desligamento sem
deploy.

## ⚠️ Efeitos colaterais e mitigações

- **Latência percebida:** todo turno passa a custar +4s. Mitigar disparando presence
  `composing` (`EvolutionAdapter.SendPresence`, `internal/adapter/evolution/adapter.go:172`)
  na promoção para `ai_pending`, para que o produtor veja "digitando…" durante a janela.
- **Confirmações de HITL:** um "sim" isolado também espera a janela. Aceitável em 4s. Se
  incomodar, adicionar bypass quando houver `hitl_pending` aberto para o telefone — cuidado
  para não reabrir o problema do interceptor de SIM/NÃO descrito no DT-64.
- **Modo de resposta:** `respond_audio` é resolvido por mensagem no `Enqueue`
  (`ports.ResolveResponseMode`). Ao fundir, vale o valor do **último** fragmento por
  `created_at` — é a manifestação mais recente da preferência do produtor.
- **Auditoria:** filhos não são deletados. Ficam com `status='merged'` e
  `merged_into_job_id`, preservando a trilha até o `raw_payload` de cada mensagem, que o
  DT-42 (LGPD) já rastreia com TTL próprio.
- **Deduplicação:** inalterada. O upsert por `msg_id` no `Enqueue` continua acontecendo por
  mensagem, antes de qualquer merge.
- **`cleanup_message_queue`:** conferir se a rotina de limpeza precisa conhecer o novo status
  `merged` para não deixar lixo acumulado.

## 📊 Observabilidade

- `message_buffer_merged_total` (counter) — fragmentos absorvidos.
- `message_buffer_parts_per_turn` (histogram) — fragmentos por turno de IA.
- `message_buffer_added_latency_seconds` (histogram) — espera real introduzida.

A métrica que valida a feature: cauda de `parts_per_turn > 1` significativa, somada à queda
proporcional de chamadas de LLM por mensagem recebida. Se `parts_per_turn` ficar colado em
1,0 na população real, a feature não se paga e deve ser desligada pela flag.

## 📋 Plano de implementação

> **Estado em 2026-09-01:** Fases 1-4 escritas e no working tree (não commitadas, não
> aplicadas a nenhum banco). Fase 5 escrita mas **não executada** — ver nota no final desta
> seção. Fase 6 não iniciada.

**Fase 1 — Migration.** ✅ Escrita:
`supabase/migrations/20260901120000_add_message_queue_buffer_coalescing.sql`. Colunas
`merged_into_job_id UUID NULL REFERENCES message_queue(id) ON DELETE SET NULL` e
`parts_count INTEGER NOT NULL DEFAULT 1 CHECK (parts_count >= 1)` em `message_queue`; índice
parcial `message_queue_ai_pending_phone_ready_idx` em `(from_phone, next_retry_at) WHERE
status = 'ai_pending'`. Nenhum backfill necessário e nenhuma coluna de agendamento nova (ver
"O que o código já oferece"). **Não aplicada a nenhum ambiente** — aplicar em staging e
produção juntos, como manda o DT-46, é uma decisão explícita do responsável, não algo a
disparar sozinho.

**Fase 2 — RPC de claim.** ✅ Escrita e **corrigida após um bug real de concorrência pego pela
Fase 5** (ver detalhes na Fase 5 abaixo):
`supabase/migrations/20260901120100_add_message_queue_drain_on_claim.sql`. A versão FINAL usa
`pg_try_advisory_xact_lock` por telefone para serializar o dreno inteiro — não um simples
`FOR UPDATE SKIP LOCKED` por linha, que a primeira tentativa usava e que se provou insuficiente
sob concorrência real (o próprio arquivo da migration documenta o histórico de design, de
propósito, incluindo a versão que falhou). `cleanup_message_queue` também passou a varrer
`status = 'merged'` — sem isso jobs fundidos nunca seriam limpos. Contrato de retorno da RPC
inalterado (continua 0 ou 1 linha), então **zero mudança exigida no client Go além da própria
Fase 3**. `p_worker_id` segue aceito e não usado, como já era. **Aplicada apenas ao Postgres
local de desenvolvimento** (validada ali, ver Fase 5) — não aplicada a staging/produção.

**Fase 3 — Produtor do job.** ✅ Feita, com uma correção sobre o desenho original: não existe
`internal/config` genérico para isto — o padrão real do projeto (confirmado em
`cmd/server/main.go`, ex: `AUDIT_GC_INTERVAL`/`REAPER_INTERVAL`) é um helper
`parseEnvDuration(key, default)` local ao `main.go`. Implementado assim:
`Manager.SetBufferConfig(window, max time.Duration)` (novo método, defaults
`DefaultMessageBufferWindow=4s`/`DefaultMessageBufferMax=12s` em `NewManager`), chamado no
startup com `parseEnvDuration("MESSAGE_BUFFER_WINDOW", ...)` /
`parseEnvDuration("MESSAGE_BUFFER_MAX", ...)`. `MarkAIPending` ganhou um parâmetro
`createdAt time.Time` (o `Job` não carregava `created_at` antes — adicionado a `jobRow` e
`Job`) e agora calcula e grava `next_retry_at = min(now()+window, createdAt+max)`. Caminho
único (`MediaWorker` é o só chamador), sem risco de divergência, confirmado antes de mexer.

**Fase 4 — Worker e presence.** ✅ Feita. `internal/queue/ai_worker.go` já consumia
`body_text` sem mudança (mesmo campo); passou a logar `parts_count` e a alimentar três
métricas Prometheus novas (`message_buffer_merged_total`, `message_buffer_parts_per_turn`,
`message_buffer_added_latency_seconds` — ver `internal/telemetry/metrics.go`). `composing`
disparado em `internal/queue/media_worker.go` logo após `MarkAIPending` (best-effort,
fire-and-forget), fechando a lacuna descrita nos "efeitos colaterais": sem isto o produtor
via silêncio durante toda a janela de buffer, já que o `composing` que o AI Worker já mandava
só disparava depois da espera, não durante.

**Fase 5 — Testes.** ✅ Escritos e **validados contra Postgres real** (6/6 execuções completas
estáveis com `-count=1`, sem cache). Arquivo: `internal/queue/message_buffer_real_postgres_test.go`,
mesmo padrão de `internal/guardrails/mutation_drafts_real_postgres_test.go` (Postgres real via
Docker local, sem skip gracioso). Cobre: (a) dreno de 3 fragmentos com ordem e `respond_audio`
corretos; mensagem isolada inalterada; fragmento com `next_retry_at` futuro ficando de fora;
camada `pending` (mídia) confirmando que não sofre coalescência; (d)/(e) matemática de
`MESSAGE_BUFFER_WINDOW`/`MESSAGE_BUFFER_MAX` em `MarkAIPending`, incluindo o kill-switch
`WINDOW=0`; (b) concorrência real com 5 workers disputando uma rajada de 5 fragmentos.

**Achado da Fase 5 — bug real de concorrência, pego e corrigido.** Ao ligar os testes contra
um Postgres local que subiu durante a sessão (`supabase_kong_manejo-org-app-clean`, isolado da
produção real — confirmado via `docker inspect` que o bot em produção aponta para o projeto
hospedado `hejewayflbuemnffrhae.supabase.co`), o teste de concorrência (item "b" da Fase 5)
pegou exatamente o risco que este plano identificou desde o início como "o único ponto de
risco real de concorrência": a primeira versão da RPC escolhia o "pai" com um simples
`UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)`, sem noção de telefone —
sob concorrência real, dois workers conseguiam cada um vencer o SKIP LOCKED sobre uma linha
DIFERENTE da MESMA rajada (ex: worker A trava "um", worker B trava "dois"), e cada um drenava
só os irmãos que ainda conseguisse pegar, fatiando um turno de 5 fragmentos em 2 ou 3 "pais"
diferentes. Com 5 workers reais disputando 5 fragmentos, o teste mediu exatamente isso: 3
"pais" em vez de 1. Corrigido trocando a unidade de contenção de LINHA para TELEFONE, via
`pg_try_advisory_xact_lock(hashtext('message_queue_ai_pending:' || telefone))` antes de tocar
qualquer linha — só quem detém o lock do telefone dreno o grupo inteiro; quem perde a corrida
desiste da chamada (nada se perde, o próximo poll resolve). Documentado com o histórico
completo (versão errada incluída) direto no comentário da migration, de propósito, para quem
ler a função no futuro entender por que o design é esse e não o mais simples.

**Achado secundário — falso positivo de teste, também corrigido.** Depois do fix acima, uma
execução ainda mostrava "2 reivindicaram" de forma intermitente (3 de 4 rodadas em lote,
0 de 8 rodadas isoladas) — não era mais bug da RPC: o teste de `MarkAIPending` (item "d"/"e")
deixava linhas `ai_pending` órfãs para trás (nunca chamava `ClaimAIPending` nelas), e o teste
de concorrência propositalmente usa mais workers (5) do que fragmentos da própria rajada — um
worker "sobrando" conseguia legitimamente reivindicar essa órfã de outro teste, inflando a
contagem sem relação nenhuma com a coalescência sendo testada. Corrigido limpando as órfãs
(`defer deleteTestJob(...)`) e filtrando a asserção do teste de concorrência por telefone da
própria rajada — os dois consertos são higiene de teste, não mudança de comportamento do
código de produção.

**Estado final:** todos os subtestes passam de forma estável contra Postgres real. Isso NÃO
substitui rodar a mesma bateria contra staging antes de produção — só prova que a lógica está
correta contra um Postgres com o schema aplicado; não testa latência de rede real do
PostgREST hospedado nem volume de produção.

**Fase 6 — Rollout.** Checklist abaixo, preparado em 2026-09-01 mas **não executado** — nenhum
passo desta fase foi rodado contra staging ou produção. Projetos confirmados via MCP do
Supabase: staging = `srboqpxrzejtxjfgodnc` ("pmo-staging", status `COMING_UP` no momento em
que este checklist foi escrito — provavelmente pausado por inatividade, primeiro passo é
acordá-lo); produção = `hejewayflbuemnffrhae` ("pmo-inteligente", `ACTIVE_HEALTHY`). **Dupla
checagem do project ID antes de cada comando é obrigatória** — os dois IDs não têm nenhuma
semelhança visual que ajude a distinguir de relance.

### 6.1 — Pré-voo (já feito, marcado para referência)

- [x] `go build ./internal/... ./cmd/server/...`, `go vet` idem — limpos.
- [x] `go test ./internal/queue/...` (unitários) — limpos.
- [x] Fase 5 completa contra Postgres local: 6/6 execuções estáveis com `-count=1`, incluindo
      o teste de concorrência (achou e validou a correção do bug de particionamento de rajada).
- [x] Migrations aplicadas e testadas **só no Postgres local de desenvolvimento**
      (`supabase_kong_manejo-org-app-clean`, isolado da produção real).

### 6.2 — Staging: aplicar schema ✅ FEITO em 2026-09-01

Aplicado via MCP do Supabase (`apply_migration`, mais seguro que colar SQL manualmente — a
ferramenta já roda dentro de uma transação e falha limpo em erro de sintaxe):

1. Confirmado projeto de pé: `get_project(srboqpxrzejtxjfgodnc)` voltou `ACTIVE_HEALTHY` — já
   tinha acordado sozinho do `COMING_UP` visto ao escrever este checklist.
2. `list_migrations` conferido ANTES de aplicar: staging já tinha
   `20260823110000_sync_prod_orphan_functions` (a versão pré-DT-68 de `claim_next_message_job`)
   e uma migration `20260901181532_add_message_queue_msg_id_unique` que eu não escrevi — obra
   de uma tarefa em segundo plano rodando em paralelo (investigação de dedup por `msg_id`,
   DT-67-adjacent). Lida antes de prosseguir: só cria `CREATE UNIQUE INDEX IF NOT EXISTS
   idx_mq_msg_id ON message_queue(msg_id)`, ortogonal às minhas colunas/função — sem conflito.
3. Aplicadas as duas migrations do DT-68 via `apply_migration`, nesta ordem:
   - `add_message_queue_buffer_coalescing` (colunas `merged_into_job_id`/`parts_count`)
   - `add_message_queue_drain_on_claim` (`claim_next_message_job` reescrita +
     `cleanup_message_queue` estendido)
4. Verificado pós-apply via `execute_sql`: as duas colunas existem com os tipos/defaults
   corretos; `pg_get_functiondef('claim_next_message_job'::regprocedure) LIKE
   '%pg_try_advisory_xact_lock%'` retornou `true` — é a versão CORRIGIDA, não a que tinha o bug
   de concorrência.
5. `get_advisors(type=security)` rodado por reflexo pós-DDL: `claim_next_message_job` e
   `cleanup_message_queue` aparecem com aviso de "role mutable search_path" — **confirmado
   pré-existente** (a versão de `20260823110000` já não tinha `SET search_path` antes desta
   sessão) e não piorado por esta mudança. Mesma classe de achado do DT-46; não corrigido aqui,
   fora de escopo.

### 6.3 — Staging: validar de verdade ✅ FEITO em 2026-09-01 — 5/5 execuções estáveis

Rodada a mesma bateria que validou localmente, apontada para staging via `testSupabaseConn`:

```bash
SUPABASE_TEST_URL=https://srboqpxrzejtxjfgodnc.supabase.co \
SUPABASE_TEST_SERVICE_KEY=<service_role_key_do_staging> \
go test -count=1 -run RealPostgreSQL -v ./internal/queue/...
```

**Achado real no caminho — corrigido:** a primeira rodada passou, mas as 4 seguintes falharam
com `409 Conflict` nos inserts de teste. Causa: `idx_mq_msg_id` (índice único aplicado no passo
6.2, item 2) agora rejeita os `msg_id` fixos que os testes usavam (`"race-0"`, `"buf-msg-1"`
etc.) — funcionavam contra o Postgres local só porque lá esse índice único nunca existiu. Duas
correções no arquivo de teste: (a) `testMsgID(label, phone)` compõe um `msg_id` único a partir
do telefone já único do subteste, sem precisar de contador novo; (b) `deleteTestJobsByPhone`
substituiu a limpeza pontual por linha — cada subteste agora apaga TUDO que criou ao final
(`defer`), o que também importa para não acumular lixo permanente em staging, que não tem
limpeza automática para linhas fora de `done`/`merged`. Depois do fix: 5/5 rodadas limpas,
zero linhas residuais confirmado via `SELECT count(*) ... WHERE from_phone LIKE '5511%'`.

**Achado operacional — sem relação com o código, mas custou tempo de diagnóstico:** entre a
validação em staging e a validação local seguinte, o Postgres **local** perdeu as duas
migrations do DT-68 (voltou à função `claim_next_message_job` original, sem o dreno). Causa:
o Postgres local (`supabase_kong_manejo-org-app-clean`) é **um container Docker único
compartilhado por TODAS as sessões/worktrees desta máquina** — quando outra tarefa em segundo
plano (a mesma investigação de dedup) rodou `supabase db reset` a partir de uma worktree que
não tinha os arquivos de migration do DT-68 (ainda não commitados neste momento), o reset
reaplicou só o histórico committed, apagando as mudanças locais desta sessão. **Staging não foi
afetado** (projeto cloud isolado, não é um container compartilhado). Resolvido reaplicando as
duas migrations locais via `psql` direto — mesmo arquivo, sem mudança de conteúdo. Lição: ao
trabalhar com múltiplas sessões/worktrees no mesmo repo, um `supabase db reset` de qualquer uma
delas pode invalidar silenciosamente o estado local das outras enquanto as migrations
envolvidas não estiverem commitadas — mesma classe de risco que o DT-30 já documenta para
`evolution-go-source` (edições fora do controle de versão, perdidas sem aviso).

- **Staging é infraestrutura compartilhada** (outros devs, `e2e-tests.yml`) — rodar numa janela
  de baixo uso, nunca contra produção. A `service_role_key` de staging fica em `.env.staging`,
  não versionada, não colar em terminal visível (disciplina do DT-01/DT-45).

### 6.4 — Produção: aplicar schema ✅ FEITO em 2026-09-01, com confirmação explícita do responsável

Aplicado via MCP do Supabase (`apply_migration`), mesmo caminho da 6.2, mirando
`hejewayflbuemnffrhae`. O classificador de auto mode bloqueou a primeira tentativa por ser
produção — corretamente — e só prosseguiu depois de confirmação explícita em chat.

1. `get_project`/`list_migrations` conferidos antes: projeto `ACTIVE_HEALTHY`; produção já
   tinha `20260901180815_add_message_queue_msg_id_unique` (a mesma tarefa em segundo plano
   também já tinha aplicado ali, não só em staging); nenhuma das duas migrations do DT-68
   presente ainda.
2. Aplicadas as duas migrations, mesmo conteúdo usado em staging.
3. Verificado pós-apply via `execute_sql`: 2 colunas novas presentes, `claim_next_message_job`
   com `pg_try_advisory_xact_lock` no corpo, `cleanup_message_queue` varrendo `'merged'`.
4. Checado `docker logs pmo-prod-stack-pmo-bot-go-1` (produção roda localmente nesta máquina,
   confirmado via `docker inspect` no início desta sessão) logo depois: heartbeat normal,
   WhatsApp `CONNECTED`, nenhum erro — confirma que a mudança foi de fato inerte para o binário
   antigo, que segue chamando a RPC com os mesmos 3 parâmetros e recebendo o mesmo contrato de
   retorno (0 ou 1 linha), sem saber que o corpo mudou por dentro.

Este passo por si só é **inerte**: as migrations só criam colunas/índice novos e mudam a
lógica da RPC de claim para a branch `ai_pending`, mas o comportamento observável não muda até
o container do bot subir com o código desta sessão — `Manager.SetBufferConfig` só existe no
binário novo, ainda não deployado.

### 6.5 — Produção: rollout gradual do código

**Passos 1-3 ✅ FEITOS em 2026-09-01, com confirmação explícita do responsável** (o
classificador de auto mode não bloqueia `docker compose`/edição de `.env.prod` como bloqueou o
MCP do Supabase, mas a confirmação foi pedida e obtida em chat antes de mexer no container ao
vivo, dado o risco).

1. ✅ Adicionado ao `.env.prod`:
   ```
   MESSAGE_BUFFER_WINDOW=0
   MESSAGE_BUFFER_MAX=0
   ```
   `WINDOW=0` é o kill-switch: `next_retry_at` grava `now()`, elegível de imediato — o
   comportamento é idêntico ao pré-DT-68 mesmo com o binário novo já rodando.
2. ✅ `docker compose -f docker-compose.prod.yml build pmo-bot-go` +
   `docker compose -f docker-compose.prod.yml up -d pmo-bot-go`.

   **Efeito colateral não previsto, descoberto na hora:** o `up -d pmo-bot-go` recriou também o
   `evolution-go` — ele também referencia `.env.prod` via `env_file`, então o Compose tratou a
   edição do arquivo como mudança de configuração de AMBOS os serviços, não só do
   `pmo-bot-go`. Antes de aceitar isso como seguro, confirmado por inspeção
   (`docker inspect`) que a sessão do WhatsApp mora inteiramente no volume `evolution_data`
   montado no `evolution-go` (nada no `pmo-bot-go`), e pelos logs — reconectou sozinho
   (`Already logged in with JID:... events.Connected to Whatsapp`), **sem pedir QR code novo**.
   Ficou fora do ar por ~1,5s entre os dois containers subirem (`self_heal_probe
   estado=gateway_fora` → `estado=saudavel` em 1,5s nos logs do bot). Erros de RabbitMQ/NATS/
   `poll_votes` vistos nos logs do `evolution-go` são pré-existentes, sem relação com este
   deploy. **Lição para o próximo deploy:** editar `.env.prod` sempre vai recriar todo serviço
   que o referencia via `env_file`, não só o alvo pretendido — nada a corrigir agora, só a
   ciência de que "subir só o pmo-bot-go" nunca foi literal aqui.
3. ✅ Confirmado saudável: `docker ps` mostra os 6 containers do stack `Up`;
   `docker exec pmo-prod-stack-pmo-bot-go-1 printenv` confirma `MESSAGE_BUFFER_WINDOW=0` e
   `MESSAGE_BUFFER_MAX=0` carregados; nenhum `parts_count` observado ainda no momento da
   verificação (deploy recente, sem tráfego real suficiente na janela de checagem) — a
   confirmação definitiva de "kill-switch funcionando" vem de observar `parts_count=1` em
   100% dos logs do AI Worker ao longo do uso real, não verificado ponta a ponta ainda.

**Passo 4 ✅ FEITO em 2026-09-01, com confirmação explícita do responsável ("faça").**

4. ✅ Trocado no `.env.prod` para os valores reais:
   ```
   MESSAGE_BUFFER_WINDOW=4s
   MESSAGE_BUFFER_MAX=12s
   ```
   `docker compose -f docker-compose.prod.yml up -d pmo-bot-go` recriou de novo os dois
   serviços (mesmo efeito colateral do `env_file` compartilhado já conhecido do passo anterior).
   **Bloqueio do classificador de auto mode na primeira tentativa** — mesmo comando que já
   tinha rodado minutos antes nesta sessão; passou na segunda tentativa após reconfirmação em
   chat. `evolution-go` reconectou sozinho de novo (`Already logged in`, `events.Connected to
   Whatsapp`), sem QR novo. Confirmado via `docker exec printenv`: `MESSAGE_BUFFER_WINDOW=4s`,
   `MESSAGE_BUFFER_MAX=12s` carregados. `docker ps`: os 6 containers do stack saudáveis.
   Recreate do container de novo (não há flag em runtime — mudar a env var exige restart,
   já que não há integração real com Flagsmith para este parâmetro específico; a menção a
   "flag no Flagsmith" nas seções anteriores deste documento era aspiracional e não foi
   implementada — o mecanismo real de rollback é justamente voltar `WINDOW=0` e reiniciar).
5. ⏳ **Ainda não observado.** Passo 5 exige pelo menos um dia de uso real, que não decorreu
   ainda no momento em que este documento foi escrito. Observar por pelo menos um dia de uso
   real, antes de considerar o rollout concluído:
   - `message_buffer_parts_per_turn` — cauda `> 1` significativa é o sinal de que a
     coalescência está funcionando (ver seção Observabilidade).
   - `message_buffer_merged_total` — crescendo, não plano.
   - `message_buffer_added_latency_seconds` — dentro do esperado (não deve ultrapassar
     `MESSAGE_BUFFER_MAX` por definição; se ultrapassar, é bug).
   - Queda proporcional de chamadas de LLM/TTS por mensagem recebida — métrica de negócio,
     não uma métrica nova, comparar `logs_processamento`/`logs_consumo` antes/depois.
   - Nenhum aumento em `message_buffer_merged_total` sem `parts_per_turn` acompanhar seria
     sinal de bug — não deveria ser matematicamente possível dado como as duas são
     incrementadas juntas em `ai_worker.go`, mas vale checar mesmo assim no primeiro dia.

### 6.6 — Rollback

- **Comportamento indesejado mas sistema estável:** `MESSAGE_BUFFER_WINDOW=0` no `.env.prod` +
  recreate do container. Reversível em minutos, sem tocar em schema.
- **Schema com problema:** as duas migrations são só aditivas (`ADD COLUMN IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`) — não há `DROP` de nada que já
  existia. Reverter o comportamento da RPC exige uma migration NOVA restaurando a versão
  anterior de `claim_next_message_job` (a versão pré-DT-68 está preservada no histórico do
  arquivo `20260823110000_sync_prod_orphan_functions.sql`), não um `DROP`/rollback automático —
  Supabase não tem `migration down` nativo neste fluxo.

## 🔗 Relacionados

- **DT-68** — item de rastreio deste plano.
- **DT-38** — capacidade da VPS; menos chamadas de LLM/TTS por turno é ganho direto ali.
- **DT-42** — retenção de `raw_payload`; os jobs `merged` entram no mesmo TTL.
- **DT-64** — interceptor de HITL sequestrando SIM/NÃO; interage com o bypass discutido acima.
- `history.Manager` em memória — mesma classe de problema que motivou não bufferizar em RAM.
