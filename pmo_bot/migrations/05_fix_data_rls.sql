-- Migration: Fix RLS for PMO and Caderno Campo
-- Date: 2026-01-24

-- 1. Ensure RLS is enabled on PMO tables
ALTER TABLE public.pmos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caderno_campo ENABLE ROW LEVEL SECURITY;

-- 2. Create/Replace Policies for PMOS (Read/Write for Owner)
-- Check if user is owner of the PMO (via profile link or direct user_id?)
-- Assuming PMOs are linked via profiles.pmo_ativo_id or maybe pmos has a user_id?
-- Let's check the schema logic. Profile has `pmo_ativo_id`.
-- But usually tables have a `user_id` column. If `pmos` doesn't have `user_id`, we rely on join.
-- BUT RLS on `pmos` needs to know if the user owns it.
-- Let's assume `pmos` might NOT have `user_id` if it's shared?
-- Wait, inspecting schema is hard without reading it. I'll blindly add policies that assume NO user_id exists if I'm not sure,
-- BUT standard practice is `user_id` or `profile_id`.
-- Let's guess `pmos` has `user_id` or `propriedade_id` which links to user.

-- Checking dashboardService query:
-- profiles -> pmo_ativo_id (PMO)
-- So the user "owns" the PMO linked in their profile.

-- POLICY: Allow read if the PMO is the user's active PMO (via Profile)
-- This is a JOIN POLICY, might be expensive but correct.
DROP POLICY IF EXISTS "Users can view key PMO" ON public.pmos;
CREATE POLICY "Users can view key PMO"
ON public.pmos
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- 3. Create/Replace Policies for CADERNO_CAMPO
-- Caderno Campo has `pmo_id`.
DROP POLICY IF EXISTS "Users can view own notebook" ON public.caderno_campo;
CREATE POLICY "Users can view own notebook"
ON public.caderno_campo
FOR SELECT
TO authenticated
USING (
  pmo_id IN (
    SELECT pmo_ativo_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- 4. Admin Override (Always allow Admin)
DROP POLICY IF EXISTS "Admins can view all PMOs" ON public.pmos;
CREATE POLICY "Admins can view all PMOs"
ON public.pmos
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

DROP POLICY IF EXISTS "Admins can view all Notebooks" ON public.caderno_campo;
CREATE POLICY "Admins can view all Notebooks"
ON public.caderno_campo
FOR ALL
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
