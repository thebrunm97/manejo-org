-- Reconciliação de schema produção × migrations (achado ao rodar os testes E2E
-- do DT-139 contra um banco montado só a partir de supabase/migrations/).
--
-- Comparação coluna a coluna das 94 tabelas de public: 5 divergiam.
--
-- 1. rag_experiment_runs / rag_arena_models — migrations FANTASMAS em
--    produção: 20260723130000_update_rag_experiment_runs_telemetry e
--    20260723140000_add_fallback_models constam em schema_migrations, mas as
--    colunas nunca existiram lá. O código grava nelas
--    (internal/supabase/knowledge.go:514-517, playground de conhecimento),
--    então o insert de execução do playground falhava em produção.
--    → ADD COLUMN IF NOT EXISTS: é o único item com efeito real em produção.
--
-- 2. profiles — produção tem daily_request_count / last_usage_date /
--    total_tokens_used (usadas por internal/supabase/quota.go), criadas fora
--    das migrations. Num banco novo a checagem de cota quebrava.
--    → ADD COLUMN IF NOT EXISTS (no-op em produção).
--
-- 3. pmo_manejo — o baseline (20260402000000) criou a tabela com o formato de
--    pmo_insumos; produção e o frontend (pmoTransformers.extractManejoInsumos)
--    usam insumo/fonte/quantidade/metodo_aplicacao/talhoes_aplicados/
--    data_aplicacao/modalidade_aplicada.
--    → ADD COLUMN IF NOT EXISTS (no-op em produção). As colunas a mais de
--      bancos novos ficam (nulláveis, inofensivas).
--
-- 4. pmos — o baseline criou cultura/produtividade_kg_ha NOT NULL, que não
--    existem em produção (parecem copiadas de referencia_agronomica). Isso
--    escondeu um bug: CriarPropriedadeComPMO mandava essas duas chaves e, em
--    produção, o PostgREST rejeitava o insert do PMO (corrigido no mesmo
--    commit, internal/supabase/client.go).
--    → DROP COLUMN IF EXISTS (no-op em produção).

ALTER TABLE public.rag_experiment_runs
  ADD COLUMN IF NOT EXISTS tokens_cache_read INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_cache_write INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exact_cost_usd NUMERIC(10,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS openrouter_generation_id TEXT,
  ADD COLUMN IF NOT EXISTS actual_model_used TEXT;

ALTER TABLE public.rag_arena_models
  ADD COLUMN IF NOT EXISTS fallback_models TEXT[] DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_request_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_usage_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS total_tokens_used INTEGER DEFAULT 0;

ALTER TABLE public.pmo_manejo
  ADD COLUMN IF NOT EXISTS insumo TEXT,
  ADD COLUMN IF NOT EXISTS fonte TEXT,
  ADD COLUMN IF NOT EXISTS quantidade TEXT,
  ADD COLUMN IF NOT EXISTS metodo_aplicacao TEXT,
  ADD COLUMN IF NOT EXISTS talhoes_aplicados JSONB,
  ADD COLUMN IF NOT EXISTS data_aplicacao DATE,
  ADD COLUMN IF NOT EXISTS modalidade_aplicada public.modalidade_producao_enum DEFAULT 'ORGANICO'::public.modalidade_producao_enum;

ALTER TABLE public.pmos
  DROP COLUMN IF EXISTS cultura,
  DROP COLUMN IF EXISTS produtividade_kg_ha;

-- 5. Nulabilidade — só duas colunas eram NOT NULL em bancos novos e não em
--    produção. messages.user_id veio de 20260906210600_multicanal_a5b_not_nulls,
--    mas supabase.Client.InsertMessage grava o histórico só com phone/content/
--    role: num banco novo todo insert de histórico falhava (em produção a
--    coluna é nullable e o histórico funciona). → DROP NOT NULL (no-op em
--    produção).
ALTER TABLE public.messages ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
