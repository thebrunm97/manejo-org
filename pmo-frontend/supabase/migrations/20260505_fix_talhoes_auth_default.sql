-- 20260505_fix_talhoes_auth_default.sql
-- Objetivo: Resolver Erro 403 no INSERT e recuperar talhões órfãos

-- 1. Definir o ID do usuário como padrão para novos registros (Resolve o Erro 403 no INSERT)
ALTER TABLE "public"."talhoes" 
ALTER COLUMN "user_id" SET DEFAULT auth.uid();

-- 2. Recuperar registros órfãos vinculando-os ao dono da propriedade correspondente
-- Isso garante que talhões já criados voltem a aparecer para os usuários
UPDATE public.talhoes t
SET user_id = p.user_id
FROM public.propriedades p
WHERE t.propriedade_id = p.id
AND t.user_id IS NULL;

-- 3. Garantir que a política de RLS permite gerenciar talhões
-- Nota: A política existente 'Usuários gerenciam seus talhões' já cobre ALL (SELECT, INSERT, UPDATE, DELETE)
-- baseada em (auth.uid() = user_id)

COMMENT ON TABLE "public"."talhoes" IS 'Tabela de talhões com valor padrão de user_id corrigido para auth.uid().';
