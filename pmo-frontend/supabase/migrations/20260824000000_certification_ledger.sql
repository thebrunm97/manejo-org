-- 20260824000000_certification_ledger.sql
-- DT-42: Ledger de rastreabilidade (hash-chain) para evidencias de certificacao organica.
-- NAO aplicado ainda - draft para revisao antes de rodar via Supabase MCP/CLI.
--
-- Design: append-only + hash-chain por cadeia (propriedade_id / talhao_id),
-- sem infra distribuida. As garantias que importam aqui sao imutabilidade e
-- auditabilidade, nao consenso entre partes desconfiadas - por isso Postgres
-- com triggers + locks + REVOKE cobre o caso sem custo de rodar nos/consenso.
--
-- v2: revisado apos review externo. Mudancas em relacao ao v1:
--   1. Trigger agora usa pg_advisory_xact_lock antes de ler o ultimo hash,
--      para impedir corrida entre INSERTs concorrentes na mesma cadeia
--      (o UNIQUE(propriedade_id, chain_seq) continua como rede de seguranca,
--      nao como mecanismo primario de serializacao).
--   2. O hash agora inclui explicitamente o identificador da cadeia e o
--      tipo_evento, separados por um delimitador (chr(31)), e o texto e
--      convertido para bytea via convert_to(...,'UTF8') antes do digest -
--      evita ambiguidade de concatenacao e comportamento dependente de encoding.
--   3. "Imutabilidade" reformulada: trigger de bloqueio + REVOKE UPDATE/DELETE
--      das roles de aplicacao (authenticated, service_role). Isso NAO protege
--      contra o dono da tabela/superusuario desabilitando triggers via DDL -
--      esse cenario fica fora do threat model da aplicacao e exige auditoria
--      de acesso administrativo ao Postgres, nao um controle de schema.
--   4. fn_verify_certification_chain agora e SECURITY DEFINER com search_path
--      fixo, valida que o chamador tem acesso a propriedade (dono ou admin),
--      e detecta lacunas/duplicatas em chain_seq alem de hash divergente.
--   5. origem_mensagem_id agora e FK real para public.messages com
--      ON DELETE RESTRICT: uma mensagem referenciada por um certification_record
--      fisicamente nao pode ser apagada pelo job de TTL de 7/90 dias, o que
--      implementa no banco a regra do LGPD_GUIDELINES.md de que evidencia
--      "herda" retencao de 3 anos. O hash da cadeia nunca inclui conteudo
--      sujeito a TTL (audio bruto, payload de webhook) - so o fato estruturado
--      (payload) e o dado sensivel-mas-permanente (geometria) - entao o TTL
--      nao pode quebrar a verificacao de integridade da cadeia.

-- 1. Certification Records (o "livro-razao" de fatos estruturados)
CREATE TABLE IF NOT EXISTS public.certification_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    propriedade_id bigint NOT NULL REFERENCES public.propriedades(id) ON DELETE RESTRICT,
    talhao_id bigint REFERENCES public.talhoes(id) ON DELETE RESTRICT,
    pmo_id bigint REFERENCES public.pmos(id) ON DELETE RESTRICT,
    tipo_evento text NOT NULL CHECK (tipo_evento IN (
        'COLHEITA', 'APLICACAO_INSUMO', 'VENDA', 'INSPECAO', 'MANEJO', 'OUTRO'
    )),
    payload jsonb NOT NULL,                 -- fato estruturado (quantidade, insumo, etc.) - NAO sujeito a TTL
    origem_mensagem_id uuid REFERENCES public.messages(id) ON DELETE RESTRICT, -- trilha de auditoria; RESTRICT forca a mensagem a sobreviver enquanto o registro existir
    responsavel_user_id uuid NOT NULL REFERENCES auth.users(id),
    data_fato timestamptz NOT NULL DEFAULT now(),
    chain_seq bigint NOT NULL,              -- sequencia dentro da cadeia (por propriedade_id)
    prev_hash text,                         -- hash do registro anterior na mesma cadeia (null no genesis)
    hash text NOT NULL,                     -- sha256(prev_hash | propriedade_id | tipo_evento | payload | data_fato | chain_seq)
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (propriedade_id, chain_seq)
);

