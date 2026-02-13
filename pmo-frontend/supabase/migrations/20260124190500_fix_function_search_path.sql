-- Migration: Fix Function Search Path Vulnerability
-- Reason: Set search_path to 'public, pg_temp' for security (prevent hijacking)
-- Date: 2026-01-24

DO $$
DECLARE
    row record;
BEGIN
    FOR row IN 
        SELECT oid::regprocedure::text as func_signature
        FROM pg_proc
        WHERE proname IN (
            'trg_prevent_self_promotion',
            'validate_file_extension',
            'is_admin',
            'increment_usage_stats',
            'custom_access_role_protection',
            'get_dashboard_stats',
            'handle_new_user',
            'event_trigger_fn'
        )
        AND pronamespace = 'public'::regnamespace
    LOOP
        RAISE NOTICE 'Securing function: %', row.func_signature;
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp;', row.func_signature);
    END LOOP;
END;
$$;
