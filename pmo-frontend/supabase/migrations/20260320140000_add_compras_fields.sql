-- Migration to add compliance fields for purchases
-- Form 6: Tabela de Compras (SEBRAE)

ALTER TABLE caderno_campo 
ADD COLUMN nota_fiscal text, 
ADD COLUMN fornecedor text;

COMMENT ON COLUMN caderno_campo.nota_fiscal IS 'Número da Nota Fiscal ou recibo da compra';
COMMENT ON COLUMN caderno_campo.fornecedor IS 'Nome do fornecedor do insumo ou produto';
