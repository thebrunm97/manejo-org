# Plano — Fechamento da Fase 0 (segurança crítica)

> Continuação de [`PLAN-sprint-pre-viagem-2026-09-08.md`](PLAN-sprint-pre-viagem-2026-09-08.md).
> Fonte de verdade de cada item continua sendo [`debitos_tecnicos.md`](debitos_tecnicos.md) —
> este plano só sequencia o que falta. **Ao fechar um item, atualize o `debitos_tecnicos.md`
> também** (mover para 🟢 Concluído com data e observação), não só marque o checkbox aqui.

**Escrito em:** 2026-09-09, depois de conferir o estado real contra `main` (ver "Como cheguei
nestes números" abaixo — não confie apenas nesta lista sem reconferir, branches deste projeto
divergem rápido).

---

## 🤖 Divisão de trabalho: o que dá pra mandar pro BigPickle

Nem todo lote deste plano é seguro pra um loop autônomo sem supervisão — depende de acesso a
produção, decisão de produto, ou verificação que só um humano consegue fazer (clicar num link
de e-mail de verdade). Cada lote abaixo tem um rótulo explícito e um bloco **"Verificação
objetiva"** — um comando com resultado binário (passa/falha), pensado pra quem for executar
(BigPickle ou não) não precisar confiar em "parece que funcionou".

| Lote | Item | Pode ir pro BigPickle? | Por quê |
|---|---|---|---|
| A | DT-82 | ✅ **Feito** (2026-09-09, commit `ef2c697` em `main`) | Mudança isolada em Go, sem migration, sem acesso a produção. Critério de sucesso é mecânico (`go build`/`go vet` + o teste do lote). |
| C | F1 | ✅ **Já estava resolvido** — nenhuma execução necessária | Ao conferir o código antes de gerar o prompt, a vulnerabilidade descrita já não existia (ver Lote C abaixo). Documento de débito estava desatualizado, não o código. |
| B | DT-122/DT-125 | ❌ **Não** | Exige SSH na VPS de produção com credenciais reais, gerar e rotacionar senha, reiniciar containers com produtores usando o sistema. Nenhum agente autônomo deveria ter esse acesso sem supervisão direta. |
| D | DT-133/135/136/137 | ❌ **Não** | DT-135/136 exigem introspecção contra produção **e** staging antes de escrever qualquer coisa (histórico de migrations já mentiu antes, ver DT-22/DT-70/DT-106/DT-107); DT-133 trava numa decisão de produto que só o responsável responde; DT-137 depende do DT-131, ainda não fechado. Reconciliar schema errado quebra RLS de verdade em produção — risco alto demais pra loop sem revisão. |

**Se você rodar o BigPickle mesmo assim nos lotes B/D**, no mínimo: rode em branch isolada, sem
permissão de `git push`/deploy automático, e revise o diff pessoalmente antes de aplicar
qualquer migration ou tocar a VPS — nunca deixe o loop aplicar `db push` ou reiniciar container
de produção sozinho.

**Nota sobre o ambiente do BigPickle:** no log anterior (`session-ses_f904.md`) ele tentou rodar
`git status && git log` em PowerShell e quebrou — `&&` não existe no PowerShell 5.1 que a
máquina usa. Se for reaproveitar o mesmo ambiente, confirme que ele sabe encadear comandos com
`;` em vez de `&&`, ou vai travar na primeira ordem composta do Lote A.

---

## ⚠️ Antes de qualquer coisa: sua branch está atrasada

A branch atual (`feat/zarc-plantio-referencia-olericolas`) **não tem** as correções de
segurança abaixo — elas foram feitas e mergeadas em `main` hoje, em branches próprias
(`fix/dt-93-...`, `fix/dt74-75-...`, `fix/dt79-80-...`, `fix/dt88-...`, `fix/dt107-...`, etc.),
sem passar por esta branch. É exatamente a armadilha #1 já registrada no plano anterior
("branches divergem em silêncio e ninguém percebe").

```bash
git fetch origin
git log --oneline main -5           # confirma que os fixes estão lá
git merge origin/main                # traz as correções pra esta branch antes de seguir
```

Faça isso **antes** de investigar qualquer item abaixo — sem isso você vai reabrir trabalho
já fechado, ou pior, aplicar uma correção que conflita com a de `main`.

---

## Como cheguei nestes números

A auditoria publicada mais cedo (artifact "Onde o débito técnico está de fato acumulado")
listava 16 itens na Fase 0. Conferi cada um contra `git log --all` e `git show main:...` antes
de escrever este plano, porque a auditoria foi escrita a partir de `debitos_tecnicos.md` no
estado da branch atual — que já estava desatualizado no momento em que terminei de escrevê-la.

**13 dos 16 já estão resolvidos e mergeados em `main`** (todos datados 2026-09-09):
DT-93, DT-94, DT-95, DT-96, DT-97 (vetor principal), DT-98, DT-100, DT-101, DT-105, DT-107,
DT-108, DT-109, DT-111, DT-74, DT-75, DT-77, DT-79, DT-80, DT-88. DT-106 foi investigado e
**reescopado** — a tabela/RPC nunca existiu de fato em produção; o achado virou uma decisão de
produto (manter a ferramenta `SalvarMemoriaProdutor` desativada ou implementar a memória de
verdade), não mais um item de correção de RLS.

