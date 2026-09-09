-- DT-132: residual do DT-97 — ~18 tabelas do core com policy FOR ALL/UPDATE
-- usando só USING, sem WITH CHECK.
--
-- Verificado ao vivo em produção E staging antes de escrever esta migration
-- (mesma lição do DT-22/DT-70/DT-106/107: o arquivo de migration mentia em
-- vários pontos) — os dois bancos divergiram entre si de formas que nenhuma
-- migration deste repo documenta: nomes de policy diferentes para a mesma
-- tabela, e em alguns casos (pmo_pragas, pmo_equipamentos, propriedades,
-- lotes_rastreabilidade) até a MODELAGEM da checagem difere (coluna direta
-- vs. join). Por isso este arquivo trata cada nome observado
-- separadamente, com DROP POLICY IF EXISTS antes de cada CREATE — não
-- assume que um nome só existe num dos dois ambientes.
--
-- Import: a maioria destas tabelas JÁ está implicitamente protegida contra
-- "UPDATE user_id/pmo_id para outro dono" mesmo sem WITH CHECK explícito —
-- é comportamento documentado do Postgres (CREATE POLICY: "if no WITH CHECK
-- expression is defined, the USING expression is used for both"), e nelas a
-- COLUNA verificada (user_id, talhao_id, pmo_id) É a própria coluna que
-- seria reatribuída, então o USING implícito já barra a reatribuição na
-- prática. Ainda assim, adicionar o WITH CHECK explícito replicando o
-- USING (proposta original do DT-132) é defesa em profundidade sem custo:
-- documenta a intenção e protege contra uma mudança futura na policy que
-- quebre essa coincidência.
--
-- IMPORTANTE — o que este arquivo NÃO resolve: em pmo_insumos, pmo_limpeza,
-- pmo_propagacao (produção) e pmo_equipamentos e ciclos_cultivo, a coluna
-- sensível (pmo_id) está DESACOPLADA da coluna que a policy de fato checa
-- (propriedade_id/user_id/talhao_id) — o mesmo formato de falha do DT-97
-- original (profiles.id vs. profiles.pmo_ativo_id), onde replicar USING
-- como WITH CHECK não fecha nada porque a condição permanece satisfeita
-- mesmo depois de pmo_id apontar para o PMO de outro tenant. Isso fica
-- registrado como DT-133/DT-134 (ver debitos_tecnicos.md) para decisão de
-- produto antes de mexer — não é um "replicar USING" simples.

-- ── ciclos_cultivo: CRÍTICO, tratado à parte no fim deste arquivo (não é
--    "faltando WITH CHECK", é policy sem NENHUMA checagem de dono em
--    produção) ─────────────────────────────────────────────────────────────

-- ── analises_solo ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Acesso via talhão do usuário" ON public.analises_solo;
CREATE POLICY "Acesso via talhão do usuário" ON public.analises_solo
  FOR ALL TO authenticated
  USING (talhao_id IN (SELECT id FROM public.talhoes WHERE user_id = auth.uid()))
  WITH CHECK (talhao_id IN (SELECT id FROM public.talhoes WHERE user_id = auth.uid()));

-- ── canteiros ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Acesso via talhão do usuário" ON public.canteiros;
CREATE POLICY "Acesso via talhão do usuário" ON public.canteiros
  FOR ALL TO authenticated
  USING (talhao_id IN (SELECT id FROM public.talhoes WHERE user_id = auth.uid()))
  WITH CHECK (talhao_id IN (SELECT id FROM public.talhoes WHERE user_id = auth.uid()));

-- ── culturas_anuais ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Acesso via PMO do usuário" ON public.culturas_anuais;
CREATE POLICY "Acesso via PMO do usuário" ON public.culturas_anuais
  FOR ALL TO authenticated
  USING (pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid()))
  WITH CHECK (pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid()));

-- ── categorias_financeiras ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Administradores ou donos do PMO criam categorias" ON public.categorias_financeiras;
CREATE POLICY "Administradores ou donos do PMO criam categorias" ON public.categorias_financeiras
  FOR ALL TO authenticated
  USING (
    pmo_id IS NULL
    OR pmo_id IN (SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    pmo_id IS NULL
    OR pmo_id IN (SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── propriedades — nome difere entre staging/produção ────────────────────
DROP POLICY IF EXISTS "Usuários gerenciam suas propriedades" ON public.propriedades;
DROP POLICY IF EXISTS "Usuários veem suas próprias propriedades" ON public.propriedades;
CREATE POLICY "Usuários veem suas próprias propriedades" ON public.propriedades
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── pmo_pragas — nome/forma da checagem diferem entre staging/produção ───
DROP POLICY IF EXISTS "Acesso via PMO do usuário" ON public.pmo_pragas;
DROP POLICY IF EXISTS "Users manage own pmo_pragas" ON public.pmo_pragas;
CREATE POLICY "Users manage own pmo_pragas" ON public.pmo_pragas
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pmos WHERE pmos.id = pmo_pragas.pmo_id AND pmos.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.pmos WHERE pmos.id = pmo_pragas.pmo_id AND pmos.user_id = auth.uid()));

-- ── pmo_clima — só existe policy de escrita em staging hoje ──────────────
DROP POLICY IF EXISTS "Acesso via PMO do usuário" ON public.pmo_clima;
CREATE POLICY "Acesso via PMO do usuário" ON public.pmo_clima
  FOR ALL TO authenticated
  USING (pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid()))
  WITH CHECK (pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid()));

