-- DT-111 (parte b): aplicada em produção via MCP em 2026-09-08 com esta
-- versão; o arquivo foi recuperado de supabase_migrations.schema_migrations
-- em 2026-09-30 (sincronização de drift). A parte (a) + esta estão também
-- descritas em 20260908225933_dt111a_anexos_pmos_bucket_private.sql.

UPDATE storage.buckets SET public = false WHERE id = 'comprovantes';

DROP POLICY IF EXISTS "Insert policy for comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Read policy for comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Update policy for comprovantes" ON storage.objects;
DROP POLICY IF EXISTS "Delete policy for comprovantes" ON storage.objects;

CREATE POLICY "Insert policy for comprovantes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Read policy for comprovantes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Update policy for comprovantes"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Delete policy for comprovantes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'comprovantes' AND auth.uid()::text = (storage.foldername(name))[1]);
