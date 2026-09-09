-- DT-108 — bucket avatars privado + policies com posse por path <uid>/...
-- project: pmo-frontend
--
-- CONTEXTO
--
-- 20260328_add_avatar_to_profiles.sql criou o bucket 'avatars' com public = true
-- e policies que só checam auth.role() = 'authenticated'. Nenhuma compara o path
-- do objeto com auth.uid(): qualquer usuário logado podia UPDATE/DELETE objetos
-- de qualquer outro usuário, e a policy SELECT era pública. Pior: o avatar é
-- único objeto do produto com URL previsível (o frontend usava getPublicUrl no
-- profileService.ts:129) — gravado na coluna profiles.avatar_url, vazar a tabela
-- vazava o avatar de todo mundo.
--
-- CONTRATO NOVO (única migration do lote que muda layout de path)
--
-- O primeiro segmento do path passa a ser o auth.uid() do dono (`<uid>/...`),
-- no padrão de audios_audit/audit-vault. Como é mudança de contrato, o frontend
-- muda no MESMO PR: profileService.ts passa a dar upload para `<uid>/...` e a
-- leitura deixa de usar getPublicUrl (URL pública morre com o bucket privado) e
-- passa a assinar URL via createSignedUrl no render (Sidebar/ProfilePage).
--
-- BUCKET PRIVADO + SIGNED URL (decisão explícita do usuário)
--
-- SELECT é titular-only: é a policy de leitura no storage.objects que autoriza o
-- createSignedUrl de quem assina (o frontend usa o JWT do usuário logado).
--
-- Objetos legados no formato `<uid>-<rand>.<ext>` (sem segmento de diretório)
-- não casam com o novo split_part(name, '/', 1) e, sem o fallback, nem o dono
-- os leria depois de privado — avatares de usuários ativos quebrariam. O storage
-- seta storage.objects.owner_id a partir do JWT de quem fez o upload, então
-- `OR owner_id::text = auth.uid()::text` readmite os legados ao dono. INSERT/UPDATE com
-- WITH CHECK seguem estritamente o path, para que toda escrita nova obedeça o
-- contrato. service_role (importações) segue salvando por bypass de RLS.

BEGIN;

UPDATE storage.buckets SET public = false WHERE id = 'avatars';

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'avatars'
    AND (auth.uid()::text = split_part(name, '/', 1) OR owner_id::text = auth.uid()::text)
  );

CREATE POLICY "Anyone can upload an avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (auth.uid()::text = split_part(name, '/', 1) OR owner_id::text = auth.uid()::text)
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = split_part(name, '/', 1)
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (auth.uid()::text = split_part(name, '/', 1) OR owner_id::text = auth.uid()::text)
  );

COMMIT;