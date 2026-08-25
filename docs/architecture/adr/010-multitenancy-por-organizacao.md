# ADR-010: Multitenancy por Organização — cooperativa, certificadora, consultoria e produtor individual

## Status: Proposto

## Contexto

O termo "multi-tenancy" já está ocupado neste repositório por um conceito diferente
do que este ADR propõe. [`pmo-bot-go/docs/MULTITENANCY.md`](../../../pmo-bot-go/docs/MULTITENANCY.md)
declara "✅ Validado para 10+ PMOs em produção" e descreve isolamento por `pmo_id` —
na prática, isolamento **por produtor**, já que hoje uma PMO pertence a um único
`auth.users`. Existe também `organizacoes`, que é um conceito de **negócio** (a
cooperativa que aparece na Seção 14 do PMO), não um tenant técnico. Este ADR propõe
um terceiro sentido — organização como fronteira de isolamento de dados — e por
isso precisa nomear a colisão antes de mais nada: **os três não são a mesma coisa**,
e confundi-los é a forma mais provável deste ADR ser mal lido.

Hoje o dono de todo dado é `user_id UUID → auth.users(id)`. As tabelas-raiz
(`propriedades`, `pmos`, `talhoes`) carregam `user_id` diretamente; tabelas-folha
como `canteiros`, `ciclos_cultivo` e as `pmo_*` só chegam ao dono por 2–3 saltos de
FK. Não existe `organizacao_id` em nenhuma tabela de domínio.

Já existe um multitenant parcial, criado sob demanda para o dashboard B2B de
cooperativa, e ele tem um defeito de modelagem: `organizacao_membros(organizacao_id,
propriedade_id, role)` em
[`supabase/migrations/20260422_create_organizacoes.sql:14-20`](../../../supabase/migrations/20260422_create_organizacoes.sql)
vincula a **propriedade**, não a **pessoa**. Consequência observável em
[`supabase/migrations/20260501_coop_dashboard_rpc.sql:19-26`](../../../supabase/migrations/20260501_coop_dashboard_rpc.sql):
o gestor da cooperativa é identificado por `organizacao_membros.role='gestor'` **join**
`propriedades.user_id = auth.uid()` — ou seja, **para gerir a cooperativa é preciso
possuir uma fazenda**. Um técnico de ATER ou de certificadora, que nunca é dono de
propriedade, não cabe nesse modelo. O `CHECK` de `tipo` também só admite
`cooperativa | associacao | spg | grupo_informal` — não há espaço para
`certificadora` nem `consultoria`.

Como não há coluna de tenant em nenhuma tabela-folha, toda leitura que cruza
produtores (o dashboard da coop) precisa de uma função `SECURITY DEFINER` com ACL
escrita à mão — o próprio arquivo se autodocumenta como
`-- 1. TRAVA DE SEGURANÇA MANUAL (ACL)`
([`20260501_coop_dashboard_rpc.sql:17`](../../../supabase/migrations/20260501_coop_dashboard_rpc.sql)).
Isso já doeu uma vez:
[`supabase/migrations/20260427_fix_organizacao_membros_rls.sql:5`](../../../supabase/migrations/20260427_fix_organizacao_membros_rls.sql)
**removeu** a policy "membros veem membros da mesma organização" por recursão
infinita de RLS, e empurrou toda leitura coletiva de volta para RPCs `SECURITY
DEFINER`. A RLS, onde o projeto mais investiu (ADR hardening em
`20260124192000_harden_rls_strategies.sql`, o fix de `security_invoker` do DT-62),
fica fora do caminho justamente na consulta mais sensível: a que cruza dados de
produtores diferentes.

O problema tem uma segunda camada, mais grave, do lado do bot. O bot autentica no
Supabase com a **chave de serviço**
([`pmo-bot-go/internal/supabase/client.go:1799-1800`](../../../pmo-bot-go/internal/supabase/client.go)
manda `Authorization: Bearer <service_role>` em toda requisição), o que significa
que `auth.uid()` é `NULL` dentro de qualquer RPC chamada pelo bot. **100% do
isolamento do bot é convenção de código Go, sem backstop no banco.** A convenção é
real e documentada (`validateProfile` em
[`pmo-bot-go/internal/mcp/server.go:262-270`](../../../pmo-bot-go/internal/mcp/server.go)
rejeita profile nulo ou `PmoAtivoID == 0`), mas ela não verifica **posse** — só
presença. E existem hoje duas gerações de RPC com modelos de confiança opostos:

