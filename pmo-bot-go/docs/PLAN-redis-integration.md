# Integração de Redis no pmo-bot-go

**Status:** Auditoria concluída → primeira fase implementada (rate limiting de entrada)
**Data:** 2026-08-29

> A decisão foi **manter o Redis, dar a ele uma utilidade real e pavimentar o caminho para o RabbitMQ**. A seção [O que foi implementado](#o-que-foi-implementado) no fim do documento descreve o que entrou; o corpo do documento é a auditoria que definiu o escopo.
**Contexto:** Brainstorm anterior propôs três opções (A: cache/locks/ratelimit; B: fila em Redis Streams; C: híbrida). Esta auditoria verifica as premissas daquele documento contra o código real antes de qualquer implementação.

---

## Resumo executivo

O brainstorm original recomendou a **Opção C** (híbrida: cache + rate limit em Redis, fila permanece no Postgres). A auditoria confirma a direção geral, mas **reduz o escopo**: três dos quatro casos de uso propostos já estão resolvidos ou não se aplicam à topologia atual de deploy.

**O único gap real é rate limiting por tenant/telefone.** Os demais itens (cache de embedding, locks distribuídos, fila em Redis) resolvem problemas que ou já têm solução no código, ou só passam a existir quando o serviço escalar horizontalmente.

Além disso, a auditoria encontrou um achado não previsto: **o Redis já está provisionado em produção e não é usado por nenhuma linha de código Go.**

---

## Achados

### 1. Redis já roda em produção, sem nenhum consumidor

`docker-compose.prod.yml:134` declara um serviço `redis:alpine` com volume persistente `redis_data`, e `pmo-bot-go` o lista em `depends_on` (`docker-compose.prod.yml:89`). Porém:

- `pmo-bot-go/go.mod` não tem nenhuma dependência de cliente Redis (`go-redis` ou similar).
- Nenhum arquivo `.go` de runtime referencia Redis — as únicas menções são `docker-compose.benchmark.yml`, `internal/gemini/stall_test.go` e `internal/mcp/multitenancy_test.go`.
- Não existe `REDIS_URL` (nem qualquer variável `REDIS_*`) em `.env.prod`, `.env.local` ou `.env.staging`.

O container consome RAM e disco sem servir a nada. Isso precisa ser decidido: ou passa a ser usado, ou sai do compose.

### 2. Cache de embedding já existe, in-memory e bem construído

`internal/adapter/embedcache/cached_embedder.go` implementa um decorator sobre `mcp.Embedder` com:

- TTL configurável (instanciado com 15 minutos em `cmd/server/main.go:268`);
- `singleflight` para colapsar requisições concorrentes idênticas (proteção contra thundering herd);
- janitor em background limpando entradas expiradas a cada 10 minutos;
- chave = SHA-256 da query normalizada (lowercase + trim).

O item "Cache RAG" da proposta original está, portanto, **parcialmente implementado**. Migrar para Redis aqui não é construir do zero — é trocar o backend de um decorator que já tem a interface certa.

**Ressalva importante de escopo:** este cache guarda o *embedding da pergunta*, não a *resposta final do RAG*. Cachear a resposta é um trabalho diferente e mais delicado (exige decidir o que conta como "mesma pergunta", TTL por tenant, e invalidação quando a base de conhecimento do tenant muda). O brainstorm original tratou os dois como a mesma coisa.

### 3. Deduplicação de webhook já tem garantia no Postgres

`internal/webhook/handler.go:235-252` aplica duas camadas:

1. `processedMu sync.Map` (`handler.go:125`) — dedup in-memory por `message_id`, barato e imediato;
2. `InsertRawPayload` com unique constraint em `raw_payloads` — retorna `supabase.ErrDuplicateMessage`, tratado explicitamente.

A **correção já está garantida pela constraint do banco**. Um lock distribuído em Redis (`lock:webhook:{message_id}`, como propôs a Opção A) não corrigiria nenhum bug existente; economizaria apenas um INSERT que já falha rápido. Baixo valor.

### 4. Deploy é instância única — o argumento de lock distribuído não se aplica hoje

`docker-compose.prod.yml:77-83` define o `pmo-bot-go` com `cpus: '0.5'` e `memory: 512M`, **sem `replicas`**. Uma instância.

Consequência: todo o estado in-memory do serviço está **correto hoje**, não é dívida técnica:

- `sessionMu` em `internal/state/fsm.go:50` (um mutex por telefone, serializando o FSM da sessão);
- `processedMu` em `internal/webhook/handler.go:125`;
- o cache do `CachedEmbedder`.

Esses três viram bugs de correção no dia em que houver uma segunda réplica — mas não antes. `sessionMu` é o mais crítico dos três, porque duas réplicas processariam a mesma sessão em paralelo sem exclusão mútua.

### 5. O polling do Postgres já tem backoff — a Opção B resolve um problema inexistente

O brainstorm justificou a Opção B (Redis Streams) alegando ineficiência do polling. `internal/queue/ai_worker.go:80-90` mostra backoff progressivo quando ocioso: 1s, 2s, 3s, 4s, teto de 5s. O `PollInterval` de 200ms (`ai_worker.go:59`) só se aplica **depois de encontrar um job**, ou seja, sob carga — que é exatamente quando polling agressivo é desejável. `media_worker.go:62` segue o mesmo padrão com 500ms.

Em repouso a fila custa da ordem de 0,2 req/s por worker, não 5 req/s. Somado a isso, a Opção B exigiria reescrever `manager.go`, `reaper.go`, `delivery.go` e a suíte de testes associada, trocando as garantias ACID da RPC `claim_next_message_job` (`manager.go:145`) por persistência AOF do Redis. **Recomendação: descartar a Opção B.**

### 6. Rate limiting por tenant/telefone não existe — este é o gap real

Buscas por rate limiting inbound retornaram apenas:

- `internal/webhook/handler.go:287,299` — retorna 429 quando o worker pool está cheio. É uma proteção **global do processo**, não por usuário: um único telefone em loop derruba a capacidade de todos os tenants;
- `internal/webhook/handler.go:707` — `h.limiter.Wait(ctx)` no fluxo de ingestão de conhecimento. É rate limiting **outbound**, protegendo a API de embeddings, não o bot;
- `internal/gemini/client.go`, `internal/supabase/client.go`, `internal/tts/*` — todos tratamento de 429 **recebido** de terceiros, com retry/fallback.

Não há nenhum limite por telefone ou por organização na entrada. Esse é o único item da proposta original que ataca um problema real e não resolvido.

---

## Recomendação revisada

### Fazer agora

**Rate limiting inbound por telefone e por organização**, aplicado em `handleWebhook` antes do dispatch para o worker pool.

### Decidir antes de codar: Redis é mesmo necessário para isso?

Esta é a questão honesta que a auditoria levanta. Com **instância única**, um rate limiter in-memory (`golang.org/x/time/rate`, que já é dependência transitiva do projeto via o limiter em `handler.go:707`) resolve o caso em poucas dezenas de linhas, sem I/O de rede no caminho quente e sem novo modo de falha.

Redis só ganha em dois cenários concretos:

1. **O contador precisa sobreviver a restart.** Com in-memory, um crash-loop zera os limites e um abusador recomeça do zero. Se o serviço reinicia com frequência (vale medir), isso importa.
2. **Vai haver mais de uma réplica.** Aí o limite in-memory vira "N × limite" e o Redis passa a ser obrigatório — junto com `sessionMu`, que é problema maior.

Como o Redis **já está provisionado e pago em produção**, o custo marginal de usá-lo é baixo. Mas o custo de latência no caminho quente e o novo modo de falha são reais, então a decisão deve ser explícita, não automática.

### Não fazer agora

| Item | Motivo |
|---|---|
| Fila em Redis Streams (Opção B) | Backoff já resolve; reescrita cara; perde ACID |
| Lock distribuído de webhook | Unique constraint em `raw_payloads` já garante correção |
| Migrar `CachedEmbedder` para Redis | In-memory + singleflight funciona bem com uma instância |
| Cache da *resposta* do RAG | Escopo próprio: exige política de invalidação por tenant |

### Backlog explícito (gatilho: segunda réplica)

No dia em que houver escala horizontal, e **nessa ordem de prioridade**:

1. `sessionMu` (`internal/state/fsm.go:50`) → lock distribuído. Sem isso, duas réplicas processam a mesma sessão em paralelo.
2. Rate limiter → backend compartilhado (se ainda estiver in-memory).
3. `CachedEmbedder` → backend compartilhado (só eficiência, não correção).
4. `processedMu` (`internal/webhook/handler.go:125`) → opcional; o Postgres já cobre.

### Correções de caminho no documento original

O brainstorm citou caminhos que não existem no repositório:

- `internal/cache/redis.go` — não existe pacote `internal/cache`.
- `internal/adapters/redis/` — o diretório correto é `internal/adapter/` (singular).
- `internal/ports/cache.go` como "nova camada de abstração" — `internal/ports/` **já existe** e é o idioma da casa (`ai_ports.go`, `database.go`, `whatsapp.go`, `tts_ports.go`). Adicionar `cache.go` ali não introduz padrão novo, o que anula o principal contra listado para a Opção C.

---

---

## O que foi implementado

Rate limiting de entrada por telefone, com Redis como backend. O Redis deixou de ser um container ocioso e passou a ter um consumidor real.

### Camada de contratos (`internal/ports`)

| Arquivo | Papel |
|---|---|
| `ratelimit.go` | `RateLimiter`, `RateLimitDecision` e `NoopRateLimiter`. O contrato exige **degradar aberto**: em falha do backend a implementação retorna erro, e o chamador deixa passar. |
| `eventbus.go` | `EventPublisher` e `NoopEventPublisher`. É a costura para o RabbitMQ — ver abaixo. |

### Adapter (`internal/adapter/redisstore`)

Único pacote que importa `github.com/redis/go-redis/v9` (v9.22.0). Todo o resto fala com Redis através de `ports`, então trocar ou remover o backend é mudança de wiring em `cmd/server/main.go`.

- `client.go` — conexão via `REDIS_URL`, com `PING` de validação no boot e timeouts curtos (dial 2s, operação 200ms). Os timeouts são curtos de propósito: o Redis está na mesma rede Docker, então lentidão ali é falha, e o caminho quente é o handler do webhook.
- `ratelimiter.go` — janela fixa via script Lua `INCR` + `PEXPIRE`. O script existe para garantir atomicidade: com dois comandos soltos, um crash entre eles deixaria uma chave sem TTL — um contador imortal bloqueando aquele telefone para sempre.

**Trade-off assumido:** janela fixa tem efeito de borda (até 2×limite entre duas janelas adjacentes). Aceitável para conter um produtor em loop; se o limite virar contrato de billing, trocar por token bucket é substituir um arquivo, sem tocar em quem chama.

### Ponto de aplicação (`internal/webhook/handler.go`)

Passo 9 do `handleWebhook`, **depois** do dedup e **antes** do dispatch. A ordem é deliberada: uma retentativa de webhook da Evolution é a mesma mensagem chegando de novo, e cobrar cota por um retry que é nosso penalizaria o produtor por um problema que não é dele. Depois do passo 8, o que chega ao limiter é mensagem nova.

A chave é `payload.From` (identidade do canal) e não o telefone resolvido — resolver exigiria ida ao banco, e o ponto do limite é cortar antes de gastar recurso.

Resposta ao exceder: `429` com header `Retry-After`, consistente com o 429 de fila cheia que já existia.

### Configuração

| Variável | Default | Efeito |
|---|---|---|
| `REDIS_URL` | vazio | Vazio ou Redis fora do ar → sobe com `NoopRateLimiter` e loga o aviso. Definida em `docker-compose.prod.yml` como topologia, não em `.env.prod` como segredo. |
| `RATE_LIMIT_PER_MINUTE` | `20` | Teto por telefone por minuto. |

### Observabilidade

Métrica `rate_limit_decisions_total{scope,outcome}` com `outcome` em `allowed`, `throttled`, `error`. **`error` é o valor que merece alerta**: significa Redis fora do ar e, por contrato, tráfego passando sem proteção nenhuma.

### Infraestrutura

`docker-compose.prod.yml` ganhou healthcheck no Redis e `depends_on: condition: service_healthy` no bot. Isso não é cosmético: a conexão é feita **uma vez, no boot**. Sem esperar o healthcheck, um Redis ainda não pronto faria o bot degradar aberto e ficar sem rate limiting até o próximo restart. Quedas *depois* do boot são cobertas pelo redial automático do pool do go-redis.

**Decisão explícita:** o `/health` do bot **não** checa Redis. Ele alimenta restart de container, e derrubar o bot porque o Redis caiu contradiria a política de degradar aberto.

### Testes

`internal/adapter/redisstore/ratelimiter_test.go` — cinco testes cobrindo teto da janela, negação acima do teto, isolamento entre chaves, expiração da janela (que prova que o `PEXPIRE` do script foi aplicado) e o Noop. Seguem a convenção do repositório: pulam com `t.Skip` sem `REDIS_TEST_URL`.

Validados contra um Redis real:

```bash
REDIS_TEST_URL="redis://localhost:63790/0" go test -v -count=1 ./internal/adapter/redisstore/
```

Os cinco passam. `go build ./...` e `go vet` limpos; `internal/webhook` e `internal/ports` seguem verdes.

---

## O caminho para o RabbitMQ

`ports.EventPublisher` está declarado **sem adapter**, de propósito. É contrato puro, custo de runtime zero, e é por ele que um broker entra sem refatorar quem publica.

A ausência de implementação é a conclusão honesta da auditoria: não existe hoje um produtor que justifique um broker. A fila durável do Postgres não tem o problema de carga que motivaria a troca (achado 5), e trabalho durável — entrega garantida, retentativa, reaper — continua em `internal/queue`. O que passará por `EventPublisher` é o oposto disso: evento efêmero de fan-out, onde perder um evento não pode significar perder a mensagem de um produtor.

Quando o primeiro produtor real aparecer, o adapter entra em `internal/adapter/` e só o wiring em `cmd/server/main.go` muda.

## Próximos passos possíveis

1. **Rate limit por organização**, além de por telefone. Exige resolver o tenant no edge, hoje feito só depois. O label `scope` na métrica já está preparado para esse segundo escopo.
2. **Reavaliar o backlog de escala horizontal** (seção acima) quando houver uma segunda réplica — `sessionMu` continua sendo o item mais crítico e não foi tocado.
3. **Calibrar `RATE_LIMIT_PER_MINUTE`** com dados reais: subir observando `rate_limit_decisions_total{outcome="throttled"}` antes de fixar o valor. O default de 20/min é um palpite conservador para uso humano no WhatsApp, não uma medição.
