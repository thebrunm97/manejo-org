-- DT-111 — buckets anexos-pmos e comprovantes privados + policies por posse
-- project: manejo-org (linked)
--
-- CONTEXTO
--
-- Os buckets 'anexos-pmos' e 'comprovantes' foram virados privados (public = false)
-- diretamente em produção (commit 661d499, "Flipados para privados em producao"),
-- sem nenhuma migration correspondente — o histórico de migrations ficou
-- dessincronizado do estado real do banco. Esta migration formaliza esse estado,
-- para que um ambiente novo (`supabase db reset`/`db push`) chegue ao mesmo lugar.
--
-- 'anexos-pmos' já tinha 4 policies corretas por pasta (INSERT/SELECT/UPDATE/DELETE
-- com validação de extensão), mas elas só existiam em
-- pmo-frontend/supabase/migrations/20260119_storage_rls_policies.sql — uma pasta
-- órfã sem config.toml, nunca rastreada pelo projeto Supabase linkado (o linkado é
-- ./supabase). Portadas aqui para o diretório canônico, de forma idempotente
-- (DROP POLICY IF EXISTS + CREATE POLICY, mesmo padrão das demais migrations de
-- bucket deste projeto).
--
-- 'comprovantes' nunca teve nenhuma policy de storage.objects — bucket público
-- sem controle de leitura. Path contrato confirmado em
-- dashboardService.ts:uploadComprovante = `${userId}/${fileName}`, o mesmo
-- formato de posse por primeiro segmento do path usado em anexos-pmos/avatars/
-- audios_audit. Nenhum objeto legado sem esse prefixo é esperado (ao contrário de
-- avatars/DT-108), então não há fallback por owner_id aqui.
--
-- Nenhum dos dois buckets tem chamador vivo hoje fora de anexos-pmos (Seção 18 do
-- PMO); comprovantes está sem chamador ativo, mas ajustado do mesmo jeito para não
-- deixar código morto quebrado se for reativado (mesma justificativa do commit
-- 661d499 que trouxe as mudanças de frontend).

BEGIN;

UPDATE storage.buckets SET public = false WHERE id IN ('anexos-pmos', 'comprovantes');

-- -----------------------------------------------------------
-- anexos-pmos — portado de pmo-frontend/supabase/migrations/20260119_storage_rls_policies.sql
-- -----------------------------------------------------------
--
-- A fonte original criava o helper em storage.validate_file_extension, mas o
-- papel usado por `supabase db push`/migration runner não tem CREATE no
-- schema storage (confirmado ao rodar esta migration localmente: "permission
-- denied for schema storage"). public.validate_file_extension(name,
-- allowed_extensions) já existe com a mesma assinatura e lógica equivalente
-- (criado em 20260823110000_sync_prod_orphan_functions.sql), então reusamos
-- em vez de recriar em storage.

DROP POLICY IF EXISTS "Upload policy for anexos-pmos" ON storage.objects;
CREATE POLICY "Upload policy for anexos-pmos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.validate_file_extension(
        name,
        ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf', 'doc', 'docx']
    )
);

DROP POLICY IF EXISTS "Read policy for anexos-pmos" ON storage.objects;
CREATE POLICY "Read policy for anexos-pmos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Delete policy for anexos-pmos" ON storage.objects;
CREATE POLICY "Delete policy for anexos-pmos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Update policy for anexos-pmos" ON storage.objects;
CREATE POLICY "Update policy for anexos-pmos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'anexos-pmos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND public.validate_file_extension(
        name,
        ARRAY['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'pdf', 'doc', 'docx']
    )
);

-- -----------------------------------------------------------
-- comprovantes — policies novas (bucket nunca teve nenhuma)
-- -----------------------------------------------------------

DROP POLICY IF EXISTS "Upload policy for comprovantes" ON storage.objects;
CREATE POLICY "Upload policy for comprovantes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Read policy for comprovantes" ON storage.objects;
CREATE POLICY "Read policy for comprovantes"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Update policy for comprovantes" ON storage.objects;
CREATE POLICY "Update policy for comprovantes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
    bucket_id = 'comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Delete policy for comprovantes" ON storage.objects;
CREATE POLICY "Delete policy for comprovantes"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

COMMIT;
