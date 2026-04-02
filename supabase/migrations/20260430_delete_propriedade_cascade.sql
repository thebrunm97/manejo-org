-- ==============================================================================
-- MIGRATION: RPC para Exclusão em Cascata de Propriedade
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_propriedade_cascade(p_propriedade_id BIGINT)
RETURNS void 
LANGUAGE plpgsql
SECURITY INVOKER -- Garante que as regras de RLS do usuário logado sejam respeitadas
AS $$
BEGIN
  -- 0. Deletar registros de rastreabilidade (dependem da propriedade)
  DELETE FROM lotes_rastreabilidade
  WHERE propriedade_id = p_propriedade_id;

  -- 1. Deletar as alocações financeiras que dependem dos talhões
  DELETE FROM transacao_alocacoes 
  WHERE talhao_id IN (SELECT id FROM talhoes WHERE propriedade_id = p_propriedade_id);

  -- 2. Deletar as transações financeiras da propriedade
  DELETE FROM transacoes_financeiras 
  WHERE propriedade_id = p_propriedade_id;

  -- 3. Deletar os registros do caderno de campo (Ajustado para o nome real da tabela)
  DELETE FROM caderno_campo 
  WHERE propriedade_id = p_propriedade_id;
  
  -- 3.1. Deletar cotas de produtores
  DELETE FROM cotas_produtores
  WHERE propriedade_id = p_propriedade_id;

  -- 4. Deletar os PMOs (Plano de Manejo Orgânico)
  -- Nota: Tabelas internas de PMO (culturas, insumos, etc) têm CASCADE no banco.
  -- Mas o elo pmos -> propriedades é NO ACTION, então removemos manualmente aqui.
  DELETE FROM pmos 
  WHERE propriedade_id = p_propriedade_id;

  -- 5. Deletar os talhões da propriedade
  DELETE FROM talhoes 
  WHERE propriedade_id = p_propriedade_id;

  -- 6. Remover a propriedade de qualquer cooperativa/organização
  DELETE FROM organizacao_membros 
  WHERE propriedade_id = p_propriedade_id;

  -- 7. Remover a referência de "propriedade_ativa" dos perfis dos usuários
  UPDATE profiles 
  SET propriedade_ativa_id = NULL 
  WHERE propriedade_ativa_id = p_propriedade_id;

  -- 8. O Golpe Final: Deletar a propriedade em si
  DELETE FROM propriedades 
  WHERE id = p_propriedade_id;

END;
$$;
