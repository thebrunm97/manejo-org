-- Migration: DT-98 + DT-101 — fecha leitura anônima e abre leitura de knowledge_chunks
-- apenas para quem tem papel de conhecimento (ou é admin)
--
-- Contexto:
--   * 20260823110000_sync_prod_orphan_functions.sql:80-86 criava em
--     public.knowledge_chunks a policy "Allow authenticated read" com USING (true)
--     (expõe TODO o conteúdo ingerido a qualquer authenticated — DT-98) e dava
--     GRANT SELECT, REFERENCES, TRIGGER a anon (leitura sem sessão nenhuma — DT-101).
--   * 20260823110100_add_n8n_invalid_auth_token.sql:46 dava o mesmo GRANT a anon
--     para public.invalid_auth_token.
--
--   public.farm_documents (mesmo arquivo, linhas 121-125) é INTENCIONALMENTE
--   excluído do escopo: RLS ligado + zero policies ali é comportamento de produção
--   replicado de propósito (comentário nas linhas 116-119), então não é tocado aqui.
--
--   knowledge_chunks NÃO tem coluna de tenant (colunas: id, document_name,
--   chunk_index, content, metadata, embedding — sem pmo_id). O escopo por PMO
--   continua dependendo do DT-46; por ora a leitura fica restrita a quem tem
--   papel de conhecimento (get_knowledge_role) ou é admin, mesmo padrão da policy
--   kd_select_observers (20260721180000_knowledge_ops_panel.sql:165-170).

REVOKE SELECT, REFERENCES, TRIGGER ON public.knowledge_chunks FROM anon;
REVOKE SELECT, REFERENCES, TRIGGER ON public.invalid_auth_token FROM anon;

DROP POLICY IF EXISTS "Allow authenticated read" ON public.knowledge_chunks;
CREATE POLICY "Allow authenticated read"
    ON public.knowledge_chunks FOR SELECT TO authenticated
    USING (
        public.get_knowledge_role() IN ('knowledge_observer','knowledge_editor','knowledge_reviewer','knowledge_publisher')
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );