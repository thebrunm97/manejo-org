-- Unified RPC for Infrastructure Creation (Talhão and Canteiros)
-- Centralizes logic for area calculation, geometry defaults, and atomic creation.

CREATE OR REPLACE FUNCTION public.criar_infraestrutura_pmo(
    p_pmo_id BIGINT,
    p_user_id UUID,
    p_propriedade_id BIGINT,
    p_nome_talhao TEXT,
    p_area_ha NUMERIC DEFAULT NULL,
    p_canteiros JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_talhao_id BIGINT;
    v_area_m2 NUMERIC;
    v_canteiro JSONB;
    v_created_canteiros_count INT := 0;
    v_result JSONB;
BEGIN
    -- 1. Resolve or Create Talhão
    SELECT id INTO v_talhao_id
    FROM public.talhoes
    WHERE pmo_id = p_pmo_id 
      AND nome ILIKE p_nome_talhao
    LIMIT 1;

    IF v_talhao_id IS NULL THEN
        -- Calculate Area M2
        IF p_area_ha IS NOT NULL THEN
            v_area_m2 := p_area_ha * 10000;
        END IF;

        INSERT INTO public.talhoes (
            pmo_id,
            user_id,
            propriedade_id,
            nome,
            area_ha,
            area_total_m2,
            geometry,
            cor_identificacao,
            fill_color,
            border_color
        ) VALUES (
            p_pmo_id,
            p_user_id,
            p_propriedade_id,
            p_nome_talhao,
            p_area_ha,
            v_area_m2,
            '{"type": "Polygon", "coordinates": []}'::jsonb,
            '#4CAF50',
            '#3bb444',
            '#228b22'
        )
        RETURNING id INTO v_talhao_id;
    END IF;

    -- 2. Create Canteiros if provided
    IF p_canteiros IS NOT NULL AND jsonb_array_length(p_canteiros) > 0 THEN
        FOR v_canteiro IN SELECT * FROM jsonb_array_elements(p_canteiros)
        LOOP
            INSERT INTO public.canteiros (
                talhao_id,
                nome,
                largura_metros,
                comprimento_metros,
                area_total_m2,
                tipo_estrutura
            ) VALUES (
                v_talhao_id,
                v_canteiro->>'nome',
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, 1.0),
                COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, 10.0),
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, 1.0) * COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, 10.0),
                'canteiro'
            );
            v_created_canteiros_count := v_created_canteiros_count + 1;
        END LOOP;
    END IF;

    -- 3. Construct Result
    v_result := jsonb_build_object(
        'talhao_id', v_talhao_id,
        'nome_talhao', p_nome_talhao,
        'canteiros_criados', v_created_canteiros_count,
        'status', 'success'
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.criar_infraestrutura_pmo(BIGINT, UUID, BIGINT, TEXT, NUMERIC, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_infraestrutura_pmo(BIGINT, UUID, BIGINT, TEXT, NUMERIC, JSONB) TO service_role;