- **Geração 1** (usada pelo bot), como `registrar_atividade_pmo(pmo_id_arg,
  user_id_arg, …)` em
  [`pmo-frontend/supabase/migrations/20260327_rpc_registrar_atividade.sql:5-22`](../../../pmo-frontend/supabase/migrations/20260327_rpc_registrar_atividade.sql) —
  `SECURITY DEFINER`, sem `SET search_path`, e **sem verificação de que
  `pmo_id_arg`/`user_id_arg` pertencem a quem chama**. Como essas funções nunca
  tiveram `REVOKE EXECUTE`, mantêm o `EXECUTE` padrão do Postgres para `PUBLIC`.
  Isso é um IDOR real: qualquer usuário autenticado pode chamar
  `rpc_registrar_operacao_campo` direto no PostgREST com o `pmo_id_arg` de outra
  pessoa e gravar em `caderno_campo` alheio — o `validateProfile` do Go nunca entra
  em cena, porque o atacante não precisa passar pelo bot. Cerca de 15 arquivos de
  RPC seguem esse padrão (ver DT-65).
- **Geração 2** (usada pelo frontend web), como `create_talhao(p_payload)` em
  [`supabase/migrations/20260818140000_create_domain_mutation_rpcs.sql:52-65`](../../../supabase/migrations/20260818140000_create_domain_mutation_rpcs.sql) —
  deriva `v_user_id := auth.uid()`, valida que a propriedade referenciada pertence a
  esse usuário, e tem `REVOKE EXECUTE ON FUNCTION … FROM public`. Esse é o padrão
  correto, e é o mesmo padrão que o [ADR-009](./009-gateway-go-complementa-fat-database.md)
  usa para o gateway REST: repassar o JWT do produtor, nunca a chave de serviço.

**As duas gerações são mutuamente exclusivas**: a Geração 2 só funciona com
`auth.uid()` não-nulo, que o bot, autenticado por `service_role`, nunca tem. Esta é
a restrição de sequenciamento central deste ADR — não dá para adotar RLS por
organização no caminho do bot sem primeiro resolver como o bot se autentica.

Por fim, o "contexto ativo" do usuário — qual PMO ele está operando agora — é
**estado global mutável por usuário**, gravado em `profiles.pmo_ativo_id` via
`UPDATE` (`UpdateActivePMO` em
[`pmo-bot-go/internal/supabase/client.go:2035-2044`](../../../pmo-bot-go/internal/supabase/client.go)),
e **esse mesmo campo é lido dentro de predicados de RLS** (padrão visto em
`20260525_create_financial_ledger.sql:155-166`: `pmo_id IN (SELECT pmo_ativo_id FROM
profiles WHERE id = auth.uid())`). Duas sessões concorrentes do mesmo usuário — o
WhatsApp e, no futuro, o app web — compartilham e disputam um único
`pmo_ativo_id`. Trocar de contexto num canal muda silenciosamente o que RLS deixa o
outro canal enxergar. Qualquer desenho de organização como tenant herda esse
problema se não o resolver explicitamente.

Sobre a suíte de testes que hoje sustenta a alegação "✅ Validado" do
`MULTITENANCY.md`: `internal/mcp/multitenancy_test.go` e `cross_tenancy_test.go`
existem, mas o teste com o nome mais assustador,
`TestIsolation_CrossPMOWrite_ArgsInjectionIgnored`
([`multitenancy_test.go:100-122`](../../../pmo-bot-go/internal/mcp/multitenancy_test.go)),
monta um mapa de args com `pmo_id: 999` e **nunca chama nenhum handler** — a
asserção final é `profileA.PmoAtivoID == 1`, comparando o profile de teste consigo
mesmo. Não há, hoje, nenhum teste que efetivamente tente ler ou escrever dados de um
tenant a partir do contexto de outro. Isso é tratado como débito técnico separado
(DT-66), mas é o motivo pelo qual este ADR não pode se apoiar na alegação de
validação existente.

