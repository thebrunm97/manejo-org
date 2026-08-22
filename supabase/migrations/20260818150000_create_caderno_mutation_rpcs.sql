-- Migration: Create Caderno de Campo Mutation RPCs (DT-18)
-- Objetivo: Encapsular mutações do Caderno de Campo e PMO Limpeza.

-- ==========================================
-- 1. CADERNO_CAMPO
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_caderno_registro(p_payload jsonb)
RETURNS public.caderno_campo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.caderno_campo;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- Converte o payload JSONB em um record da tabela (ignorando chaves inválidas)
    v_record := jsonb_populate_record(null::public.caderno_campo, p_payload);
    
    -- Força a autoria e campos base
    v_record.user_id := v_user_id;
    -- Permite que o frontend forneça um ID de idempotência ou gera um novo
    IF v_record.id IS NULL THEN
        v_record.id := gen_random_uuid();
    END IF;
    v_record.criado_em := now();
    
    -- 1. Validação de Propriedade
    IF v_record.propriedade_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.propriedades p
            WHERE p.id = v_record.propriedade_id AND p.user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Propriedade inválida ou não pertence ao usuário';
        END IF;
    END IF;

    -- 2. Validação de PMO
    IF v_record.pmo_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.pmos p
            WHERE p.id = v_record.pmo_id AND p.user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'PMO inválido ou não pertence ao usuário';
        END IF;
    END IF;

    INSERT INTO public.caderno_campo SELECT v_record.*
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_caderno_registro FROM public;
GRANT EXECUTE ON FUNCTION public.create_caderno_registro TO authenticated;


CREATE OR REPLACE FUNCTION public.update_caderno_registro(p_id uuid, p_payload jsonb)
RETURNS public.caderno_campo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_existing public.caderno_campo;
    v_record public.caderno_campo;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    -- Busca o registro garantindo propriedade
    SELECT * INTO v_existing FROM public.caderno_campo WHERE id = p_id AND user_id = v_user_id;
    IF v_existing IS NULL THEN
        RAISE EXCEPTION 'Registro não encontrado ou não pertence ao usuário';
    END IF;

    -- Mescla o existente com as novidades
    v_record := jsonb_populate_record(v_existing, p_payload);
    
    -- Protege campos imutáveis/de segurança
    v_record.id := v_existing.id;
    v_record.user_id := v_existing.user_id;
    v_record.criado_em := v_existing.criado_em;

    -- Validações
    IF v_record.propriedade_id IS NOT NULL AND v_record.propriedade_id != COALESCE(v_existing.propriedade_id, -1) THEN
        IF NOT EXISTS (SELECT 1 FROM public.propriedades p WHERE p.id = v_record.propriedade_id AND p.user_id = v_user_id) THEN
            RAISE EXCEPTION 'Propriedade inválida';
        END IF;
    END IF;

    IF v_record.pmo_id IS NOT NULL AND v_record.pmo_id != COALESCE(v_existing.pmo_id, -1) THEN
        IF NOT EXISTS (SELECT 1 FROM public.pmos p WHERE p.id = v_record.pmo_id AND p.user_id = v_user_id) THEN
            RAISE EXCEPTION 'PMO inválido';
        END IF;
    END IF;

    UPDATE public.caderno_campo SET
        (pmo_id, data_registro, tipo_atividade, secao_origem, produto, talhao_canteiro, quantidade_valor, quantidade_unidade, detalhes_tecnicos, observacao_original, talhao_id, atividades, sistema, status, audio_url, propriedade_id, houve_descartes, qtd_descartes, unidade_descartes, canteiro_ids, tipo_operacao, responsavel, equipamentos, lote, destino, classificacao, valor_total, origem, nota_fiscal, fornecedor, modalidade_aplicada, data) =
        (v_record.pmo_id, v_record.data_registro, v_record.tipo_atividade, v_record.secao_origem, v_record.produto, v_record.talhao_canteiro, v_record.quantidade_valor, v_record.quantidade_unidade, v_record.detalhes_tecnicos, v_record.observacao_original, v_record.talhao_id, v_record.atividades, v_record.sistema, v_record.status, v_record.audio_url, v_record.propriedade_id, v_record.houve_descartes, v_record.qtd_descartes, v_record.unidade_descartes, v_record.canteiro_ids, v_record.tipo_operacao, v_record.responsavel, v_record.equipamentos, v_record.lote, v_record.destino, v_record.classificacao, v_record.valor_total, v_record.origem, v_record.nota_fiscal, v_record.fornecedor, v_record.modalidade_aplicada, v_record.data)
    WHERE id = p_id
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_caderno_registro FROM public;
GRANT EXECUTE ON FUNCTION public.update_caderno_registro TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_caderno_registro(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    DELETE FROM public.caderno_campo
    WHERE id = p_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registro não encontrado ou não pertence ao usuário';
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_caderno_registro FROM public;
GRANT EXECUTE ON FUNCTION public.delete_caderno_registro TO authenticated;


-- ==========================================
-- 2. PMO_LIMPEZA
-- ==========================================
-- pmo_limpeza table doesn't have `user_id`, it uses `pmo_id` and `propriedade_id` to link to users.
CREATE OR REPLACE FUNCTION public.create_limpeza_registro(p_payload jsonb)
RETURNS public.pmo_limpeza
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.pmo_limpeza;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    v_record := jsonb_populate_record(null::public.pmo_limpeza, p_payload);
    IF v_record.id IS NULL THEN
        v_record.id := gen_random_uuid();
    END IF;
    v_record.created_at := now();

    -- Validação: pmo_limpeza requer pmo_id
    IF v_record.pmo_id IS NULL THEN
        RAISE EXCEPTION 'pmo_id é obrigatório para limpeza';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.pmos p
        WHERE p.id = v_record.pmo_id AND p.user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'PMO inválido ou não pertence ao usuário';
    END IF;

    INSERT INTO public.pmo_limpeza SELECT v_record.*
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_limpeza_registro FROM public;
GRANT EXECUTE ON FUNCTION public.create_limpeza_registro TO authenticated;


CREATE OR REPLACE FUNCTION public.update_limpeza_registro(p_id uuid, p_payload jsonb)
RETURNS public.pmo_limpeza
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_existing public.pmo_limpeza;
    v_record public.pmo_limpeza;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    SELECT l.* INTO v_existing 
    FROM public.pmo_limpeza l
    JOIN public.pmos p ON l.pmo_id = p.id
    WHERE l.id = p_id AND p.user_id = v_user_id;

    IF v_existing IS NULL THEN
        RAISE EXCEPTION 'Registro de limpeza não encontrado ou não pertence ao usuário';
    END IF;

    v_record := jsonb_populate_record(v_existing, p_payload);
    v_record.id := v_existing.id;
    v_record.created_at := v_existing.created_at;

    IF v_record.pmo_id != v_existing.pmo_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.pmos p WHERE p.id = v_record.pmo_id AND p.user_id = v_user_id) THEN
            RAISE EXCEPTION 'PMO inválido';
        END IF;
    END IF;

    UPDATE public.pmo_limpeza SET
        (pmo_id, data_limpeza, item_area, tipo_limpeza, produto_utilizado, dosagem, responsavel, observacao, propriedade_id) =
        (v_record.pmo_id, v_record.data_limpeza, v_record.item_area, v_record.tipo_limpeza, v_record.produto_utilizado, v_record.dosagem, v_record.responsavel, v_record.observacao, v_record.propriedade_id)
    WHERE id = p_id
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_limpeza_registro FROM public;
GRANT EXECUTE ON FUNCTION public.update_limpeza_registro TO authenticated;
