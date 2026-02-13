-- Migration: Fix Recursive RLS on Profiles
-- Date: 2026-01-24
-- Description: The 'Admins can view all profiles' policy causes infinite recursion because is_admin() queries profiles.
-- We drop this policy to unblock the app. Admin access to profiles should be handled via a separate secure view or non-recursive logic.

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- 2. Ensure the standard "View Own" policy exists and is correct (re-apply from migration 04 just in case)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- 3. Optimization: Creating an index on role could help, but not strictly necessary for this fix.
