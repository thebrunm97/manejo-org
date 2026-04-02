-- Migration: Rastreabilidade Pública
-- Created at: 2026-05-03

CREATE OR REPLACE FUNCTION public.get_rastreabilidade_publica(p_registro_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT json_build_object(
        'produto', cc.produto,
        'data_operacao', cc.data_registro,
        'fazenda_nome', p.nome,
        'municipio', p.cidade,
        'estado', p.uf,
        'produtor_nome', pr.nome,
        'cooperativa_nome', o.nome,
        'tipo_atividade', cc.tipo_atividade
    ) INTO v_result
    FROM public.caderno_campo cc
    JOIN public.propriedades p ON cc.propriedade_id = p.id
    LEFT JOIN public.profiles pr ON p.user_id = pr.id
    LEFT JOIN public.organizacao_membros om ON om.propriedade_id = p.id
    LEFT JOIN public.organizacoes o ON o.id = om.organizacao_id
    WHERE cc.id = p_registro_id
    LIMIT 1;

    RETURN v_result;
END;
$$;
