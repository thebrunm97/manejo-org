-- DT-135/DT-136: reconciliação de schema entre staging e produção.
--
-- Decisão registrada em 2026-09-09 (confirmada com o responsável): produção
-- é o desenho real — staging estava defasado, não o contrário. Em
-- pmo_equipamentos, staging carregava colunas de pmo_propagacao
-- (tipo/especies/origem/sistema_organico/data_compra), claramente um
-- copy-paste de migration nunca corrigido; em pmo_insumos, staging tinha um
-- desenho de campos totalmente diferente (insumo/fonte/talhoes_aplicados)
-- do que produção usa de fato (produto_manejo/cultura_destino/etc). Zero
-- linhas nas duas tabelas em staging (confirmado antes de dropar) — sem
-- perda de dado.
--
-- Este arquivo:
--   1. Recria pmo_equipamentos/pmo_insumos em staging com o schema real de
--      produção (colunas, defaults, FKs, índices, constraint idêntica).
--   2. Corrige o bug de RLS que ainda vivia em produção pras duas tabelas:
--      - pmo_equipamentos: policy só checava user_id, sem WITH CHECK —
--        dono de uma linha podia setar pmo_id pra um PMO de outro tenant
--        sem violar RLS nenhuma. WITH CHECK novo exige que, se pmo_id for
--        informado, pertença a um PMO do próprio usuário.
--      - pmo_insumos: mesmo bypass do DT-133 original (branch por
--        propriedade_id, sem WITH CHECK) — removido, mesma correção.
--   3. Estende a leitura por profissional autorizado (pmo_acessos_
--      profissionais, criada no DT-133) pras duas tabelas, pra manter o
--      mesmo modelo de colaboração em toda a família pmo_*.
--
-- Verificado antes de escrever: zero linhas em produção dependiam do
-- branch propriedade_id removido de pmo_insumos (mesma checagem do DT-133).
-- pmo_equipamentos em produção tem 2 linhas, ambas com pmo_id NULL — o
-- WITH CHECK novo não afeta linhas existentes (só valida em INSERT/UPDATE).

-- ── 1. Staging: recriar as duas tabelas com o schema real de produção ────

DROP TABLE IF EXISTS public.pmo_equipamentos CASCADE;
CREATE TABLE public.pmo_equipamentos (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES auth.users(id),
    pmo_id         BIGINT REFERENCES public.pmos(id),
    nome           TEXT NOT NULL,
    tipo_uso       TEXT CHECK (tipo_uso IN ('Exclusivo', 'Compartilhado')),
    status_limpeza TEXT DEFAULT 'Pendente',
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pmo_equip_pmo ON public.pmo_equipamentos (pmo_id);
CREATE INDEX idx_pmo_equip_user ON public.pmo_equipamentos (user_id);
ALTER TABLE public.pmo_equipamentos ENABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.pmo_insumos CASCADE;
CREATE TABLE public.pmo_insumos (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pmo_id           BIGINT NOT NULL REFERENCES public.pmos(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    produto_manejo   TEXT,
    cultura_destino  TEXT,
    epoca_frequencia TEXT,
    procedencia      TEXT,
    composicao       TEXT,
    marca            TEXT,
    dosagem          TEXT,
    propriedade_id   BIGINT REFERENCES public.propriedades(id),
    CONSTRAINT unique_pmo_insumo_produto UNIQUE (pmo_id, produto_manejo)
);
ALTER TABLE public.pmo_insumos ENABLE ROW LEVEL SECURITY;

-- ── 2. Policies corretas (mesmo texto pros dois ambientes a partir de agora) ──

DROP POLICY IF EXISTS "Acesso total equipamentos" ON public.pmo_equipamentos;
CREATE POLICY "Acesso total equipamentos" ON public.pmo_equipamentos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (pmo_id IS NULL OR pmo_id IN (SELECT id FROM public.pmos WHERE user_id = auth.uid()))
  );

CREATE POLICY "Profissionais autorizados leem pmo_equipamentos" ON public.pmo_equipamentos
  FOR SELECT TO authenticated
  USING (
    pmo_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.pmo_acessos_profissionais a
      WHERE a.pmo_id = pmo_equipamentos.pmo_id AND a.profissional_id = auth.uid() AND a.revogado_em IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can manage their own pmo_insumos" ON public.pmo_insumos;
DROP POLICY IF EXISTS "Acesso via PMO do usuário" ON public.pmo_insumos;
CREATE POLICY "Users can manage their own pmo_insumos" ON public.pmo_insumos
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_insumos.pmo_id))
  WITH CHECK (auth.uid() IN (SELECT pmos.user_id FROM public.pmos WHERE pmos.id = pmo_insumos.pmo_id));

CREATE POLICY "Profissionais autorizados leem pmo_insumos" ON public.pmo_insumos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pmo_acessos_profissionais a
      WHERE a.pmo_id = pmo_insumos.pmo_id AND a.profissional_id = auth.uid() AND a.revogado_em IS NULL
    )
  );