CREATE INDEX idx_certification_records_propriedade ON public.certification_records(propriedade_id, chain_seq);
CREATE INDEX idx_certification_records_talhao ON public.certification_records(talhao_id);
CREATE INDEX idx_certification_records_pmo ON public.certification_records(pmo_id);
CREATE INDEX idx_certification_records_origem_msg ON public.certification_records(origem_mensagem_id);

-- 2. Plot Geometry Versions (versionamento de poligonos, mesma logica de cadeia por talhao)
-- Nao ha extensao PostGIS instalada neste projeto (ver 20260330_bootstrap_extensions_and_types.sql),
-- entao geometria e GeoJSON em jsonb. jsonb normaliza ordem/duplicacao de chaves na gravacao,
-- mas NAO normaliza precisao numerica de coordenadas - a aplicacao (Go) deve arredondar
-- coordenadas para uma precisao fixa antes de inserir, senao a mesma geometria "visual"
-- pode gerar hashes diferentes entre inserts.
CREATE TABLE IF NOT EXISTS public.plot_geometry_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    talhao_id bigint NOT NULL REFERENCES public.talhoes(id) ON DELETE RESTRICT,
    geometria jsonb NOT NULL,               -- GeoJSON do poligono nesta versao, coordenadas com precisao fixa
    vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
    vigente_ate date,                       -- null = versao vigente
    chain_seq bigint NOT NULL,              -- sequencia dentro da cadeia (por talhao_id)
    prev_hash text,
    hash text NOT NULL,
    responsavel_user_id uuid NOT NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (talhao_id, chain_seq)
);

CREATE INDEX idx_plot_geometry_versions_talhao ON public.plot_geometry_versions(talhao_id, chain_seq);

-- 3. Funcao de hash-chain generica: calcula prev_hash/chain_seq/hash antes do INSERT.
-- Quem grava o hash e SEMPRE o banco, nunca a aplicacao, para que a cadeia nao
-- possa ser forjada por um bug/bypass no Go.
--
-- Serializacao: pg_advisory_xact_lock e tomado ANTES do SELECT do ultimo hash,
-- usando uma chave que combina nome da tabela + id da cadeia. Isso impede que
-- duas transacoes concorrentes leiam o mesmo "ultimo hash" e gerem ramificacoes.
-- O lock e liberado automaticamente no commit/rollback da transacao.
-- O UNIQUE(propriedade_id/talhao_id, chain_seq) continua existindo como rede
-- de seguranca caso o lock seja contornado por algum caminho nao previsto.
CREATE OR REPLACE FUNCTION public.fn_certification_chain_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_prev_hash text;
    v_prev_seq bigint;
    v_group_val bigint;
    v_lock_key bigint;
    v_hash_input text;
BEGIN
    IF TG_TABLE_NAME = 'certification_records' THEN
        v_group_val := NEW.propriedade_id;
        v_lock_key := hashtextextended(TG_TABLE_NAME || ':' || v_group_val::text, 0);
        PERFORM pg_advisory_xact_lock(v_lock_key);

        SELECT chain_seq, hash INTO v_prev_seq, v_prev_hash
        FROM public.certification_records
        WHERE propriedade_id = v_group_val
        ORDER BY chain_seq DESC
        LIMIT 1;

        NEW.chain_seq := COALESCE(v_prev_seq, 0) + 1;
        NEW.prev_hash := v_prev_hash;

        v_hash_input := COALESCE(v_prev_hash, '') || chr(31)
            || v_group_val::text || chr(31)
            || NEW.tipo_evento || chr(31)
            || NEW.payload::text || chr(31)
            || NEW.data_fato::text || chr(31)
            || NEW.chain_seq::text;

        NEW.hash := encode(extensions.digest(convert_to(v_hash_input, 'UTF8'), 'sha256'), 'hex');

    ELSIF TG_TABLE_NAME = 'plot_geometry_versions' THEN
        v_group_val := NEW.talhao_id;
        v_lock_key := hashtextextended(TG_TABLE_NAME || ':' || v_group_val::text, 0);
        PERFORM pg_advisory_xact_lock(v_lock_key);

        SELECT chain_seq, hash INTO v_prev_seq, v_prev_hash
        FROM public.plot_geometry_versions
        WHERE talhao_id = v_group_val
        ORDER BY chain_seq DESC
        LIMIT 1;

        NEW.chain_seq := COALESCE(v_prev_seq, 0) + 1;
        NEW.prev_hash := v_prev_hash;

        v_hash_input := COALESCE(v_prev_hash, '') || chr(31)
            || v_group_val::text || chr(31)
            || NEW.geometria::text || chr(31)
            || NEW.vigente_desde::text || chr(31)
            || NEW.chain_seq::text;

        NEW.hash := encode(extensions.digest(convert_to(v_hash_input, 'UTF8'), 'sha256'), 'hex');
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_certification_records_chain
    BEFORE INSERT ON public.certification_records
    FOR EACH ROW EXECUTE FUNCTION public.fn_certification_chain_hash();

