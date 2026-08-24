-- Telemetria de prompt caching (DT-37) + correção de um insert quebrado desde
-- 2026-04-07 em logs_processamento.
--
-- PARTE 1 — POR QUE ESTAS COLUNAS EXISTEM
--
-- pricing.CostWithCache (PR #11) calcula o custo separando tokens de entrada
-- em não-cacheados, lidos do cache e escritos no cache — mas até agora
-- nenhuma tabela tinha onde persistir essa separação. Sem as colunas, o dado
-- só existiria na linha de log `telemetry event=llm_call`, não em relatório
-- histórico por produtor/modelo/intent.
--
-- cached_tokens vem de usage.prompt_tokens_details.cached_tokens (OpenRouter)
-- ou usage_metadata.cached_content_token_count (Gemini nativo, só != 0 com
-- Context Caching explícito). cache_write_tokens vem só da OpenRouter — o SDK
-- go-openai não modela o campo nativamente, por isso é capturado via
-- interceptação do corpo da resposta no transport (ver
-- internal/gemini/client.go, openRouterTransport.RoundTrip).
--
-- PARTE 2 — POR QUE modelo_configurado/modelo_efetivo/custo_dolar/raciocinio_agente
--
-- Achado incidental durante a exploração desta migration: LogProcessamentoInsert
-- (internal/supabase/client.go) já envia estas quatro colunas há tempo, mas
-- elas nunca existiram na tabela viva. O PostgREST rejeita o insert e o
-- código descarta o erro (`_ = sbClient.InsertLogProcessamento(...)`), então
-- isso nunca apareceu em lugar nenhum — confirmado por contagem de linhas:
-- logs_processamento parou em 197 linhas em 2026-04-07 e não recebeu nenhuma
-- desde então, enquanto logs_consumo (que não depende destas colunas) segue
-- recebendo linhas normalmente. Como esta migration já mexe nesta tabela para
-- as colunas de cache, a correção entra aqui em vez de abrir uma frente nova.

ALTER TABLE public.logs_processamento
    ADD COLUMN IF NOT EXISTS modelo_configurado TEXT,
    ADD COLUMN IF NOT EXISTS modelo_efetivo TEXT,
    ADD COLUMN IF NOT EXISTS custo_dolar NUMERIC,
    ADD COLUMN IF NOT EXISTS raciocinio_agente JSONB,
    ADD COLUMN IF NOT EXISTS cached_tokens INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cache_write_tokens INTEGER DEFAULT 0;

ALTER TABLE public.logs_consumo
    ADD COLUMN IF NOT EXISTS cached_tokens INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cache_write_tokens INTEGER DEFAULT 0;

COMMENT ON COLUMN public.logs_processamento.cached_tokens IS
    'DT-37: fração de tokens_prompt já servida do cache de prompt (mais barata). 0 quando o provedor/modelo não expôs o dado.';
COMMENT ON COLUMN public.logs_processamento.cache_write_tokens IS
    'DT-37: tokens gastos no primeiro armazenamento em cache. Só a OpenRouter expõe hoje; 0 no caminho Gemini nativo.';
COMMENT ON COLUMN public.logs_processamento.modelo_configurado IS
    'Modelo pedido pela configuração (antes de qualquer fallback). Divergência de modelo_efetivo indica escalada.';
COMMENT ON COLUMN public.logs_processamento.modelo_efetivo IS
    'Modelo que de fato respondeu (após fallback, se houve).';
COMMENT ON COLUMN public.logs_processamento.custo_dolar IS
    'Custo estimado em USD via internal/pricing (pricing.CostWithCache). Estimativa de relatório, não fatura real do provedor.';
COMMENT ON COLUMN public.logs_processamento.raciocinio_agente IS
    'Trace do loop agêntico (internal/state.TraceEvent), para depuração e auditoria de decisão.';

COMMENT ON COLUMN public.logs_consumo.cached_tokens IS
    'DT-37: fração de tokens_prompt já servida do cache de prompt. 0 quando o provedor/modelo não expôs o dado.';
COMMENT ON COLUMN public.logs_consumo.cache_write_tokens IS
    'DT-37: tokens gastos no primeiro armazenamento em cache. Só a OpenRouter expõe hoje; 0 no caminho Gemini nativo.';
