-- Migração: rpc_registrar_compra_insumo
-- Garante unicidade e atomicidade no cadastro de insumos e compras.

-- 1. Adicionar restrição de unicidade em pmo_insumos
-- Isso permite o uso de ON CONFLICT para garantir idempotência do catálogo.
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_pmo_insumo_produto'
    ) THEN
        ALTER TABLE public.pmo_insumos 
        ADD CONSTRAINT unique_pmo_insumo_produto UNIQUE (pmo_id, produto_manejo);
    END IF;
END $$;

-- 2. Criar RPC rpc_registrar_compra_insumo
CREATE OR REPLACE FUNCTION public.rpc_registrar_compra_insumo(
    pmo_id_arg BIGINT,
    user_id_arg UUID,
    produto_arg TEXT,
    quantidade_valor_arg NUMERIC,
    quantidade_unidade_arg TEXT,
    fornecedor_arg TEXT DEFAULT NULL,
    data_compra_arg DATE DEFAULT CURRENT_DATE,
    nota_fiscal_arg TEXT DEFAULT NULL,
    marca_arg TEXT DEFAULT NULL,
    composicao_arg TEXT DEFAULT NULL,
    procedencia_arg TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_insumo_id UUID;
    v_compra_id UUID;
    v_detalhes JSONB;
BEGIN
    -- 1. Garantir que o insumo existe no catálogo (Seção 8)
    -- Se já existir, podemos opcionalmente atualizar marca/composição se vierem preenchidos
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
        observacao_original
    )
    VALUES (
        pmo_id_arg,
        user_id_arg,
        'Compra', -- Mudando de 'Insumo' para 'Compra' para ser mais descritivo, ou manter compatibilidade
        data_compra_arg,
        produto_arg,
        quantidade_valor_arg,
        quantidade_unidade_arg,
        fornecedor_arg,
        nota_fiscal_arg,
        v_detalhes,
        'mcp_rpc_v2',
        format('Compra de %s %s de %s registrada via bot.', quantidade_valor_arg, quantidade_unidade_arg, produto_arg)
    )
    RETURNING id INTO v_compra_id;

    -- 4. Retornar IDs
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
$$;
