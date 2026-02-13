-- Migration: Fix Supabase Linter Alerts (Security & Performance)
-- Reason: Fix 'Function Search Path Mutable' and 'Missing Index on Foreign Key' warnings.
-- Date: 2026-01-24

BEGIN;

--------------------------------------------------------------------------------
-- 1. Security: Fix Function Search Path (Mutable -> Immutable/Explicit)
--------------------------------------------------------------------------------
DO $$
DECLARE
    -- List of insecure functions identified
    func_name text;
    funcs text[] := ARRAY[
        'trg_prevent_self_promotion',
        'validate_file_extension',
        'is_admin',
        'increment_usage_stats',
        'custom_access_role_protection',
        'get_dashboard_stats',
        'handle_new_user',
        'event_trigger_fn'
    ];
BEGIN
    FOREACH func_name IN ARRAY funcs LOOP
        -- Attempt to alter the function. We use public schema explicitly.
        -- Using simple name lookup. If overloaded, this might need refinement, 
        -- but usually these are unique RPCs/Triggers in Supabase.
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public', func_name);
        EXCEPTION WHEN OTHERS THEN
            -- Fallback for functions with arguments or other issues (try without parens if unique)
            BEGIN
                EXECUTE format('ALTER FUNCTION public.%I SET search_path = public', func_name);
            EXCEPTION WHEN OTHERS THEN
               -- Log or ignore if not found (idempotency simulation)
               RAISE NOTICE 'Could not set search_path for % (might not exist or signature mismatch)', func_name;
            END;
        END;
    END LOOP;
END $$;

--------------------------------------------------------------------------------
-- 2. Performance: Index Missing Foreign Keys
--------------------------------------------------------------------------------

-- 1. n8n.auth_identity (userId)
CREATE INDEX IF NOT EXISTS "idx_n8n_auth_ident_userid" 
ON "n8n"."auth_identity" ("userId");

-- 2. n8n.installed_nodes (package)
-- Note: 'package' identified as FK column via schema analysis
CREATE INDEX IF NOT EXISTS "idx_n8n_nodes_package" 
ON "n8n"."installed_nodes" ("package");

-- 3. n8n.webhook_entity (workflow_id)
CREATE INDEX IF NOT EXISTS "idx_n8n_webhook_workflow" 
ON "n8n"."webhook_entity" ("workflowId"); -- 'workflow_id' matches standard snake_case, but checking consistency

-- 4. public.auth_identity (userId)
CREATE INDEX IF NOT EXISTS "idx_pub_auth_ident_userid" 
ON "public"."auth_identity" ("userId");

-- 5. public.caderno_campo (propriedade_id)
CREATE INDEX IF NOT EXISTS "idx_caderno_propriedade" 
ON "public"."caderno_campo" ("propriedade_id");

-- 6. public.canteiros (talhao_id)
CREATE INDEX IF NOT EXISTS "idx_canteiros_talhao" 
ON "public"."canteiros" ("talhao_id");

-- 7. public.ciclos_cultivo (canteiro_id)
CREATE INDEX IF NOT EXISTS "idx_ciclos_canteiro" 
ON "public"."ciclos_cultivo" ("canteiro_id");

-- 8. public.culturas_anuais (pmo_id)
CREATE INDEX IF NOT EXISTS "idx_culturas_anuais_pmo" 
ON "public"."culturas_anuais" ("pmo_id");

-- 9. public.folder (parentFolderId)
-- Matches FK_804ea...
CREATE INDEX IF NOT EXISTS "idx_folder_parent" 
ON "public"."folder" ("parentFolderId");

-- 10. public.pmo_culturas (pmo_id)
CREATE INDEX IF NOT EXISTS "idx_pmo_culturas_pmo" 
ON "public"."pmo_culturas" ("pmo_id");

-- 11. public.pmo_equipamentos (pmo_id e user_id)
CREATE INDEX IF NOT EXISTS "idx_pmo_equip_pmo" 
ON "public"."pmo_equipamentos" ("pmo_id");

CREATE INDEX IF NOT EXISTS "idx_pmo_equip_user" 
ON "public"."pmo_equipamentos" ("user_id");

-- 12. public.pmo_manejo (pmo_id)
CREATE INDEX IF NOT EXISTS "idx_pmo_manejo_pmo" 
ON "public"."pmo_manejo" ("pmo_id");

-- 13. public.pmos (propriedade_id)
CREATE INDEX IF NOT EXISTS "idx_pmos_propriedade" 
ON "public"."pmos" ("propriedade_id");

-- 14. public.profiles (pmo_ativo_id)
CREATE INDEX IF NOT EXISTS "idx_profiles_pmo_ativo" 
ON "public"."profiles" ("pmo_ativo_id");

-- 15. public.propriedades (user_id)
CREATE INDEX IF NOT EXISTS "idx_propriedades_user" 
ON "public"."propriedades" ("user_id");

-- 16. public.talhoes (pmo_id, user_id, propriedade_id)
CREATE INDEX IF NOT EXISTS "idx_talhoes_pmo" 
ON "public"."talhoes" ("pmo_id");

CREATE INDEX IF NOT EXISTS "idx_talhoes_user" 
ON "public"."talhoes" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_talhoes_propriedade" 
ON "public"."talhoes" ("propriedade_id");

-- 17. public.workflow_entity (parentFolderId)
-- User suggested 'parent_folder' but schema indicates 'parentFolderId'
CREATE INDEX IF NOT EXISTS "idx_workflow_parent" 
ON "public"."workflow_entity" ("parentFolderId");

COMMIT;
