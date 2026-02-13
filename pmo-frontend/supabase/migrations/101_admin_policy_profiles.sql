-- Migration: Admin Policy for Profiles
-- Reason: Allow admins to view details (name, email, plan) of ALL users in the LogDetailsModal
-- Date: 2026-01-24

-- 1. Ensure RLS is enabled (usually is, but good practice)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop if exists to avoid conflicts
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- 3. Create Policy
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());
