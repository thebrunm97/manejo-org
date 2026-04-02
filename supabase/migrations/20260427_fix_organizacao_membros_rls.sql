-- Migration: Fix Recursive RLS in organizacao_membros
-- Date: 2026-04-27

-- 1. Disable existing recursive policies
DROP POLICY IF EXISTS "Membros podem ver membros da mesma organizacao" ON public.organizacao_membros;
DROP POLICY IF EXISTS "Admins podem tudo nos membros" ON public.organizacao_membros;

-- 2. Create simplified SELECT policy (Non-Recursive)
-- Users can see their own memberships (linked to their properties)
CREATE POLICY "organizacao_membros_select_policy" 
ON public.organizacao_membros 
FOR SELECT 
USING (
    propriedade_id IN (SELECT id FROM public.propriedades WHERE user_id = auth.uid())
    OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Create Admin ALL policy
CREATE POLICY "organizacao_membros_admin_all" 
ON public.organizacao_membros 
FOR ALL 
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Enable RLS (just in case)
ALTER TABLE public.organizacao_membros ENABLE ROW LEVEL SECURITY;
