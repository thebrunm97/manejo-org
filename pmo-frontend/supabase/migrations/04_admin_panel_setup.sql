-- Migration: Admin Panel Setup (Role, Security, Stats, Policies)
-- Description: Sets up RBAC with 'role' column, prevents self-promotion, adds dashboard stats RPC, and updates RLS.

-- 1. Add Role Column to Profiles
-- Using DO block to avoid error if column exists while ensuring constraint
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

-- 2. Helper Function: is_admin()
-- Efficiently checks if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Security Hardening: Prevent User from Changing their own Role
CREATE OR REPLACE FUNCTION public.trg_prevent_self_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if role is being changed
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Allow change ONLY if the user executing this is an admin OR it's a service_role update
    IF (auth.jwt() ->> 'role') <> 'service_role' AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access Denied: Only admins can change user roles.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_role_protection ON public.profiles;
CREATE TRIGGER ensure_role_protection
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_prevent_self_promotion();

-- 4. Performance: Dashboard Stats RPC
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  v_total_cost NUMERIC;
  v_total_tokens BIGINT;
  v_active_users INT;
  v_errors_today INT;
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
  -- Counting distinct users who generated logs
  SELECT COUNT(DISTINCT user_id)
  INTO v_active_users
  FROM public.logs_consumo
  WHERE created_at >= (NOW() - INTERVAL '24 hours');

  -- Errors Today
  SELECT COUNT(*)
  INTO v_errors_today
  FROM public.logs_consumo
  WHERE status != 'success' AND created_at >= CURRENT_DATE;
  
  RETURN json_build_object(
    'active_users_24h', v_active_users,
    'total_cost_current_month', v_total_cost,
    'total_tokens_current_month', v_total_tokens,
    'errors_today', v_errors_today
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RLS Policies
-- Enable RLS
ALTER TABLE public.logs_consumo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_treinamento ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view ALL consumption logs
-- Drop first to allow clean re-run
DROP POLICY IF EXISTS "Admins can view all consumption logs" ON public.logs_consumo;
CREATE POLICY "Admins can view all consumption logs"
ON public.logs_consumo FOR SELECT
TO authenticated
USING (public.is_admin());

-- Policy: Admins can view ALL training logs
DROP POLICY IF EXISTS "Admins can view all training logs" ON public.logs_treinamento;
CREATE POLICY "Admins can view all training logs"
ON public.logs_treinamento FOR SELECT
TO authenticated
USING (public.is_admin());
