-- Migration: DT-105 — fecha o bucket audios_audit (public = false)
--
-- Contexto: a tabela audios_audit já é exemplar em RLS (FORCE RLS, titular-only) e
-- a assinatura de URL já existe via policy de storage
-- (20260822170000_audios_audit_signed_url_policy.sql — "titular assina audio do
-- proprio pmo" sobre storage.objects). O que faltava: a migration original nunca
-- marcou o bucket como privado, então ele continua public = true em storage.buckets
-- — qualquer link para o objeto abre o áudio sem autenticação.
--
-- Confirmado antes de escrever (grep -rn "audios_audit" pmo-frontend/src/): a única
-- referência é services/audioSigningService.ts:17, que emite URL por
-- createSignedUrl (linhas 90-92) — NENHUM componente usa getPublicUrl para
-- audios_audit. Os getPublicUrl restantes no frontend são de outros buckets
-- (avatars, comprovantes). Tornar o bucket privado não quebra a reprodução no
-- frontend, que já depende da assinatura de curta duração.
--
-- service_role (bot) segue lendo/escrevendo no bucket (mantém acesso via trunk de
-- storage independente de public).

UPDATE storage.buckets SET public = false WHERE id = 'audios_audit';