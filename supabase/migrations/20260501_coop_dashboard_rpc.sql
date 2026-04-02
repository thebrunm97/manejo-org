-- ==============================================================================
-- MIGRATION: RPC para Agregação de Dados do Dashboard da Cooperativa (B2B)
-- ==============================================================================

CREATE OR REPLACE FUNCTION get_coop_dashboard_stats(p_organizacao_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_gestor BOOLEAN;
  v_total_membros BIGINT;
  v_area_total NUMERIC;
  v_producao_recente JSONB;
BEGIN
  -- 1. TRAVA DE SEGURANÇA MANUAL (ACL)
  -- Verifica se o usuário logado possui alguma propriedade vinculada como 'gestor' nesta org
  SELECT EXISTS (
    SELECT 1 
    FROM organizacao_membros om
    JOIN propriedades p ON om.propriedade_id = p.id
    WHERE om.organizacao_id = p_organizacao_id
      AND p.user_id = auth.uid()
      AND om.role = 'gestor'
  ) INTO v_is_gestor;

  -- Bypass para super-administradores do sistema
  IF NOT v_is_gestor THEN
    SELECT EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ) INTO v_is_gestor;
  END IF;

  -- Se não for gestor nem admin, bloqueia o acesso
  IF NOT v_is_gestor THEN
    RAISE EXCEPTION 'Acesso negado: Apenas gestores podem visualizar estes dados.';
  END IF;

  -- 2. EXTRAÇÃO E AGREGAÇÃO DE DADOS

  -- Contagem de propriedades/produtores únicos na organização
  SELECT COUNT(DISTINCT propriedade_id)
  FROM organizacao_membros
  WHERE organizacao_id = p_organizacao_id
  INTO v_total_membros;

  -- Soma da área total (ha) das propriedades vinculadas
  SELECT COALESCE(SUM(p.area_total_ha), 0)
  FROM organizacao_membros om
  JOIN propriedades p ON om.propriedade_id = p.id
  WHERE om.organizacao_id = p_organizacao_id
  INTO v_area_total;

  -- Últimos 10 registros de COLHEITA do grupo
  SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb)
  FROM (
    SELECT 
      cc.id,
      cc.data_registro,
      cc.produto,
      cc.quantidade_valor,
      cc.quantidade_unidade,
      p.nome as propriedade_nome
    FROM caderno_campo cc
    JOIN organizacao_membros om ON cc.propriedade_id = om.propriedade_id
    JOIN propriedades p ON cc.propriedade_id = p.id
    WHERE om.organizacao_id = p_organizacao_id
      AND (cc.tipo_atividade ILIKE 'COLHEITA%') -- Pega 'COLHEITA' e 'Colheita'
    ORDER BY cc.data_registro DESC
    LIMIT 10
  ) sub
  INTO v_producao_recente;

  -- 3. RETORNO ESTRUTURADO
  RETURN jsonb_build_object(
    'total_membros', v_total_membros,
    'area_total_vinculada', v_area_total,
    'producao_recente', v_producao_recente,
    'last_updated', now()
  );
END;
$$;

-- Comentários de Documentação para o PostgREST
COMMENT ON FUNCTION get_coop_dashboard_stats(p_organizacao_id BIGINT) IS 'Agrega dados operacionais de membros de uma cooperativa para o dashboard B2B.';