CREATE TRIGGER trg_plot_geometry_versions_chain
    BEFORE INSERT ON public.plot_geometry_versions
    FOR EACH ROW EXECUTE FUNCTION public.fn_certification_chain_hash();

-- 4. Imutabilidade em camadas. Correcoes viram um NOVO registro que referencia
-- o anterior via payload (ex: payload->>'corrige_id'), nunca um UPDATE.
--
-- Camadas: (a) trigger de bloqueio abaixo, que roda para qualquer role;
-- (b) REVOKE explicito de UPDATE/DELETE das roles de aplicacao, para que o
-- erro apareca como permission denied antes mesmo de disparar o trigger.
-- Isso NAO cobre o dono da tabela/superusuario alterando o schema (ex:
-- ALTER TABLE ... DISABLE TRIGGER) - esse acesso deve ser restrito e
-- auditado fora do escopo desta migration (ex: nao usar a connection string
-- de superusuario/postgres na aplicacao, apenas para migrations).
CREATE OR REPLACE FUNCTION public.fn_block_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Tabela % e append-only: % nao e permitido. Registre uma correcao como novo evento.',
        TG_TABLE_NAME, TG_OP;
END;
$$;

CREATE TRIGGER trg_certification_records_no_update
    BEFORE UPDATE OR DELETE ON public.certification_records
    FOR EACH ROW EXECUTE FUNCTION public.fn_block_ledger_mutation();

CREATE TRIGGER trg_plot_geometry_versions_no_update
    BEFORE UPDATE OR DELETE ON public.plot_geometry_versions
    FOR EACH ROW EXECUTE FUNCTION public.fn_block_ledger_mutation();

REVOKE UPDATE, DELETE ON public.certification_records FROM authenticated, service_role;
REVOKE UPDATE, DELETE ON public.plot_geometry_versions FROM authenticated, service_role;

-- 5. RLS: leitura por vinculo com a propriedade/talhao do usuario; escrita
-- apenas via INSERT (UPDATE/DELETE ja bloqueados nas camadas acima).
ALTER TABLE public.certification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plot_geometry_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem registros de suas propriedades"
ON public.certification_records FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.propriedades p
        WHERE p.id = propriedade_id AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Usuarios inserem registros em suas propriedades"
ON public.certification_records FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.propriedades p
        WHERE p.id = propriedade_id AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Usuarios veem versoes de geometria de seus talhoes"
ON public.plot_geometry_versions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.talhoes t
        JOIN public.propriedades p ON p.id = t.propriedade_id
        WHERE t.id = talhao_id AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Usuarios inserem versoes de geometria de seus talhoes"
ON public.plot_geometry_versions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.talhoes t
        JOIN public.propriedades p ON p.id = t.propriedade_id
        WHERE t.id = talhao_id AND p.user_id = auth.uid()
    )
);

