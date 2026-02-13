
--------------------------------------------------------------------------------
-- 1. Project (Access via project_relation)
--------------------------------------------------------------------------------
-- Policy: Users can see projects they are members of
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."project";

CREATE POLICY "Users can access own projects" ON "public"."project"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
    id::text IN (
        SELECT "projectId"::text
        FROM "public"."project_relation" 
        WHERE "userId"::text = auth.uid()::text
    )
)
WITH CHECK (
    id::text IN (
        SELECT "projectId"::text
        FROM "public"."project_relation" 
        WHERE "userId"::text = auth.uid()::text
    )
);

--------------------------------------------------------------------------------
-- 2. Folder (Access via Project)
--------------------------------------------------------------------------------
-- Policy: Users can see folders of projects they belong to
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."folder";

CREATE POLICY "Users can access project folders" ON "public"."folder"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
    "projectId"::text IN (
        SELECT "projectId"::text
        FROM "public"."project_relation" 
        WHERE "userId"::text = auth.uid()::text
    )
)
WITH CHECK (
    "projectId"::text IN (
        SELECT "projectId"::text
        FROM "public"."project_relation" 
        WHERE "userId"::text = auth.uid()::text
    )
);

--------------------------------------------------------------------------------
-- 3. Workflow Entity (Access via shared_workflow -> project)
--------------------------------------------------------------------------------
-- Policy: Users can see workflows shared with their projects
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."workflow_entity";

CREATE POLICY "Users can access project workflows" ON "public"."workflow_entity"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
    id::text IN (
        SELECT "workflowId"::text 
        FROM "public"."shared_workflow" sw
        WHERE sw."projectId"::text IN (
            SELECT "projectId"::text 
            FROM "public"."project_relation" 
            WHERE "userId"::text = auth.uid()::text
        )
    )
)
WITH CHECK (
    id::text IN (
        SELECT "workflowId"::text 
        FROM "public"."shared_workflow" sw
        WHERE sw."projectId"::text IN (
            SELECT "projectId"::text 
            FROM "public"."project_relation" 
            WHERE "userId"::text = auth.uid()::text
        )
    )
);

--------------------------------------------------------------------------------
-- 4. Credentials Entity (Access via shared_credentials -> project)
--------------------------------------------------------------------------------
-- Policy: Users can see credentials shared with their projects
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON "public"."credentials_entity";

CREATE POLICY "Users can access project credentials" ON "public"."credentials_entity"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
    id::text IN (
        SELECT "credentialsId"::text 
        FROM "public"."shared_credentials" sc
        WHERE sc."projectId"::text IN (
            SELECT "projectId"::text 
            FROM "public"."project_relation" 
            WHERE "userId"::text = auth.uid()::text
        )
    )
)
WITH CHECK (
    id::text IN (
        SELECT "credentialsId"::text 
        FROM "public"."shared_credentials" sc
        WHERE sc."projectId"::text IN (
            SELECT "projectId"::text 
            FROM "public"."project_relation" 
            WHERE "userId"::text = auth.uid()::text
        )
    )
);