## Decisão

Organização passa a ser o **tenant de primeira classe** do sistema, num
shared-schema: uma coluna de tenant denormalizada nas tabelas tenant-scoped, com
**RLS por organização** substituindo a travessia por join e as ACLs manuais em
`SECURITY DEFINER`. Cinco peças:

1. **Membresia é da pessoa, não da propriedade.** Nova tabela
   `organizacao_usuarios (organizacao_id, user_id, papel, criado_em)`, substituindo
   o uso de `organizacao_membros` como tabela de acesso — corrige o defeito descrito
   acima e permite que um técnico ou consultor sem propriedade própria seja membro.
   `organizacao_membros` atual (propriedade↔organização) vira dado a migrar, não
   modelo a manter.

2. **Posse é diferente de acesso.** Uma organização é dona de um PMO/propriedade
   (`owner_organizacao_id`, ou equivalente via `organizacao_usuarios` com papel de
   dono). Certificadora e consultoria não são donas — recebem **concessão**: uma
   tabela `acessos_concedidos (organizacao_id, propriedade_id, finalidade, concedido_por,
   valido_ate)` que dá leitura (e, quando aplicável, campos específicos de escrita,
   como laudo de certificação) sobre dado de terceiro, com prazo e finalidade
   registrados. Sem essa separação, os quatro perfis pedidos pelo usuário —
   cooperativa, certificadora, consultoria, produtor individual — não cabem no mesmo
   modelo: os dois primeiros são membresia, o terceiro é acesso temporário.

3. **Produtor individual é uma organização de um membro só.** Não existe caminho de
   código separado para "tem organização" vs. "não tem" — todo `user_id` pertence a
   pelo menos uma organização, mesmo que seja a que ele mesmo criou implicitamente.

4. **Coluna de tenant denormalizada** nas tabelas hoje alcançáveis só por 2–3 saltos
   de FK: `canteiros`, `ciclos_cultivo`, `analises_solo`, as `pmo_*` (culturas,
   manejo, pragas, insumos, equipamentos, propagação, limpeza, clima),
   `transacao_alocacoes`, `culturas_anuais`. Hoje a RLS dessas tabelas é
   `pmo_id IN (SELECT id FROM pmos WHERE user_id = auth.uid())` — um join por
   linha. Com `organizacao_id` direto na tabela, a policy vira um filtro simples,
   sem subquery correlacionada, e passa a suportar múltiplos membros da mesma
   organização sem reescrever a RLS de novo a cada tabela.

5. **O bot migra para JWT por usuário.** `service_role` deixa de ser usado no
   caminho de request de usuário e fica restrito a tarefas de sistema (jobs de
   clima, ingestão de RAG, cron de proatividade) que não têm um usuário humano por
   trás. Com isso, `auth.uid()` volta a ser a fonte única de verdade nos dois
   caminhos (bot e web), e a Geração 1 de RPCs pode ser migrada para o padrão da
   Geração 2 sem duplicar lógica de autorização.

## Por que não schema-per-tenant ou database-per-tenant

A alternativa mais "óbvia" para isolamento forte é um schema (ou banco) por
organização. Duas razões concretas para recusar, específicas deste projeto:

Primeiro, o volume: são ~40 tabelas de domínio e ~90 policies de RLS reais hoje
soltas sobre elas — replicar isso por schema multiplicaria a superfície de migração
e de operação para uma equipe pequena, e é incompatível com o modo como o projeto já
usa PostgREST (um único schema `public` exposto por instância). O ADR-002 (Fat
Database) já aceitou o lock-in parcial com Postgres como troca por lógica
centralizada; schema-per-tenant reintroduziria exatamente a fragmentação que aquele
ADR evitou.

Segundo, e decisivo: schema-per-tenant não tem resposta para a certificadora. Uma
certificadora **não é dona** do dado que ela precisa ler — ela **atravessa** a
fronteira de um tenant que não é o dela, com escopo e prazo. Isolamento físico por
schema resolveria "nunca vaza", mas não resolve "às vezes precisa vazar, sob
controle" — que é exatamente o requisito. Row-level com tabela de concessões resolve
os dois: nega por padrão, permite por linha quando há uma concessão válida.

