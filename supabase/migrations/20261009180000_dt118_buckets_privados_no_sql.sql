-- DT-118: buckets de storage declarados no SQL, sempre privados.
--
-- O item original apontava criação de bucket em runtime pelo bot
-- (auditvault/adapter.go); esse código já não existe. O que restava era o
-- outro lado do mesmo risco: `audit-vault` (cofre de áudio, P0-1) e outros
-- quatro buckets foram criados pelo painel e não existiam em nenhuma
-- migration — num banco novo (staging, local, recuperação) eles nasceriam
-- pela mão de alguém, e o default do painel é decidir `public` na hora.
--
-- Estado em produção em 2026-10-09 (conferido): os seis buckets já estão
-- public=false. Esta migration não muda nada lá; só fixa o contrato.
-- ON CONFLICT só força public=false — não mexe em limite/MIME de buckets que
-- já existem, para não alterar comportamento de upload em produção.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('audit-vault', 'audit-vault', false, 26214400,
     ARRAY['audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/webm']),
  ('audios_audit', 'audios_audit', false, NULL, NULL),
  ('comprovantes', 'comprovantes', false, 52428800, NULL),
  ('anexos-pmos', 'anexos-pmos', false, NULL, NULL),
  ('avatars', 'avatars', false, NULL, NULL)
ON CONFLICT (id) DO UPDATE SET public = false;
