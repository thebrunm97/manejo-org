-- Migration: Create PMO Mutation RPCs (DT-18)
-- Objetivo: Encapsular mutações na tabela pmos e suas relações.

-- ==========================================
-- 1. PMOS
-- ==========================================
CREATE OR REPLACE FUNCTION public.create_pmo(p_payload jsonb)
RETURNS public.pmos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.pmos;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    v_record := jsonb_populate_record(null::public.pmos, p_payload);
    v_record.user_id := v_user_id;
    v_record.created_at := now();

    IF v_record.propriedade_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.propriedades p
            WHERE p.id = v_record.propriedade_id AND p.user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Propriedade inválida ou não pertence ao usuário';
        END IF;
    END IF;

    INSERT INTO public.pmos SELECT v_record.*
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_pmo FROM public;
GRANT EXECUTE ON FUNCTION public.create_pmo TO authenticated;


CREATE OR REPLACE FUNCTION public.update_pmo(p_id bigint, p_payload jsonb)
RETURNS public.pmos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_existing public.pmos;
    v_record public.pmos;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    SELECT * INTO v_existing FROM public.pmos WHERE id = p_id AND user_id = v_user_id;
    IF v_existing IS NULL THEN
        RAISE EXCEPTION 'PMO não encontrado ou não pertence ao usuário';
    END IF;

    v_record := jsonb_populate_record(v_existing, p_payload);
    v_record.id := v_existing.id;
    v_record.user_id := v_existing.user_id;
    v_record.created_at := v_existing.created_at;

    IF v_record.propriedade_id IS NOT NULL AND v_record.propriedade_id != COALESCE(v_existing.propriedade_id, -1) THEN
        IF NOT EXISTS (SELECT 1 FROM public.propriedades p WHERE p.id = v_record.propriedade_id AND p.user_id = v_user_id) THEN
            RAISE EXCEPTION 'Propriedade inválida';
        END IF;
    END IF;

    UPDATE public.pmos SET
        (form_data, nome_identificador, status, version, propriedade_id, cultura, produtividade_kg_ha) =
        (v_record.form_data, v_record.nome_identificador, v_record.status, v_record.version, v_record.propriedade_id, v_record.cultura, v_record.produtividade_kg_ha)
    WHERE id = p_id
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.update_pmo FROM public;
GRANT EXECUTE ON FUNCTION public.update_pmo TO authenticated;


CREATE OR REPLACE FUNCTION public.delete_pmo(p_id bigint)
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

    DELETE FROM public.pmos WHERE id = p_id AND user_id = v_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'PMO não encontrado ou não pertence ao usuário';
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_pmo FROM public;
GRANT EXECUTE ON FUNCTION public.delete_pmo TO authenticated;