-- ── lotes_rastreabilidade — produção já é 4 policies por operação, só a de
--    UPDATE ficou sem WITH CHECK; staging ainda é uma única FOR ALL ───────
DROP POLICY IF EXISTS "Users can update their own lots" ON public.lotes_rastreabilidade;
CREATE POLICY "Users can update their own lots" ON public.lotes_rastreabilidade
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários veem seus lotes" ON public.lotes_rastreabilidade;
CREATE POLICY "Usuários veem seus lotes" ON public.lotes_rastreabilidade
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── conversations — produção e staging têm conjuntos de policy diferentes;
--    tratando os dois sem assumir qual está ativo em cada ambiente.
--
--    "conversations_admin" (produção) fica DE FORA deste arquivo de
--    propósito: seu USING referencia profiles.tenant_id/conversations.
--    tenant_id, colunas que confirmei via introspecção NÃO existirem em
--    staging (multicanal ainda não chegou lá) — incluir essa policy aqui
--    quebraria a migration inteira ao rodar em staging. Fica registrada
--    como pendência ligada à convergência do multicanal entre ambientes,
--    não ao escopo do DT-132.
DROP POLICY IF EXISTS "conversations_owner" ON public.conversations;
CREATE POLICY "conversations_owner" ON public.conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins acessam todas conversas" ON public.conversations;
CREATE POLICY "Admins acessam todas conversas" ON public.conversations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── pmo_equipamentos fica DE FORA deste arquivo ──────────────────────────
-- Não é só nome de policy diferente: confirmei via introspecção que a
-- TABELA em si diverge entre ambientes — produção tem uma coluna user_id
-- que staging não tem (staging só tem pmo_id, e usa a policy padrão
-- "Acesso via PMO do usuário" via join com pmos). Escrever uma única
-- CREATE POLICY aqui quebraria em um dos dois ambientes dependendo de qual
-- coluna eu escolhesse. Isso é schema drift de verdade (mesma classe do
-- DT-131), não "falta WITH CHECK" — precisa de reconciliação própria antes
-- de mexer na RLS. Registrado como pendência separada.

-- ── pmo_insumos fica DE FORA deste arquivo pelo mesmo motivo do
--    pmo_equipamentos: staging não tem a coluna propriedade_id que
--    produção usa na policy (confirmado via introspecção) — schema drift
--    de verdade, não só nome de policy. Registrado como pendência separada.

-- ── pmo_limpeza / pmo_propagacao — têm propriedade_id nos dois ambientes.
--    WITH CHECK aqui replica o USING (OR pmo_id/propriedade_id) e NÃO fecha
--    o DT-133 (ver nota no topo do arquivo) — só formaliza o que já é
--    implícito hoje.
DROP POLICY IF EXISTS "Acesso via PMO do usuário" ON public.pmo_limpeza;
DROP POLICY IF EXISTS "Users can manage their own pmo_limpeza" ON public.pmo_limpeza;
CREATE POLICY "Users can manage their own pmo_limpeza" ON public.pmo_limpeza
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_limpeza.pmo_id)
    OR propriedade_id IN (SELECT propriedades.id FROM public.propriedades WHERE propriedades.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_limpeza.pmo_id)
    OR propriedade_id IN (SELECT propriedades.id FROM public.propriedades WHERE propriedades.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Acesso via PMO do usuário" ON public.pmo_propagacao;
DROP POLICY IF EXISTS "Users can manage their own pmo_propagacao" ON public.pmo_propagacao;
CREATE POLICY "Users can manage their own pmo_propagacao" ON public.pmo_propagacao
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_propagacao.pmo_id)
    OR propriedade_id IN (SELECT propriedades.id FROM public.propriedades WHERE propriedades.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_propagacao.pmo_id)
    OR propriedade_id IN (SELECT propriedades.id FROM public.propriedades WHERE propriedades.user_id = auth.uid())
  );

-- ── ciclos_cultivo: CRÍTICO ao vivo em produção, não é o DT-132 ──────────
-- Confirmado via pg_policies em produção: a ÚNICA policy da tabela é
-- "Permitir tudo para autenticados" USING (auth.role() = 'authenticated') —
-- sem checar dono nenhum. É o MESMO bug do DT-70 (canteiros/analises_solo/
-- culturas_anuais/pmo_propagacao tinham exatamente essa policy até serem
-- corrigidas em 20260903100000), só que em uma tabela que a auditoria do
-- DT-70 não cobriu. Staging já está correto (a policy "Acesso via canteiro
-- do usuário" do arquivo original nunca teve esse drift lá).
DROP POLICY IF EXISTS "Permitir tudo para autenticados" ON public.ciclos_cultivo;
DROP POLICY IF EXISTS "Acesso via canteiro do usuário" ON public.ciclos_cultivo;
CREATE POLICY "Acesso via canteiro do usuário" ON public.ciclos_cultivo
  FOR ALL TO authenticated
  USING (
    canteiro_id IN (
      SELECT c.id FROM public.canteiros c
      JOIN public.talhoes t ON c.talhao_id = t.id
      WHERE t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    canteiro_id IN (
      SELECT c.id FROM public.canteiros c
      JOIN public.talhoes t ON c.talhao_id = t.id
      WHERE t.user_id = auth.uid()
    )
  );
