-- Tabela `invalid_auth_token` do n8n (DT-21).
--
-- Continuacao de 20260402060000_create_thirdparty_tables.sql, que versionou as
-- tabelas do n8n com a justificativa: "These tables are managed by external
-- services and were never versioned." Aquele arquivo cobriu `migrations`,
-- `settings`, `installed_nodes`, `workflow_history` e companhia, mas foi escrito
-- em abril; o n8n adicionou esta depois, e ela ficou so na producao.
--
-- POR QUE ELA VAI EM ARQUIVO SEPARADO
--
-- Nao e tabela da aplicacao. A coluna "expiresAt" em camelCase entre aspas e
-- convencao do TypeORM, o ORM do n8n — o schema da aplicacao usa snake_case sem
-- excecao. Misturar infraestrutura de terceiro com as funcoes de negocio no
-- mesmo arquivo tornaria mais dificil, depois, decidir o que e nosso.
--
-- IMPLICACAO PRATICA: o n8n gerencia esta tabela pelo proprio sistema de
-- migrations. Se as versoes do n8n divergirem entre os ambientes, a divergencia
-- volta, e nao ha nada que este arquivo possa fazer a respeito. Ele so garante
-- que o ponto de partida seja o mesmo.

BEGIN;

CREATE TABLE IF NOT EXISTS public.invalid_auth_token (
    token       character varying(512) NOT NULL,
    "expiresAt" timestamp(3) with time zone NOT NULL,
    CONSTRAINT invalid_auth_token_pkey PRIMARY KEY (token)
);

COMMENT ON TABLE public.invalid_auth_token IS
    'Tabela do n8n (nao da aplicacao). Gerenciada pelas migrations do proprio '
    'n8n; versionada aqui apenas para que producao e staging partam do mesmo '
    'ponto. Ver 20260402060000_create_thirdparty_tables.sql.';

ALTER TABLE public.invalid_auth_token ENABLE ROW LEVEL SECURITY;

-- Policies copiadas da producao sem alteracao.
DROP POLICY IF EXISTS "Allow read for all authenticated" ON public.invalid_auth_token;
CREATE POLICY "Allow read for all authenticated"
    ON public.invalid_auth_token FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow write for admins only" ON public.invalid_auth_token;
CREATE POLICY "Allow write for admins only"
    ON public.invalid_auth_token FOR ALL TO authenticated
    USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT, REFERENCES, TRIGGER ON public.invalid_auth_token TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON public.invalid_auth_token TO authenticated;
GRANT ALL ON public.invalid_auth_token TO service_role;

COMMIT;