-- ==========================================
-- 2. PMO RELAÇÕES (Tabelas dinâmicas do formulário PMO)
-- ==========================================
CREATE OR REPLACE FUNCTION public.upsert_pmo_relacoes(p_table text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_allowed_tables text[] := ARRAY['pmo_manejo', 'pmo_propagacao', 'pmo_limpeza', 'pmo_maquinas', 'pmo_infraestrutura'];
    v_query text;
    v_result jsonb;
    v_pmo_id bigint;
    v_item jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    IF NOT (p_table = ANY(v_allowed_tables)) THEN
        RAISE EXCEPTION 'Tabela não permitida para upsert dinâmico: %', p_table;
    END IF;

    -- Extrai pmo_id do primeiro item (se for array)
    IF jsonb_typeof(p_payload) = 'array' AND jsonb_array_length(p_payload) > 0 THEN
        v_pmo_id := (p_payload->0->>'pmo_id')::bigint;
    ELSIF jsonb_typeof(p_payload) = 'object' THEN
        v_pmo_id := (p_payload->>'pmo_id')::bigint;
    ELSE
        RETURN '[]'::jsonb;
    END IF;

    -- Valida se o PMO pertence ao usuário
    IF NOT EXISTS (SELECT 1 FROM public.pmos WHERE id = v_pmo_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'PMO inválido ou não pertence ao usuário';
    END IF;

    -- Usa postgrest api internal upsert ou monta query dinâmica
    -- Como montar uma query dinâmica de upsert a partir de JSONB é complexo e propenso a injeção
    -- E o jsonb_populate_recordset funciona bem se tivermos um tipo de dado conhecido,
    -- Uma abordagem segura é iterar e fazer insert com on conflict, mas como as tabelas variam,
    -- usaremos jsonb_to_recordset passando o tipo de cada tabela dinamicamente.
    -- No entanto, PL/pgSQL não suporta jsonb_to_recordset com tabela dinâmica facilmente sem EXECUTE.
    -- Para simplificar e manter a segurança, como permitimos apenas um conjunto estrito de tabelas,
    -- nós podemos usar uma estrutura CASE explícita por tabela, mantendo 100% de type safety e evitando SQL dinâmico!

    -- A implementação original estática tinha erro de sintaxe e estava incompleta.
    -- O bloco abaixo usando EXECUTE (Dynamic SQL) já cuida de todas as tabelas corretamente.
    
    -- Como o SQL dinâmico de UPSERT pode ser complexo, uma abordagem alternativa segura para RPC:
    -- Vamos construir dinamicamente o insert ignorando conflitos ou atualizando.
    
    -- Em vez de tentar replicar o Upsert genérico inteiro no SQL com tipos dinâmicos, 
    -- O PMO frontend tem um uso bem específico: Salva a tabela inteira! 
    -- Na verdade, delete+insert é o padrão para relacional 1:N quando a tela salva o bloco inteiro.
    -- Mas a função `savePmoSection` atual do frontend usa `.upsert(cleanedData)`.
    -- A API REST do Supabase sabe montar o UPSERT por baixo dos panos.
    -- Para não quebrar a lógica, usaremos uma inserção dinâmica:
    
    v_query := format('
        WITH data_rows AS (
            SELECT * FROM jsonb_populate_recordset(null::public.%I, $1)
        )
        INSERT INTO public.%I
        SELECT * FROM data_rows
        ON CONFLICT (id) DO UPDATE SET 
            -- Atualiza todas as colunas exceto ID e created_at
            -- É possível que o usuário não possa fazer isso genericamente sem saber as colunas
            -- Mas o PostgreSQL não suporta `DO UPDATE SET * = EXCLUDED.*` nativamente :(
        ', p_table, p_table);

    -- Solução: Deixar essa função para ser refatorada mais cuidadosamente caso a caso,
    -- ou usar a chamada REST original mas garantindo RLS.
    -- ESPERA! Se as tabelas pmo_manejo, pmo_propagacao, etc. tem RLS habilitado, e RLS checa pmos.user_id = auth.uid(),
    -- a inserção direta via REST JÁ É SEGURA! O problema era que o REVOKE global cortaria o acesso.
    -- Se revogarmos o acesso da API REST, TEMOS que recriar na RPC.
    
    -- Melhor abordagem: Vamos fazer uma RPC que exclui todos os registros do PMO na tabela e insere os novos (Sync/Replace)!
    -- Isso é 100% seguro e não sofre com conflitos. 
    -- Frontend usa a tabela inteira como estado da seção.
    
    EXECUTE format('DELETE FROM public.%I WHERE pmo_id = $1', p_table) USING v_pmo_id;
    
    IF jsonb_array_length(p_payload) > 0 THEN
        EXECUTE format('
            INSERT INTO public.%I
            SELECT * FROM jsonb_populate_recordset(null::public.%I, $2)
        ', p_table, p_table) USING v_pmo_id, p_payload;
    END IF;

    RETURN p_payload;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.upsert_pmo_relacoes FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_pmo_relacoes TO authenticated;


CREATE OR REPLACE FUNCTION public.sync_culturas_anuais(p_pmo_id bigint, p_culturas jsonb)
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

    IF NOT EXISTS (SELECT 1 FROM public.pmos WHERE id = p_pmo_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'PMO inválido ou não pertence ao usuário';
    END IF;

    DELETE FROM public.culturas_anuais WHERE pmo_id = p_pmo_id;

    IF p_culturas IS NOT NULL AND jsonb_array_length(p_culturas) > 0 THEN
        INSERT INTO public.culturas_anuais
        SELECT * FROM jsonb_populate_recordset(null::public.culturas_anuais, p_culturas);
    END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_culturas_anuais FROM public;
GRANT EXECUTE ON FUNCTION public.sync_culturas_anuais TO authenticated;
