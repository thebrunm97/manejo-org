-- Atualização da RPC de Registro de Compra de Insumos
-- Objetivo: Garantir associação com propriedade e evitar falhas silenciosas.

CREATE OR REPLACE FUNCTION public.rpc_registrar_compra_insumo(
    pmo_id_arg bigint, 
    propriedade_id_arg bigint,
    user_id_arg uuid, 
    produto_arg text, 
    quantidade_valor_arg numeric, 
    quantidade_unidade_arg text, 
    fornecedor_arg text DEFAULT NULL::text, 
    data_compra_arg date DEFAULT CURRENT_DATE, 
    nota_fiscal_arg text DEFAULT NULL::text, 
    marca_arg text DEFAULT NULL::text, 
    composicao_arg text DEFAULT NULL::text, 
    procedencia_arg text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_insumo_id UUID;
    v_compra_id UUID;
    v_detalhes JSONB;
    v_modalidade_interceptada public.modalidade_producao_enum := 'ORGANICO';
BEGIN
    -- 1. Garantir que o insumo existe no catálogo (Seção 8)
    INSERT INTO public.pmo_insumos (
        pmo_id, 
        produto_manejo, 
        marca, 
        composicao, 
        procedencia
    )
    VALUES (
        pmo_id_arg, 
        produto_arg, 
        marca_arg, 
        composicao_arg, 
        procedencia_arg
    )
    ON CONFLICT (pmo_id, produto_manejo) 
    DO UPDATE SET
        marca = COALESCE(EXCLUDED.marca, pmo_insumos.marca),
        composicao = COALESCE(EXCLUDED.composicao, pmo_insumos.composicao),
        procedencia = COALESCE(EXCLUDED.procedencia, pmo_insumos.procedencia)
    RETURNING id INTO v_insumo_id;

    -- 2. Montar detalhes técnicos extras para o caderno de campo
    v_detalhes := jsonb_build_object(
        'insumo_id', v_insumo_id,
        'nota_fiscal', nota_fiscal_arg,
        'marca', marca_arg,
        'composicao', composicao_arg
    );

    -- 3. Registrar a compra no caderno de campo
    INSERT INTO public.caderno_campo (
        pmo_id,
        propriedade_id,
        user_id,
        tipo_atividade,
        data_registro,
        produto,
        quantidade_valor,
        quantidade_unidade,
        fornecedor,
        nota_fiscal,
        detalhes_tecnicos,
        secao_origem,
        observacao_original,
        modalidade_aplicada
    )
    VALUES (
        pmo_id_arg,
        propriedade_id_arg,
        user_id_arg,
        'Compra', 
        data_compra_arg,
        produto_arg,
        quantidade_valor_arg,
        quantidade_unidade_arg,
        fornecedor_arg,
        nota_fiscal_arg,
        v_detalhes,
        'mcp_rpc_v2',
        format('Compra de %s %s de %s registrada via bot.', quantidade_valor_arg, quantidade_unidade_arg, produto_arg),
        v_modalidade_interceptada
    )
    RETURNING id INTO v_compra_id;

    -- 4. Validação de Segurança (Anti-Silent Failure)
    IF v_compra_id IS NULL THEN
        RAISE EXCEPTION 'Erro crítico: O ID da compra não foi gerado. Verifique as políticas de RLS ou constraints da tabela caderno_campo.';
    END IF;

    -- 5. Retornar IDs de sucesso
    RETURN jsonb_build_object(
        'status', 'success',
        'insumo_id', v_insumo_id,
        'compra_id', v_compra_id,
        'message', format('Insumo %s garantido no catálogo e compra registrada com sucesso.', produto_arg)
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$function$;