## Por que não manter o bot com `service_role`

Manter `service_role` é a opção de menor esforço imediato, mas congela permanente-
mente dois modelos de autorização divergentes: a Geração 2 de RPCs (a segura, com
`REVOKE … FROM public` e checagem de posse) exige `auth.uid()` não-nulo por
construção — não há como "consertar" isso sem tocar nas RPCs em si, o que reabriria
a divergência descrita no Contexto. Adiar essa migração não evita o trabalho, só
adia o ponto em que ele se torna urgente — e o torna mais arriscado, porque a
superfície de RPCs Geração 1 só cresce enquanto o bot continua sendo o único
consumidor confiado por convenção.

## Justificativa

- **Reaproveita a RLS que o projeto já endureceu**, em vez de introduzir um segundo
  mecanismo de autorização. Este é o mesmo instinto do
  [ADR-009](./009-gateway-go-complementa-fat-database.md): preservar a autorização
  por linha que já existe, em vez de mover a decisão de "de quem é este registro"
  para fora do Postgres.
- **Elimina a classe de bug dominante do repositório**: ACL escrita à mão dentro de
  função `SECURITY DEFINER`. É o padrão por trás de DT-46 (7 de 9 funções
  `SECURITY DEFINER` sem checagem de autorização) e de DT-62 (view com
  `security_invoker` ausente expondo telefones a `anon`). RLS por organização
  substitui "cada RPC nova reescreve sua própria checagem" por "a policy já
  filtra".
- **Alinha bot e web sob o mesmo modelo de autorização** — hoje divergem
  silenciosamente; depois desta decisão, `auth.uid()` é a única fonte de verdade nos
  dois.

## Consequências

- (+) Uma única forma de checar "este usuário pode ver/escrever este registro?",
  válida para bot e web.
- (+) Certificadora, consultoria, cooperativa e produtor individual cabem no mesmo
  modelo de dados, sem tabela paralela por tipo de organização.
- (+) Fecha, por construção, a classe de bug que produziu DT-46 e DT-62 para as
  tabelas migradas.
- (-) Com shared-schema, **a RLS vira o único isolamento entre organizações**. Isso
  exige uma suíte de teste de vazamento entre tenants que hoje não existe nem para
  PMO (ver DT-66) — sem ela, este ADR troca uma vulnerabilidade conhecida (RPCs sem
  checagem) por uma vulnerabilidade não testada (policy mal escrita).
- (-) Migrar o bot de `service_role` para JWT por usuário é a maior fatia de
  trabalho deste ADR — toca autenticação, sessão e as ~15 RPCs da Geração 1.
- (-) `profiles.pmo_ativo_id` como estado global mutável precisa virar claim de
  sessão (ou equivalente), o que é mudança de contrato com o frontend atual, não
  apenas com o bot.
- (-) A ordem de execução importa e é perigosa de inverter: revogar `EXECUTE`
  público das RPCs Geração 1 (DT-65) **antes** de o bot ter JWT por usuário quebra o
  bot inteiro; feito depois de o bot migrar, não quebra nada. Qualquer plano de
  implementação decorrente deste ADR precisa respeitar essa ordem.

**Escopo desta fatia**: este ADR decide o desenho — modelo de dados, separação
posse/acesso, e a direção da migração de autenticação do bot. Nenhuma migration,
nenhuma mudança de RPC e nenhuma alteração de schema acontecem nesta rodada. O plano
de execução (ordem de migrações, RPCs a reescrever, estratégia de rollout) fica para
um plano de implementação subsequente, referenciando DT-65 e DT-66 como pré-
requisitos de segurança.

Referências: [ADR-011](./011-abstracao-de-canal-de-chat.md) (depende deste ADR para
o contexto de tenant da sessão), [ADR-002](./002-fat-database.md),
[ADR-009](./009-gateway-go-complementa-fat-database.md),
[`pmo-bot-go/docs/MULTITENANCY.md`](../../../pmo-bot-go/docs/MULTITENANCY.md),
[`pmo-bot-go/docs/debitos_tecnicos.md`](../../../pmo-bot-go/docs/debitos_tecnicos.md)
(DT-18, DT-46, DT-62, DT-65, DT-66).
