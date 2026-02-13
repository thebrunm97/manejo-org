-- Migration: Admin User Details RPC
-- Reason: Fetch email from auth.users (unreachable by public API) + profile data
-- Date: 2026-01-24

CREATE OR REPLACE FUNCTION public.get_admin_user_details(target_user_id UUID)
RETURNS TABLE (
  nome TEXT,
  email VARCHAR,
  plan_tier TEXT,
  role TEXT
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- 1. Security Check: Only admins can call this
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only admins can view full user details.';
  END IF;

  -- 2. Return Joined Data
  RETURN QUERY
  SELECT 
    p.nome,
    u.email::VARCHAR,
    COALESCE(p.plan_tier, 'free'), -- Default to free if null
    p.role
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = target_user_id;
END;
$$ LANGUAGE plpgsql;
