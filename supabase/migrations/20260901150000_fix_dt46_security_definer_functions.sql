-- ============================================================
-- MIGRATION: Fecha autorização em SECURITY DEFINER órfãs (DT-46)
-- Description: Do lote de funções SECURITY DEFINER auditado no DT-46,
--   registrar_atividade_pmo e as 3 sobrecargas de criar_infraestrutura_pmo
--   já foram fechadas pelo DT-65 (confirmado ao vivo: PUBLIC/anon/
--   authenticated sem EXECUTE em produção). Este migration fecha as que
--   sobraram, todas com PUBLIC ainda podendo executar (confirmado ao vivo
--   via has_function_privilege('public', ...)):
--
--   1. get_dashboard_stats() — nenhuma checagem de autorização; qualquer
--      chamador (mesmo anônimo) lia custo/tokens/usuários ativos/erros do
--      mês inteiro. Ganha a mesma checagem is_admin() que
--      get_admin_user_details já usa.
--   2. get_propriedade_metrics(p_propriedade_id) — IDOR: qualquer chamador
--      passava qualquer propriedade_id e lia área total/nº de talhões dela,
--      sem checar posse. Ganha checagem de posse (propriedades.user_id =
--      auth.uid()) ou is_admin(), mesmo padrão de rpc_registrar_transacao_
--      com_rateio (DT-65). Também ganha SET search_path, que faltava
--      (SECURITY DEFINER sem search_path fixo é vetor clássico de escalada).
--   3. get_traceability_data(p_codigo_lote) — uso anônimo aqui É legítimo
--      por design (rastreabilidade via QR na embalagem), mas devolvia
--      endereco_cadastral (endereço completo do produtor) para qualquer
--      leitor do QR — mais do que rastreabilidade exige. Campo removido da
--      resposta; cidade/uf (já presentes) bastam. Ganha SET search_path.
--   4. increment_usage_stats(p_user_id, ...) — grava total_tokens_used/
--      daily_request_count de QUALQUER usuário, sem checar que o chamador é
--      o próprio usuário; e não tem nenhum chamador real no frontend nem no
--      bot (grep confirmou: só existe no types.ts gerado). Órfã e perigosa
--      — revogada de todo mundo, mesmo padrão do DT-65 para RPCs sem
--      chamador vivo (criar_infraestrutura_pmo, rpc_registrar_cota_produtor).
--
--   Hygiene adicional (sem mudança de comportamento — as duas já se
--   protegem sozinhas via is_admin()/auth.uid() dentro do corpo, então
--   PUBLIC/anon já não conseguiam extrair nada; só fecha a superfície):
--   5. get_admin_user_details, get_recent_bot_activities — revoga PUBLIC/
--      anon, mantém authenticated (é como o admin/produtor logado chama).
--   6. farm_documents — RLS habilitado e ZERO policies (então já nega tudo
--      por padrão a anon/authenticated), mas ainda tinha GRANT SELECT
--      concedido a eles. Revogado por clareza — não muda nenhum
--      comportamento observável.
--
--   Achados vizinhos do mesmo laudo, DELIBERADAMENTE fora deste migration
--   (categorias diferentes de defeito, cada um merece sua própria revisão):
--   sobrecarga de 4 args de match_chunks referencia coluna k.pmo_id que não
--   existe em knowledge_chunks (bug de correção, só estoura quando chamada);
--   is_chemical_input marcada IMMUTABLE mas chama unaccent() (STABLE);
--   2 das 3 sobrecargas de criar_infraestrutura_pmo provavelmente mortas
--   (já sem GRANT a ninguém desde o DT-65, então sem risco, só código morto).
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total_cost NUMERIC;
  v_total_tokens BIGINT;
  v_active_users INT;
  v_errors_today INT;
  v_start_date TIMESTAMP;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only admins can view dashboard stats.';
  END IF;

  v_start_date := date_trunc('month', CURRENT_DATE);
  SELECT
    COALESCE(SUM(custo_estimado), 0),
    COALESCE(SUM(total_tokens), 0)
  INTO v_total_cost, v_total_tokens
  FROM public.logs_consumo
  WHERE created_at >= v_start_date;
  SELECT COUNT(DISTINCT user_id)
  INTO v_active_users
  FROM public.logs_consumo
  WHERE created_at >= (NOW() - INTERVAL '24 hours');
  SELECT COUNT(*)
  INTO v_errors_today
  FROM public.logs_consumo
  WHERE status != 'success' AND created_at >= CURRENT_DATE;

  RETURN json_build_object(
    'active_users_24h', v_active_users,
    'total_cost_current_month', v_total_cost,
    'total_tokens_current_month', v_total_tokens,
    'errors_today', v_errors_today
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_propriedade_metrics(p_propriedade_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_area_total numeric;
    v_total_talhoes integer;
    v_result jsonb;
BEGIN
    IF NOT public.is_admin() AND NOT EXISTS (
        SELECT 1 FROM public.propriedades
        WHERE id = p_propriedade_id AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Propriedade inválida ou não pertence ao usuário';
    END IF;

    SELECT COALESCE(SUM(area_ha), 0), COUNT(id)
    INTO v_area_total, v_total_talhoes
    FROM public.talhoes
    WHERE propriedade_id = p_propriedade_id AND active = true;

    v_result := jsonb_build_object(
        'area_total_ha', v_area_total,
        'total_talhoes', v_total_talhoes,
        'propriedade_id', p_propriedade_id
    );

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_propriedade_metrics(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_propriedade_metrics(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_traceability_data(p_codigo_lote text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT
        jsonb_build_object(
            'lote', jsonb_build_object(
                'id', l.id,
                'codigo_lote', l.codigo_lote,
                'cultura', l.cultura,
                'quantidade', l.quantidade,
                'data_colheita', l.data_colheita,
                'created_at', l.created_at
            ),
            'propriedade', jsonb_build_object(
                'nome', p.nome,
                'modalidade_predominante', p.modalidade_predominante,
                'cidade', p.cidade,
                'uf', p.uf
            ),
            'historico_manejo', (
                SELECT jsonb_agg(manejo)
                FROM (
                    SELECT
                        data_registro::DATE as data,
                        tipo_atividade as atividade,
                        COALESCE(produto, 'Operação de Manejo') as produto
                    FROM public.caderno_campo
                    WHERE propriedade_id = l.propriedade_id
                      AND tipo_atividade IN ('plantio', 'manejo', 'aplicacao_insumo', 'colheita')
                      AND (
                          (SELECT talhao_id FROM public.caderno_campo WHERE id = l.caderno_campo_id) IS NULL
                          OR talhao_id = (SELECT talhao_id FROM public.caderno_campo WHERE id = l.caderno_campo_id)
                      )
                      AND data_registro::DATE <= l.data_colheita
                      AND data_registro::DATE >= (l.data_colheita - INTERVAL '1 year')
                    ORDER BY data_registro ASC
                ) manejo
            )
        ) INTO v_result
    FROM public.lotes_rastreabilidade l
    JOIN public.propriedades p ON l.propriedade_id = p.id
    WHERE l.codigo_lote = p_codigo_lote;

    RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.increment_usage_stats(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage_stats(uuid, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.get_admin_user_details(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_recent_bot_activities() FROM PUBLIC, anon;

REVOKE ALL ON public.farm_documents FROM anon, authenticated;