**Genuinamente aberto, 3 itens:** DT-82, DT-122, F1 (este último vive em
[`TECHNICAL_DEBT.md`](../../TECHNICAL_DEBT.md), não em `debitos_tecnicos.md` — é frontend).

**Descoberto investigando o DT-132 (mesma sessão), ainda sem correção:** DT-133, DT-135,
DT-136, DT-137 — divergência de RLS/schema entre produção e staging em 4 tabelas do PMO. Mesma
classe de risco da Fase 0 (bypass de tenant), então entram neste plano também, mesmo não tendo
estado na lista original.

---

## Lote A — DT-82: cota de ingestão burlável (~1h) — 🤖 seguro para BigPickle

**O quê:** `internal/webhook/handler.go:613-641` só checa a cota de documentos (3 para non-pro)
`if pmoIDStr != ""`. Omitir `pmo_id` no multipart pula a checagem inteira e cria
`ingestion_jobs` com `pmo_id = 0`, processados e cobrados da conta global.

**Passo a passo:**
1. Extrair `pmo_id` do JWT autenticado (mesmo padrão de `RequireAuth`), não do form field —
   elimina a possibilidade de omitir o campo.
2. Se a rota precisa aceitar chamadas sem JWT (confirmar se `handleKnowledgeUpload` roda atrás
   de `RequireAuth` ou só do token de webhook), aplicar a cota por identidade do token
   autenticado, nunca por campo opcional do payload.
3. Teste: request multipart sem `pmo_id` deve ser rejeitado ou cair sob a cota do tenant
   correto — nunca criar job com `pmo_id = 0`.
4. Migration não é necessária (mudança só no handler Go).

**Verificação objetiva (rodar antes de marcar como concluído):**
```bash
cd pmo-bot-go
go build ./... && go vet ./...
go test ./internal/webhook/... -run TestKnowledgeUpload -v
```
Se não existir ainda um `TestKnowledgeUpload...` que cubra "upload sem `pmo_id` no form", **escrever
esse teste faz parte da correção, não é opcional** — sem ele, o critério de sucesso vira "achei que
funcionou", que é exatamente o tipo de alucinação que este plano quer evitar num loop autônomo. O
teste deve montar um `multipart.Writer` sem o campo `pmo_id`, chamar o handler, e assertar que a
resposta é 4xx (ou que o `pmo_id` foi derivado do JWT, nunca `0`) — não basta checar que compila.

---

## Lote B — DT-122: RabbitMQ com credenciais hardcoded (~2h, precisa da VPS ao vivo) — ❌ não mandar pro BigPickle

**Fazer por último, com o responsável por perto** — mesma ressalva do plano anterior: mexe na
stack de produção rodando de verdade. Exige SSH real na VPS e rotação de credencial — nenhum
agente autônomo deveria fazer isso sem um humano assistindo cada comando.

**O quê:** `docker-compose.prod.yml:169-187` tem `RABBITMQ_DEFAULT_USER=admin` /
`RABBITMQ_DEFAULT_PASS=admin_password` fixos no repo, referenciados também pelo bot (`:74`) e
pelo `evolution-go` (`:127`); portas `5672`/`15672` publicadas em `0.0.0.0`.

**Passo a passo:**
1. Gerar uma senha nova forte (gerenciador de senha ou `openssl rand -base64 32` — nunca colar
   em terminal cru, lição já registrada do DT-01).
2. Mover usuário/senha para `.env.prod` (fora do repo), referenciado via `${RABBITMQ_USER}` /
   `${RABBITMQ_PASS}` no compose, nos três lugares que hoje têm o valor fixo.
3. Remover `ports: ["5672:5672", "15672:15672"]` do serviço `rabbitmq` — a rede interna do
   compose (`pmo_prod_net`) já resolve `rabbitmq:5672` para o bot e o evolution-go; a porta de
   gestão (15672) só precisa existir se alguém acessa o management UI de fora, e nesse caso
   trocar para bind `127.0.0.1:15672:15672` (acesso só via túnel SSH), nunca `0.0.0.0`.
4. Aplicar na VPS: atualizar `.env.prod`, `docker compose up -d --force-recreate rabbitmq`,
   confirmar que bot e evolution-go reconectam com a credencial nova antes de considerar
   fechado (checar logs dos três containers).
5. Cross-referência: DT-125 (evolution-go publica `8082:8082` sem necessidade) é o mesmo padrão
   de correção — remover `ports:` ou trocar para bind localhost. Vale fazer os dois na mesma
   manutenção já que exige o mesmo acesso à VPS.

---

## Lote C — F1: ✅ já resolvido, não precisa de execução

