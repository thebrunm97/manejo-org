-- Migration: Create Miscellaneous Mutation RPCs (DT-18)
-- Objetivo: Encapsular mutações restantes (analises_solo, canteiros, demandas, whatsapp).

-- ==========================================
-- 1. CANTEIROS
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_canteiro(p_payload jsonb)
RETURNS public.canteiros
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.canteiros;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    v_record := jsonb_populate_record(null::public.canteiros, p_payload);
    v_record.created_at := now();
    IF v_record.id IS NULL THEN v_record.id := gen_random_uuid(); END IF;

    -- Validar talhão (pertence ao usuário)
    IF NOT EXISTS (
        SELECT 1 FROM public.talhoes t
        JOIN public.propriedades p ON t.propriedade_id = p.id
        WHERE t.id = v_record.talhao_id AND p.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Talhão inválido ou não pertence ao usuário';
    END IF;

    INSERT INTO public.canteiros SELECT v_record.* RETURNING * INTO v_record;
    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_canteiro FROM public;
GRANT EXECUTE ON FUNCTION public.create_canteiro TO authenticated;


CREATE OR REPLACE FUNCTION public.create_canteiros_batch(p_payloads jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_row public.canteiros;
    v_result jsonb := '[]'::jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    -- Para simplificar a validação em lote, iteramos o JSON array
    FOR v_row IN SELECT * FROM jsonb_populate_recordset(null::public.canteiros, p_payloads)
    LOOP
        v_row.created_at := now();
        IF v_row.id IS NULL THEN v_row.id := gen_random_uuid(); END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.talhoes t
            JOIN public.propriedades p ON t.propriedade_id = p.id
            WHERE t.id = v_row.talhao_id AND p.user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Talhão % inválido ou não pertence ao usuário', v_row.talhao_id;
        END IF;

        INSERT INTO public.canteiros SELECT v_row.*;
        v_result := v_result || row_to_json(v_row)::jsonb;
    END LOOP;

    RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_canteiros_batch FROM public;
GRANT EXECUTE ON FUNCTION public.create_canteiros_batch TO authenticated;


CREATE OR REPLACE FUNCTION public.update_canteiro(p_id uuid, p_payload jsonb)
RETURNS public.canteiros
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_existing public.canteiros;
    v_record public.canteiros;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    SELECT c.* INTO v_existing 
    FROM public.canteiros c
    JOIN public.talhoes t ON c.talhao_id = t.id
    JOIN public.propriedades p ON t.propriedade_id = p.id
    WHERE c.id = p_id AND p.user_id = v_user_id;

    IF v_existing IS NULL THEN RAISE EXCEPTION 'Canteiro não encontrado'; END IF;

    v_record := jsonb_populate_record(v_existing, p_payload);
    v_record.id := v_existing.id;
    v_record.talhao_id := v_existing.talhao_id; -- Impedir mudança de talhão para simplificar segurança

    UPDATE public.canteiros SET
        (nome, comprimento_metros, largura_metros, grid_x, grid_y, status, area_total_m2, tipo, tipo_estrutura, profundidade_metros, volume_m3, quantidade) =
        (v_record.nome, v_record.comprimento_metros, v_record.largura_metros, v_record.grid_x, v_record.grid_y, v_record.status, v_record.area_total_m2, v_record.tipo, v_record.tipo_estrutura, v_record.profundidade_metros, v_record.volume_m3, v_record.quantidade)
    WHERE id = p_id RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_canteiro FROM public;
GRANT EXECUTE ON FUNCTION public.update_canteiro TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_canteiro(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    DELETE FROM public.canteiros c
    USING public.talhoes t, public.propriedades p
    WHERE c.talhao_id = t.id AND t.propriedade_id = p.id
    AND c.id = p_id AND p.user_id = v_user_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Canteiro não encontrado'; END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_canteiro FROM public;
GRANT EXECUTE ON FUNCTION public.delete_canteiro TO authenticated;


-- ==========================================
-- 2. ANALISE SOLO
-- ==========================================
CREATE OR REPLACE FUNCTION public.upsert_analise_solo(p_payload jsonb)
RETURNS public.analises_solo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.analises_solo;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    v_record := jsonb_populate_record(null::public.analises_solo, p_payload);

    IF NOT EXISTS (
        SELECT 1 FROM public.talhoes t
        JOIN public.propriedades p ON t.propriedade_id = p.id
        WHERE t.id = v_record.talhao_id AND p.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Talhão inválido ou não pertence ao usuário';
    END IF;

    IF v_record.id IS NULL THEN
        v_record.id := gen_random_uuid();
        v_record.created_at := now();
        INSERT INTO public.analises_solo SELECT v_record.* RETURNING * INTO v_record;
    ELSE
        -- Validação de update: garantir que existe e pertence
        IF NOT EXISTS (SELECT 1 FROM public.analises_solo WHERE id = v_record.id AND talhao_id = v_record.talhao_id) THEN
            RAISE EXCEPTION 'Análise não encontrada';
        END IF;

        UPDATE public.analises_solo SET
            (data_analise, ph_agua, fosforo, potassio, calcio, magnesio, saturacao_bases, materia_organica, argila, areia, silte, updated_at) =
            (v_record.data_analise, v_record.ph_agua, v_record.fosforo, v_record.potassio, v_record.calcio, v_record.magnesio, v_record.saturacao_bases, v_record.materia_organica, v_record.argila, v_record.areia, v_record.silte, now())
        WHERE id = v_record.id RETURNING * INTO v_record;
    END IF;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_analise_solo FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_analise_solo TO authenticated;


-- ==========================================
-- 3. DEMANDAS COLETIVAS (Mural e Org)
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_demanda_coletiva(p_payload jsonb)
RETURNS public.demandas_coletivas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.demandas_coletivas;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    v_record := jsonb_populate_record(null::public.demandas_coletivas, p_payload);
    v_record.criado_por := v_user_id;
    v_record.created_at := now();
    IF v_record.id IS NULL THEN v_record.id := gen_random_uuid(); END IF;

    -- Validar que usuário pertence à cooperativa como gestor ou membro
    IF NOT EXISTS (
        SELECT 1 FROM public.organizacao_membros om
        JOIN public.propriedades p ON om.propriedade_id = p.id
        WHERE om.organizacao_id = v_record.cooperativa_id AND p.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Usuário não pertence à cooperativa informada';
    END IF;

    INSERT INTO public.demandas_coletivas SELECT v_record.* RETURNING * INTO v_record;
    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_demanda_coletiva FROM public;
GRANT EXECUTE ON FUNCTION public.create_demanda_coletiva TO authenticated;


CREATE OR REPLACE FUNCTION public.create_demanda_intencao(p_payload jsonb)
RETURNS public.demandas_intencoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.demandas_intencoes;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    v_record := jsonb_populate_record(null::public.demandas_intencoes, p_payload);
    v_record.user_id := v_user_id;
    v_record.created_at := now();
    IF v_record.id IS NULL THEN v_record.id := gen_random_uuid(); END IF;

    -- Validar que propriedade pertence ao user
    IF NOT EXISTS (SELECT 1 FROM public.propriedades WHERE id = v_record.propriedade_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Propriedade inválida';
    END IF;

    INSERT INTO public.demandas_intencoes SELECT v_record.* RETURNING * INTO v_record;
    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_demanda_intencao FROM public;
GRANT EXECUTE ON FUNCTION public.create_demanda_intencao TO authenticated;


-- ==========================================
-- 4. MESSAGE QUEUE (Restart)
-- ==========================================
CREATE OR REPLACE FUNCTION public.restart_queue_job(p_id uuid)
RETURNS public.message_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.message_queue;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Não autorizado'; END IF;

    -- Fila normalmente é gerenciada pelo admin, mas vamos permitir restart se logado
    UPDATE public.message_queue SET
        status = 'pending',
        attempt_count = 0,
        next_retry_at = now(),
        processed_at = null,
        error_msg = null
    WHERE id = p_id
    RETURNING * INTO v_record;

    IF v_record IS NULL THEN RAISE EXCEPTION 'Job não encontrado'; END IF;
    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restart_queue_job FROM public;
GRANT EXECUTE ON FUNCTION public.restart_queue_job TO authenticated;
