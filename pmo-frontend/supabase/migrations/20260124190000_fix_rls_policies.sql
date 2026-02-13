BEGIN;

--------------------------------------------------------------------------------
-- 1. Special Policy for "public"."user"
-- Restrict access to own data only
--------------------------------------------------------------------------------

ALTER TABLE IF EXISTS "public"."user" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access their own data" ON "public"."user";

CREATE POLICY "Users can only access their own data" ON "public"."user"
AS PERMISSIVE FOR ALL
TO authenticated
USING (auth.uid()::text = id::text)
WITH CHECK (auth.uid()::text = id::text);


--------------------------------------------------------------------------------
-- 2. Permissive Policy for Workflow/System Tables
-- Allow full access to authenticated users (internal workflow usage)
--------------------------------------------------------------------------------

-- Helper block to apply policy to multiple tables
DO $$
DECLARE
    -- List of tables to apply the permissive policy
    tables text[] := ARRAY[
        'annotation_tag_entity',
        'auth_identity',
        'auth_provider_sync_history',
        'credentials_entity',
        'event_destinations',
        'execution_annotation_tags',
        'execution_annotations',
        'execution_data',
        'execution_entity',
        'execution_metadata',
        'folder',
        'folder_tag',
        'installed_nodes',
        'installed_packages',
        'invalid_auth_token',
        'migrations',
        'project',
        'project_relation',
        'settings',
        'shared_credentials',
        'shared_workflow',
        'tag_entity',
        'test_case_execution',
        'test_run',
        'user_api_keys',
        'variables',
        'webhook_entity',
        'workflow_entity',
        'workflow_history',
        'workflow_statistics',
        'workflows_tags'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists to avoid errors
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- Enable RLS
            EXECUTE format('ALTER TABLE "public".%I ENABLE ROW LEVEL SECURITY;', t);
            
            -- Drop existing policy
            EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public".%I;', t);
            
            -- Create new policy
            EXECUTE format('
                CREATE POLICY "Enable all access for authenticated users" ON "public".%I
                AS PERMISSIVE FOR ALL
                TO authenticated
                USING (true)
                WITH CHECK (true);
            ', t);
            
        END IF;
    END LOOP;
END $$;

COMMIT;