-- 6. Funcoes de auditoria: recalculam a cadeia inteira e apontam o primeiro
-- elo invalido (hash divergente, prev_hash divergente, ou lacuna/duplicata
-- em chain_seq). SECURITY DEFINER com search_path fixo (evita hijack via
-- search_path da sessao); o proprio chamador precisa ser dono da propriedade
-- ou admin - a funcao nao deve permitir auditar propriedade alheia.
CREATE OR REPLACE FUNCTION public.fn_verify_certification_chain(p_propriedade_id bigint)
RETURNS TABLE (
    id uuid,
    chain_seq bigint,
    hash_armazenado text,
    hash_recalculado text,
    prev_hash_esperado text,
    sequencia_continua boolean,
    valido boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.propriedades p WHERE p.id = p_propriedade_id AND p.user_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado a propriedade %', p_propriedade_id;
    END IF;

    RETURN QUERY
    WITH ordenado AS (
        SELECT
            cr.id,
            cr.chain_seq,
            cr.prev_hash,
            cr.hash,
            row_number() OVER (ORDER BY cr.chain_seq) AS posicao_esperada,
            lag(cr.hash) OVER (ORDER BY cr.chain_seq) AS hash_anterior_real,
            encode(
                extensions.digest(
                    convert_to(
                        COALESCE(lag(cr.hash) OVER (ORDER BY cr.chain_seq), '') || chr(31)
                            || p_propriedade_id::text || chr(31)
                            || cr.tipo_evento || chr(31)
                            || cr.payload::text || chr(31)
                            || cr.data_fato::text || chr(31)
                            || cr.chain_seq::text,
                        'UTF8'
                    ),
                    'sha256'
                ),
                'hex'
            ) AS hash_recalculado
        FROM public.certification_records cr
        WHERE cr.propriedade_id = p_propriedade_id
    )
    SELECT
        o.id,
        o.chain_seq,
        o.hash,
        o.hash_recalculado,
        o.hash_anterior_real,
        (o.chain_seq = o.posicao_esperada) AS sequencia_continua,
        (
            o.hash = o.hash_recalculado
            AND COALESCE(o.prev_hash, '') = COALESCE(o.hash_anterior_real, '')
            AND o.chain_seq = o.posicao_esperada
        ) AS valido
    FROM ordenado o
    ORDER BY o.chain_seq;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_verify_plot_geometry_chain(p_talhao_id bigint)
RETURNS TABLE (
    id uuid,
    chain_seq bigint,
    hash_armazenado text,
    hash_recalculado text,
    prev_hash_esperado text,
    sequencia_continua boolean,
    valido boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, extensions, public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.talhoes t
        JOIN public.propriedades p ON p.id = t.propriedade_id
        WHERE t.id = p_talhao_id AND p.user_id = auth.uid()
    ) AND NOT EXISTS (
        SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado ao talhao %', p_talhao_id;
    END IF;

    RETURN QUERY
    WITH ordenado AS (
        SELECT
            pg.id,
            pg.chain_seq,
            pg.prev_hash,
            pg.hash,
            row_number() OVER (ORDER BY pg.chain_seq) AS posicao_esperada,
            lag(pg.hash) OVER (ORDER BY pg.chain_seq) AS hash_anterior_real,
            encode(
                extensions.digest(
                    convert_to(
                        COALESCE(lag(pg.hash) OVER (ORDER BY pg.chain_seq), '') || chr(31)
                            || p_talhao_id::text || chr(31)
                            || pg.geometria::text || chr(31)
                            || pg.vigente_desde::text || chr(31)
                            || pg.chain_seq::text,
                        'UTF8'
                    ),
                    'sha256'
                ),
                'hex'
            ) AS hash_recalculado
        FROM public.plot_geometry_versions pg
        WHERE pg.talhao_id = p_talhao_id
    )
    SELECT
        o.id,
        o.chain_seq,
        o.hash,
        o.hash_recalculado,
        o.hash_anterior_real,
        (o.chain_seq = o.posicao_esperada) AS sequencia_continua,
        (
            o.hash = o.hash_recalculado
            AND COALESCE(o.prev_hash, '') = COALESCE(o.hash_anterior_real, '')
            AND o.chain_seq = o.posicao_esperada
        ) AS valido
    FROM ordenado o
    ORDER BY o.chain_seq;
END;
$$;