**Descoberto em 2026-09-09, ao conferir o código antes de gerar o prompt de execução:** o item
descrito aqui (`OnboardingPage.tsx:41-61` interceptando `?token=` cru e logando em
`console.log`) não existe mais — foi substituído pelo fluxo `AuthCallback.tsx` (commit `4dc01f2`,
07/09/2026), que já usa `code` opaco + troca server-side + `detectSessionInUrl: true`, exatamente
a correção que este lote pedia. Nenhuma ação de código restante. Registro completo movido pra
seção "🟢 Concluído" do [`TECHNICAL_DEBT.md`](../../TECHNICAL_DEBT.md).

Isso é o segundo item nesta sessão (depois do DT-126 no backend) em que o documento de débito
estava desatualizado em relação ao código real — vale reconferir os itens "abertos" restantes
contra o código antes de escrever mais prompts de execução, não só contra o texto do débito.

---

## Lote D — DT-133/135/136/137: schema drift de RLS entre produção e staging (~1 dia, decisão + código) — ❌ não mandar pro BigPickle

Requer confirmar o schema real via introspecção contra produção **e** staging (MCP do Supabase
ou `psql` direto) antes de escrever qualquer migration — não é algo verificável por
`go build`/`tsc`, e um agente sem esse acesso vai alucinar a resposta em vez de confirmar.

**Por que entra na Fase 0 mesmo não estando na lista original:** mesma classe de risco —
bypass de isolamento entre tenants — descoberta como efeito colateral do DT-132. Adiar
"porque não estava no escopo original" deixaria 4 tabelas com bypass de posse conhecido e
documentado sem correção.

**Ordem sugerida, do mais simples pro que precisa de decisão de produto:**

1. **DT-135/DT-136** (`pmo_equipamentos`, `pmo_insumos`) — divergência de *schema* (coluna
   existe num ambiente e não no outro), não só de policy. Antes de escrever qualquer migration:
   decidir qual coluna é a canônica (o registro já sugere que `user_id`/`propriedade_id`
   direto na tabela é redundante com o vínculo via `pmo_id`) e reconciliar staging/produção
   para o mesmo schema. Só depois disso escrever o `WITH CHECK` que valida `pmo_id`
   isoladamente — uma migration escrita pra um ambiente quebra o `db diff --linked` no outro
   enquanto divergirem.
2. **DT-133** (`pmo_limpeza`, `pmo_propagacao`) — mesmo formato de bypass do DT-97 original
   (o `WITH CHECK` replicado do DT-132 não fecha, porque o branch `propriedade_id` da policy
   continua satisfeito depois de trocar `pmo_id`). **Decisão de produto pendente antes de
   mexer:** confirmar com o responsável se o acesso via `propriedade_id` deveria permitir
   gerenciar registros de PMOs que o dono da propriedade não possui (colaboração
   multi-tenant intencional) ou é resíduo a fechar. Não escrever a correção de RLS antes
   dessa resposta — as duas leituras pedem `WITH CHECK` diferentes.
3. **DT-137** (`caderno_campo_canteiros`) — resolver **junto** da reconciliação de colunas
   órfãs do DT-131 (já registrado como item de limpeza separado), não isoladamente: é preciso
   primeiro saber se produção migrou de fato pro modelo por FK (`canteiro_id`) antes de decidir
   se a divergência de policy staging/produção é um fork independente ou o mesmo problema do
   DT-131 com outra cara.
4. Em todos os quatro: confirmar o estado real via introspecção (`pg_policies`,
   `information_schema.columns`) contra produção **e** staging antes de escrever a migration —
   mesma lição repetida três vezes nesta sessão (DT-22/DT-70/DT-106/DT-107): o histórico de
   migrations não garante o que está de fato rodando.

---

## Checklist de progresso

**Verificação de estado (fazer primeiro, sempre)**
- [ ] `git merge origin/main` nas outras branches em andamento (ex. `feat/zarc-plantio-referencia-olericolas`) — traz os itens já fechados

**Itens genuinamente abertos**
- [x] DT-82 — cota de ingestão burlável sem `pmo_id` (2026-09-09, `ef2c697` em `main`)
- [ ] DT-122 — RabbitMQ credenciais + portas públicas (com o responsável por perto)
- [ ] DT-125 — evolution-go porta pública (mesma manutenção do DT-122)
- [x] F1 — token de sessão na URL do onboarding — já resolvido em `4dc01f2` (07/09), sem ação necessária

**Descobertos durante o DT-132, mesma classe de risco**
- [ ] DT-135 — `pmo_equipamentos`: reconciliar schema produção/staging primeiro
- [ ] DT-136 — `pmo_insumos`: reconciliar schema produção/staging primeiro
- [ ] DT-133 — `pmo_limpeza`/`pmo_propagacao`: decisão de produto pendente antes de codar
- [ ] DT-137 — `caderno_campo_canteiros`: resolver junto do DT-131

**Reescopado, não é mais item de correção**
- [ ] DT-106 — decidir: implementar memória de produtor de verdade, ou remover a tool
      `SalvarMemoriaProdutor` que hoje sempre falha
