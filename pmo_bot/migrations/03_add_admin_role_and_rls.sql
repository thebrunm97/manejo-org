-- Migration: Add Admin Role, Security, and Dashboard Stats
-- Date: 2026-01-24

-- 1. Add Role Column to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- 2. Helper Function: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Checks if the current user has the 'admin' role in their profile
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Security Hardening: Prevent User from Changing their own Role
CREATE OR REPLACE FUNCTION public.custom_access_role_protection()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if role is being changed
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Allow change ONLY if the user executing this is an admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Only admins can change user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_role_protection ON public.profiles;
CREATE TRIGGER ensure_role_protection
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.custom_access_role_protection();

-- 4. RLS Policy Updates
-- Enable RLS just in case
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_treinamento ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin());

-- (Existing policies for 'own profile' usually cover the rest, but we ensure specificity if needed)

-- Logs Policies
-- Allow admins to see EVERYTHING in logs_consumo
CREATE POLICY "Admins can view all consumption logs"
ON public.logs_consumo FOR SELECT
TO authenticated
USING (public.is_admin());

-- Allow admins to see EVERYTHING in logs_treinamento
CREATE POLICY "Admins can view all training logs"
ON public.logs_treinamento FOR SELECT
TO authenticated
USING (public.is_admin());

-- 5. Performance: Dashboard Stats RPC
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  v_total_cost NUMERIC;
  v_total_tokens BIGINT;
  v_active_users INT;
  v_start_date TIMESTAMP;
BEGIN
  v_start_date := date_trunc('month', CURRENT_DATE);

  -- Cost & Tokens (Current Month)
  SELECT 
    COALESCE(SUM(custo_estimado), 0),
    COALESCE(SUM(total_tokens), 0)
  INTO v_total_cost, v_total_tokens
  FROM public.logs_consumo
  WHERE created_at >= v_start_date;

  -- Active Users (Last 24h based on log activity)
  SELECT COUNT(DISTINCT user_id)
  INTO v_active_users
  FROM public.logs_consumo
  WHERE created_at >= (NOW() - INTERVAL '24 hours');
  
  RETURN json_build_object(
    'total_cost', v_total_cost,
    'total_tokens', v_total_tokens,
    'active_users_24h', v_active_users
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
