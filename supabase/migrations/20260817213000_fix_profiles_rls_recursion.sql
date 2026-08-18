-- Fix infinite recursion in public.profiles RLS policies

-- Create a security definer function to read the user's role bypassing RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
    RETURN v_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins veem todos os perfis" ON public.profiles;

-- Recreate the policy using the secure function
CREATE POLICY "Admins veem todos os perfis"
ON public.profiles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
