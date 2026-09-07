-- Feature Multicanal — Fase A.5a
-- Backfill: popular channel e user_id em messages existentes.
-- Também popula tenant_id em conversations a partir de profiles.
--
-- ESTRATÉGIA:
-- 1. Derivar user_id a partir de phone via profiles (normalize_phone)
-- 2. Setar channel = 'whatsapp' para todas as existentes (é o único canal até aqui)
-- 3. Popular tenant_id em conversations via pmo_id → pmos.organizacao_id
--
-- NOTA: mensagens sem perfil resolvível ficam com user_id NULL.
-- O campo channel_msg_id permanece NULL para mensagens antigas (dedup é só pós-migração).

BEGIN;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 1. Derivar user_id em messages a partir de phone via profiles   ║
-- ╚══════════════════════════════════════════════════════════════════╝

UPDATE public.messages m
SET user_id = p.id  -- profiles.id = auth.users.id (mesmo UUID)
FROM public.profiles p
WHERE public.normalize_phone(m.phone) = public.normalize_phone(p.telefone)
  AND m.user_id IS NULL
  AND m.phone IS NOT NULL
  AND p.telefone IS NOT NULL;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 2. Garantir channel = 'whatsapp' em todas as mensagens antigas  ║
-- ╚══════════════════════════════════════════════════════════════════╝

UPDATE public.messages
SET channel = 'whatsapp'
WHERE channel IS NULL;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 3. Popular tenant_id em conversations                            ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Derivar tenant_id da organização ligada ao PMO ativo do perfil
UPDATE public.conversations c
SET tenant_id = pmo.organizacao_id
FROM public.pmos pmo
WHERE c.pmo_id = pmo.id
  AND c.tenant_id IS NULL
  AND pmo.organizacao_id IS NOT NULL;

COMMIT;

-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ 4. Validação (rodar manualmente antes de A.5b)                   ║
-- ╚══════════════════════════════════════════════════════════════════╝
-- SELECT COUNT(*) AS total, 
--        COUNT(user_id) AS com_user_id,
--        COUNT(*) - COUNT(user_id) AS sem_user_id
-- FROM public.messages;
--
-- SELECT COUNT(*) AS total,
--        COUNT(tenant_id) AS com_tenant,
--        COUNT(*) - COUNT(tenant_id) AS sem_tenant
-- FROM public.conversations;
