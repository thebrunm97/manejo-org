-- Migration: Harden RLS Policies
-- Reason: Fix 'RLS Policy Always True' warnings by applying granular access control
-- Date: 2026-01-24

--------------------------------------------------------------------------------
-- 1. System/Admin Tables (Write restricted to Admins, Read Authenticated)
--------------------------------------------------------------------------------
DO $$
DECLARE
    -- Tables that should be Read-Only for regular users, Write for Admins
    admin_tables text[] := ARRAY[
        'installed_nodes',
        'installed_packages',
        'migrations',
        'settings',
        'invalid_auth_token',
        'event_destinations'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY admin_tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- Drop permissive policy
            EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public".%I;', t);
            
            -- 1. Read Policy (All Authenticated)
            EXECUTE format('DROP POLICY IF EXISTS "Allow read for all authenticated" ON "public".%I;', t);
            EXECUTE format('
                CREATE POLICY "Allow read for all authenticated" ON "public".%I
                FOR SELECT TO authenticated
                USING (true);
            ', t);

            -- 2. Write Policy (Admin Only)
            -- Uses public.is_admin() which is confirmed to exist
            EXECUTE format('DROP POLICY IF EXISTS "Allow write for admins only" ON "public".%I;', t);
            EXECUTE format('
                CREATE POLICY "Allow write for admins only" ON "public".%I
                FOR ALL TO authenticated
                USING ( public.is_admin() ) 
                WITH CHECK ( public.is_admin() );
            ', t);
            
        END IF;
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 2. User Data Tables (Write restricted to Owner)
--------------------------------------------------------------------------------

-- A. Caderno Campo (Has user_id)
DROP POLICY IF EXISTS "Pertimir Updates" ON "public"."caderno_campo";
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."caderno_campo";

CREATE POLICY "Caderno Campo Access" ON "public"."caderno_campo"
TO authenticated
USING (user_id::text = auth.uid()::text)
WITH CHECK (user_id::text = auth.uid()::text);


-- B. User API Keys (Has userId)
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."user_api_keys";

CREATE POLICY "API Keys Access" ON "public"."user_api_keys"
TO authenticated
USING ("userId"::text = auth.uid()::text)
WITH CHECK ("userId"::text = auth.uid()::text);


--------------------------------------------------------------------------------
-- 3. Execution Data (Restrict DELETE to Admin/No-one)
-- High volume tables, keeping permissive Insert/Update for Workflow Engine 
-- but preventing mass deletion by random users.
--------------------------------------------------------------------------------
DO $$
DECLARE
    exec_tables text[] := ARRAY[
        'execution_data',
        'execution_entity',
        'execution_metadata',
        'execution_annotations',
        'execution_annotation_tags',
        'webhook_entity',
        'workflow_history',
        'workflow_statistics'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY exec_tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- Remove permissive ALL policy
            EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public".%I;', t);
            
            -- 1. Allow SELECT/INSERT/UPDATE (Permissive for workflow engine operation)
            EXECUTE format('
                CREATE POLICY "Allow operational access" ON "public".%I
                FOR ALL -- Covers Select, Insert, Update
                TO authenticated
                USING (true)
                WITH CHECK (true);
            ', t);

            -- 2. Explicitly DENY DELETE (via RLS: simply don't include it or make it false)
            -- PostgreSQL RLS: If a command type is included in ALL, it matches.
            -- To restrict DELETE, we must define specific policies instead of ALL.
            
            -- Re-do strategy: Separate policies
            EXECUTE format('DROP POLICY IF EXISTS "Allow operational access" ON "public".%I;', t);
            
            -- Read/Write
            EXECUTE format('
                CREATE POLICY "Allow Read/Write" ON "public".%I
                FOR SELECT TO authenticated USING (true);
            ', t);
            EXECUTE format('
                CREATE POLICY "Allow Insert/Update" ON "public".%I
                FOR INSERT TO authenticated WITH CHECK (true);
            ', t);
             EXECUTE format('
                CREATE POLICY "Allow Update" ON "public".%I
                FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
            ', t);
            
            -- DELETE: Only admins (or nobody, forcing logic to service_role)
            EXECUTE format('
                CREATE POLICY "Block Delete unless Admin" ON "public".%I
                FOR DELETE TO authenticated
                USING ( (SELECT current_setting(''role'') = ''service_role'') );
            ', t);

        END IF;
    END LOOP;
END $$;
