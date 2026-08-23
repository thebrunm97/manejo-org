-- Versiona o schema que existia SOMENTE no banco de producao (DT-21).
--
-- POR QUE ESTE ARQUIVO EXISTE
--
-- Levantamento de 2026-08-23 comparando producao (hejewayflbuemnffrhae) e
-- staging (srboqpxrzejtxjfgodnc): 19 funcoes proprias e 3 tabelas existiam na
-- producao e em NENHUM arquivo de migration. Foram criadas direto no banco,
-- provavelmente pelo dashboard, e por isso nunca chegaram ao staging.
--
-- O efeito pratico era grave: sem `claim_next_message_job` o worker nao
-- consegue pegar job da fila, ou seja, O BOT NAO RODAVA CONTRA O STAGING.
-- Nenhuma mensagem seria processada. O staging servia para validar schema de
-- frontend, nao o pipeline.
--
-- Este arquivo transporta o que faltava, no sentido producao -> staging.
--
-- COPIA FIEL, DE PROPOSITO
--
-- As definicoes abaixo saem de `pg_get_functiondef()` da producao sem
-- modificacao, inclusive onde ha problema conhecido. Corrigir aqui faria o
-- staging deixar de refletir a producao, que e exatamente o defeito que este
-- arquivo existe para consertar. Ver DT-46 para o que precisa ser corrigido
-- DEPOIS, nos dois ambientes ao mesmo tempo.
--
-- O QUE FICOU DE FORA, E POR QUE
--
--   * `event_trigger_fn` — o corpo e literalmente "BEGIN -- Add logic here END".
--     Stub de tutorial ligado ao event trigger `event_trigger_name`. Versionar
--     institucionalizaria codigo morto. Ver DT-47.
--   * `custom_access_role_protection` — nenhum trigger ligado, e e duplicata
--     MAIS FRACA de `trg_prevent_self_promotion` (nao trata service_role).
--     Orfa. Ver DT-47.
--   * `invalid_auth_token` — tabela do n8n, nao da aplicacao (coluna "expiresAt"
--     em camelCase e convencao do TypeORM). Vai em arquivo proprio, seguindo o
--     precedente de 20260402060000_create_thirdparty_tables.sql.
--   * Os DADOS das tabelas — so o schema vai. farm_documents tem 1,1 MB de
--     documentos reais de produtores; replicar num segundo ambiente espalharia
--     dado pessoal, contra a direcao do DT-42.
--
-- ORDEM IMPORTA: as tabelas vem antes das funcoes que as referenciam.

BEGIN;

-- O tipo `vector` mora em schemas DIFERENTES nos dois bancos: `public` na
-- producao, `extensions` no staging. Como farm_documents e knowledge_chunks tem
-- colunas vector, e as funcoes match_* usam o operador <=>, sem isto o arquivo
-- falha no staging com "type vector does not exist".
SET LOCAL search_path = public, extensions;


-- ============================================================================
-- 1. TABELAS
-- ============================================================================
--
-- Nao sao opcionais. `match_chunks` referencia knowledge_chunks e
-- `match_documents_with_context` referencia farm_documents. Pior: o staging JA
-- TINHA `match_farm_documents` e `match_documents_with_context_1024`
-- referenciando essas tabelas ausentes — ou seja, ja tinha funcao que estourava
-- em runtime com "relation does not exist". Criar as tabelas conserta isso de
-- quebra.

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
    id            uuid    DEFAULT gen_random_uuid() NOT NULL,
    document_name text    NOT NULL,
    chunk_index   integer NOT NULL,
    content       text    NOT NULL,
    metadata      jsonb   DEFAULT '{}'::jsonb,
    embedding     vector(3072),
    CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id)
);

-- O indice usa halfvec: o pgvector limita HNSW a 2000 dimensoes em `vector`,
-- e o embedding tem 3072. O cast para halfvec(3072) contorna isso pela metade
-- da precisao — decisao ja tomada na producao, replicada aqui como esta.
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
    ON public.knowledge_chunks USING hnsw (((embedding)::halfvec(3072)) halfvec_cosine_ops);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON public.knowledge_chunks;
CREATE POLICY "Allow authenticated read"
    ON public.knowledge_chunks FOR SELECT TO authenticated USING (true);

GRANT SELECT, REFERENCES, TRIGGER ON public.knowledge_chunks TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON public.knowledge_chunks TO authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;


CREATE TABLE IF NOT EXISTS public.farm_documents (
    -- bigserial, e nao IDENTITY: a producao usa
    -- DEFAULT nextval('farm_documents_id_seq'::regclass), e bigserial recria a
    -- sequencia com exatamente esse nome. IDENTITY seria equivalente na pratica
    -- mas divergiria no catalogo, que e o que estamos tentando alinhar.
    id                 bigserial,
    pmo_id             bigint,
    document_name      text NOT NULL,
    content            text NOT NULL,
    embedding          vector(3072),
    embedding_1024     vector(1024),
    chunk_hash         character varying(64),
    chunk_index        integer,
    source_document_id character varying(255),
    CONSTRAINT farm_documents_pkey PRIMARY KEY (id),
    CONSTRAINT farm_documents_chunk_hash_key UNIQUE (chunk_hash)
);

-- Duas colunas de embedding convivem: `embedding` (3072d, Gemini legado) e
-- `embedding_1024`, da migracao do DT do backfill 1024d. O indice HNSW existe
-- so sobre a legada — assimetria da producao, preservada aqui.
CREATE INDEX IF NOT EXISTS farm_documents_embedding_idx
    ON public.farm_documents USING hnsw (((embedding)::halfvec(3072)) halfvec_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_farm_documents_doc_chunk
    ON public.farm_documents USING btree (source_document_id, chunk_index);

-- ATENCAO: RLS LIGADO E ZERO POLICIES, exatamente como na producao. O efeito e
-- que anon e authenticated nao leem NADA desta tabela apesar do GRANT SELECT
-- abaixo; na pratica so service_role (que ignora RLS) enxerga. Nao e descuido
-- desta migration — e o estado real da producao, replicado de proposito. Se
-- isso for engano, corrigir nos DOIS ambientes junto (ver DT-46).
ALTER TABLE public.farm_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, REFERENCES, TRIGGER ON public.farm_documents TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON public.farm_documents TO authenticated;
GRANT ALL ON public.farm_documents TO service_role;


-- ============================================================================
-- 2. FUNCOES
-- ============================================================================
--
-- Extraidas com pg_get_functiondef() da producao. Unica alteracao: as quebras
-- de linha CRLF do corpo de algumas funcoes foram normalizadas para LF, o que
-- muda o md5 da definicao mas nao o comportamento. Comparar os ambientes por
-- ASSINATURA (proname + argumentos), nao por hash do texto.
--
-- ATENCAO AS SOBRECARGAS: criar_infraestrutura_pmo tem 3 e match_chunks tem 3.
-- Extrair por nome em vez de por oid perderia quatro delas em silencio.

-- ── Fila e manutencao ───────────────────────────────────────────────────────

-- O item mais critico do arquivo. Sem esta funcao o AIWorker nao pega job da
-- fila e NENHUMA mensagem e processada — era a razao de o bot nao rodar contra
-- o staging. FOR UPDATE SKIP LOCKED e o que permite varios workers em paralelo
-- sem pegarem o mesmo job.
CREATE OR REPLACE FUNCTION public.claim_next_message_job(p_from_status text, p_target_status text, p_worker_id text)
 RETURNS SETOF message_queue
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  UPDATE message_queue
  SET status = p_target_status,
      claimed_at = NOW()
  WHERE id = (
    SELECT id FROM message_queue
    WHERE status = p_from_status
      AND next_retry_at <= NOW()
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING *;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_guardrail_events()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM guardrail_events
    WHERE created_at < NOW() - INTERVAL '90 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE LOG '[guardrail_events] Cleanup: % events removed (>90 days)', deleted_count;
    RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_message_queue()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM message_queue
    WHERE status = 'done'
      AND processed_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE LOG '[message_queue] Limpeza automática: % jobs removidos (done + 7 dias)', deleted_count;
    RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.expire_hitl_pending()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE hitl_pending
    SET status     = 'expired',
        updated_at = NOW()
    WHERE status     = 'waiting'
      AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    IF expired_count > 0 THEN
        RAISE LOG '[hitl_pending] Marked % requests as expired', expired_count;
    END IF;

    RETURN expired_count;
END;
$function$;

-- ── Guardrails ──────────────────────────────────────────────────────────────

-- NOTA: marcada IMMUTABLE mas chama unaccent(), que e STABLE. Um indice
-- funcional sobre esta funcao poderia ficar inconsistente se o dicionario do
-- unaccent mudasse. E o estado da producao; nao corrigido aqui de proposito
-- (ver DT-46), porque alterar a volatilidade mudaria o plano de consultas em
-- so um dos ambientes.
CREATE OR REPLACE FUNCTION public.is_chemical_input(produto_nome text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    blacklist TEXT[] := ARRAY[
        'glifosato', 'roundup', '2,4-d', 'paraquat', 'atrazina',
        'clorpirifos', 'fipronil', 'imidacloprid',
        'ureia', 'npk', 'superfosfato', 'herbicida', 'veneno',
        'fungicida', 'inseticida', 'pesticida'
    ];
    produto_lower TEXT := lower(unaccent(produto_nome));
BEGIN
    -- Verifica se o nome do produto contém alguma palavra da blacklist
    FOR i IN 1..array_length(blacklist, 1) LOOP
        IF produto_lower LIKE '%' || blacklist[i] || '%' THEN
            RETURN TRUE;
        END IF;
    END LOOP;
    RETURN FALSE;
END;
$function$;

-- ── Protecao de papel ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_prevent_self_promotion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- ── Consultas de painel (SECURITY DEFINER) ──────────────────────────────────
--
-- AVISO TRANSVERSAL, VALIDO PARA ESTE BLOCO: destas, so get_admin_user_details
-- (checa is_admin) e get_recent_bot_activities (filtra por auth.uid()) fazem
-- alguma verificacao. As demais sao SECURITY DEFINER, tem EXECUTE para `anon`
-- e NAO checam nada — quem chamar recebe o dado. Copiadas como estao porque o
-- proposito deste arquivo e alinhar os ambientes, nao mudar comportamento em um
-- so deles. Corrigir e o DT-46, e precisa ser feito nos dois de uma vez.

CREATE OR REPLACE FUNCTION public.get_admin_user_details(target_user_id uuid)
 RETURNS TABLE(nome text, email character varying, plan_tier text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- NOTA: sem SET search_path, e SECURITY DEFINER. Combinacao classica de vetor de
-- escalada de privilegio (o chamador controla a resolucao de nomes). Preservada
-- identica a producao; ver DT-46.
CREATE OR REPLACE FUNCTION public.get_propriedade_metrics(p_propriedade_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_area_total numeric;
    v_total_talhoes integer;
    v_result jsonb;
BEGIN
    -- Calculate total area from active talhoes
    SELECT COALESCE(SUM(area_ha), 0), COUNT(id)
    INTO v_area_total, v_total_talhoes
    FROM public.talhoes
    WHERE propriedade_id = p_propriedade_id AND active = true;

    -- Construct result object
    v_result := jsonb_build_object(
        'area_total_ha', v_area_total,
        'total_talhoes', v_total_talhoes,
        'propriedade_id', p_propriedade_id
    );

    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_recent_bot_activities()
 RETURNS TABLE(id uuid, created_at timestamp with time zone, tipo text, descricao text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    (
        -- Interações do Bot (via PMO ownership)
        SELECT
            l.id,
            l.created_at,
            'Bot' as tipo,
            COALESCE(l.mensagem_usuario, 'Interação com Bot') as descricao
        FROM logs_processamento l
        JOIN pmos p ON l.pmo_id = p.id
        WHERE p.user_id = auth.uid()

        UNION ALL

        -- Registros do Caderno de Campo
        SELECT
            c.id,
            c.criado_em as created_at,
            'Campo' as tipo,
            COALESCE(c.tipo_atividade || ': ' || c.produto, 'Atividade Técnica') as descricao
        FROM caderno_campo c
        WHERE c.user_id = auth.uid()
    )
    ORDER BY created_at DESC
    LIMIT 3;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_usage_stats(p_user_id uuid, p_tokens integer, p_credits_cost integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE profiles
  SET
    total_tokens_used = COALESCE(total_tokens_used, 0) + p_tokens,
    daily_request_count = COALESCE(daily_request_count, 0) + p_credits_cost,
    last_usage_date = CASE
        WHEN last_usage_date != CURRENT_DATE THEN CURRENT_DATE
        ELSE last_usage_date
    END
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_file_extension(name text, allowed_extensions text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    file_extension text;
BEGIN
    -- Extract extension (case-insensitive, handles double extensions)
    file_extension := LOWER(
        SUBSTRING(name FROM '\.([^\.\/]+)$')
    );

    -- Check if extension is in the allowed list
    RETURN file_extension = ANY(allowed_extensions);
END;
$function$;

-- ── Busca vetorial ──────────────────────────────────────────────────────────
--
-- Nenhuma destas fixa search_path, e isso e DELIBERADO: elas precisam resolver
-- o tipo `vector` e o operador <=>, que vivem em schemas diferentes nos dois
-- ambientes (public na producao, extensions no staging). Herdar o search_path
-- do chamador e o que as faz funcionar nos dois. Fixar quebraria o staging.

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding halfvec, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, content text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    id,
    content,
    1 - (embedding::halfvec <=> query_embedding) AS similarity
  FROM knowledge_chunks
  WHERE 1 - (embedding::halfvec <=> query_embedding) > match_threshold
  ORDER BY embedding::halfvec <=> query_embedding
  LIMIT match_count;
$function$;

CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_count integer DEFAULT 5)
 RETURNS TABLE(id uuid, document_name text, content text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.document_name,
    k.content,
    k.metadata,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks k
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- ⚠️ ESTA SOBRECARGA ESTA QUEBRADA NA PRODUCAO, e vai junto assim mesmo.
--
-- Ela filtra por `k.pmo_id`, mas knowledge_chunks NAO TEM essa coluna (as
-- colunas sao id, document_name, chunk_index, content, metadata, embedding).
-- Como o corpo e plpgsql, o Postgres nao resolve nomes de coluna na criacao —
-- a funcao e criada sem reclamar e so estoura quando chamada, com
-- "column k.pmo_id does not exist".
--
-- Verificado na producao em 2026-08-23: a coluna nao existe la tambem. Ou seja,
-- nao e defeito introduzido por este arquivo; e defeito TRANSPORTADO, de
-- proposito, porque o objetivo aqui e que os ambientes fiquem iguais. Consertar
-- so no staging esconderia o problema no ambiente onde ele importa.
--
-- Registrado no DT-46. A correcao provavel e uma de duas: adicionar pmo_id a
-- knowledge_chunks (se o escopo por PMO era a intencao) ou remover a sobrecarga
-- (se ela foi substituida por match_documents_with_context, que faz o escopo
-- por PMO sobre farm_documents e de fato funciona).
CREATE OR REPLACE FUNCTION public.match_chunks(query_embedding vector, match_threshold double precision, match_count integer, pmo_id_filter bigint)
 RETURNS TABLE(id uuid, document_name text, content text, metadata jsonb, similarity double precision)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.document_name,
    k.content,
    k.metadata,
    (1 - ((k.embedding::halfvec(3072)) <=> (query_embedding::halfvec(3072))))::float AS similarity
  FROM knowledge_chunks k
  WHERE k.pmo_id = pmo_id_filter
    AND 1 - ((k.embedding::halfvec(3072)) <=> (query_embedding::halfvec(3072))) > match_threshold
  ORDER BY (k.embedding::halfvec(3072)) <=> (query_embedding::halfvec(3072))
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.match_documents_with_context(query_embedding vector, match_pmo_id bigint, match_threshold double precision, match_count integer, window_size integer DEFAULT 1)
 RETURNS TABLE(id bigint, pmo_id bigint, document_name text, content text, similarity double precision, is_global boolean, metadata jsonb, chunk_index integer, source_document_id character varying)
 LANGUAGE sql
AS $function$
WITH top_matches AS (
  -- 1. Encontra os 'match_count' chunks originais mais similares
  SELECT
    fd.id,
    fd.pmo_id,
    fd.source_document_id,
    fd.chunk_index,
    1 - (fd.embedding_1024 <=> query_embedding) AS similarity
  FROM farm_documents fd
  WHERE 1 - (fd.embedding_1024 <=> query_embedding) > match_threshold
    -- Se match_pmo_id for fornecido, filtra; senão busca apenas os nulos (globais)
    AND (match_pmo_id IS NULL OR fd.pmo_id = match_pmo_id OR fd.pmo_id IS NULL)
  ORDER BY fd.embedding_1024 <=> query_embedding
  LIMIT match_count
)
-- 2. Faz JOIN para trazer os chunks vizinhos do mesmo documento
SELECT DISTINCT ON (context_docs.source_document_id, context_docs.chunk_index)
  context_docs.id,
  context_docs.pmo_id,
  context_docs.document_name,
  context_docs.content,
  top_matches.similarity, -- Mantém a similaridade do chunk âncora que trouxe este contexto
  (context_docs.pmo_id IS NULL) as is_global,
  '{}'::jsonb as metadata, -- Assumindo sem metadata por padrão, ou context_docs.metadata se existir na tabela real
  context_docs.chunk_index,
  context_docs.source_document_id
FROM top_matches
JOIN farm_documents context_docs
  ON top_matches.source_document_id = context_docs.source_document_id
  AND context_docs.chunk_index BETWEEN (top_matches.chunk_index - window_size) AND (top_matches.chunk_index + window_size)
-- 3. Ordena os resultados
ORDER BY
  context_docs.source_document_id,
  context_docs.chunk_index,
  top_matches.similarity DESC;
$function$;

-- ── Infraestrutura de PMO ───────────────────────────────────────────────────
--
-- NOTA: sao TRES sobrecargas, tres geracoes da mesma funcao que nunca foram
-- removidas. Distinguem-se pelo tipo do 3o argumento (text vs bigint) e pela
-- aridade, entao nao ha ambiguidade de resolucao — mas duas delas
-- provavelmente estao mortas. Transportadas como estao; identificar qual o
-- codigo realmente chama e podar as outras e trabalho separado (DT-46).
--
--   1. (bigint, uuid, bigint, text, numeric, jsonb)          — propriedade_id em 3o
--   2. (bigint, uuid, text, numeric, jsonb, bigint)          — propriedade_id no fim, resolve via pmos
--   3. (bigint, uuid, text, numeric, jsonb, bigint, bigint)  — aceita talhao_id existente

CREATE OR REPLACE FUNCTION public.criar_infraestrutura_pmo(p_pmo_id bigint, p_user_id uuid, p_propriedade_id bigint, p_nome_talhao text, p_area_ha numeric DEFAULT NULL::numeric, p_canteiros jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_talhao_id BIGINT;
    v_area_m2 NUMERIC;
    v_canteiro JSONB;
    v_created_canteiros_count INT := 0;
    v_result JSONB;
BEGIN
    -- 1. Resolve or Create Talhão
    SELECT id INTO v_talhao_id
    FROM public.talhoes
    WHERE pmo_id = p_pmo_id
      AND nome ILIKE p_nome_talhao
    LIMIT 1;

    IF v_talhao_id IS NULL THEN
        -- Calculate Area M2
        IF p_area_ha IS NOT NULL THEN
            v_area_m2 := p_area_ha * 10000;
        END IF;

        INSERT INTO public.talhoes (
            pmo_id, user_id, propriedade_id, nome, area_ha, area_total_m2,
            geometry, cor_identificacao, fill_color, border_color
        ) VALUES (
            p_pmo_id, p_user_id, p_propriedade_id, p_nome_talhao, p_area_ha, v_area_m2,
            '{"type": "Polygon", "coordinates": []}'::jsonb,
            '#4CAF50', '#3bb444', '#228b22'
        )
        RETURNING id INTO v_talhao_id;
    END IF;

    -- 2. Create Canteiros if provided
    IF p_canteiros IS NOT NULL AND jsonb_array_length(p_canteiros) > 0 THEN
        FOR v_canteiro IN SELECT * FROM jsonb_array_elements(p_canteiros)
        LOOP
            INSERT INTO public.canteiros (
                talhao_id, nome, largura_metros, comprimento_metros, area_total_m2, tipo_estrutura
            ) VALUES (
                v_talhao_id,
                v_canteiro->>'nome',
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, 1.0),
                COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, 10.0),
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, 1.0) * COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, 10.0),
                'canteiro'
            );
            v_created_canteiros_count := v_created_canteiros_count + 1;
        END LOOP;
    END IF;

    -- 3. Construct Result
    v_result := jsonb_build_object(
        'talhao_id', v_talhao_id,
        'nome_talhao', p_nome_talhao,
        'canteiros_criados', v_created_canteiros_count,
        'status', 'success'
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM,
            'detail', SQLSTATE
        );
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_infraestrutura_pmo(p_pmo_id bigint, p_user_id uuid, p_nome_talhao text, p_area_ha numeric DEFAULT NULL::numeric, p_canteiros jsonb DEFAULT '[]'::jsonb, p_propriedade_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_talhao_id BIGINT;
    v_area_m2 NUMERIC;
    v_canteiro JSONB;
    v_created_canteiros_count INT := 0;
    v_result JSONB;
    v_resolved_prop_id BIGINT;
BEGIN
    -- 1. Resolve Propriedade ID if NULL
    IF p_propriedade_id IS NULL THEN
        SELECT propriedade_id INTO v_resolved_prop_id
        FROM public.pmos
        WHERE id = p_pmo_id;
    ELSE
        v_resolved_prop_id := p_propriedade_id;
    END IF;

    -- 2. Resolve or Create Talhão
    SELECT id INTO v_talhao_id
    FROM public.talhoes
    WHERE pmo_id = p_pmo_id
      AND nome ILIKE p_nome_talhao
    LIMIT 1;

    IF v_talhao_id IS NULL THEN
        -- Calculate Area M2
        IF p_area_ha IS NOT NULL THEN
            v_area_m2 := p_area_ha * 10000;
        END IF;

        INSERT INTO public.talhoes (
            pmo_id, user_id, propriedade_id, nome, area_ha, area_total_m2,
            geometry, cor_identificacao, fill_color, border_color
        ) VALUES (
            p_pmo_id, p_user_id, v_resolved_prop_id, p_nome_talhao, p_area_ha, v_area_m2,
            '{"type": "Polygon", "coordinates": []}'::jsonb,
            '#4CAF50', '#3bb444', '#228b22'
        )
        RETURNING id INTO v_talhao_id;
    END IF;

    -- 3. Create Canteiros if provided
    IF p_canteiros IS NOT NULL AND jsonb_array_length(p_canteiros) > 0 THEN
        FOR v_canteiro IN SELECT * FROM jsonb_array_elements(p_canteiros)
        LOOP
            INSERT INTO public.canteiros (
                talhao_id, nome, largura_metros, comprimento_metros, area_total_m2, tipo_estrutura
            ) VALUES (
                v_talhao_id,
                v_canteiro->>'nome',
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, 1.0),
                COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, 10.0),
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, 1.0) * COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, 10.0),
                'canteiro'
            );
            v_created_canteiros_count := v_created_canteiros_count + 1;
        END LOOP;
    END IF;

    -- 4. Construct Result
    v_result := jsonb_build_object(
        'talhao_id', v_talhao_id,
        'nome_talhao', p_nome_talhao,
        'canteiros_criados', v_created_canteiros_count,
        'status', 'success'
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM,
            'detail', SQLSTATE
        );
END;
$function$;

CREATE OR REPLACE FUNCTION public.criar_infraestrutura_pmo(p_pmo_id bigint, p_user_id uuid, p_nome_talhao text DEFAULT NULL::text, p_area_ha numeric DEFAULT NULL::numeric, p_canteiros jsonb DEFAULT '[]'::jsonb, p_propriedade_id bigint DEFAULT NULL::bigint, p_talhao_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_talhao_id BIGINT := p_talhao_id;
    v_area_m2 NUMERIC;
    v_canteiro JSONB;
    v_created_canteiros_count INT := 0;
    v_result JSONB;
    v_resolved_prop_id BIGINT;
BEGIN
    -- 1. Resolve Propriedade ID if NULL
    IF p_propriedade_id IS NULL THEN
        SELECT propriedade_id INTO v_resolved_prop_id
        FROM public.pmos
        WHERE id = p_pmo_id;
    ELSE
        v_resolved_prop_id := p_propriedade_id;
    END IF;

    -- 2. Resolve or Create Talhão
    IF v_talhao_id IS NULL AND p_nome_talhao IS NOT NULL THEN
        SELECT id INTO v_talhao_id
        FROM public.talhoes
        WHERE pmo_id = p_pmo_id
          AND nome ILIKE p_nome_talhao
        LIMIT 1;
    END IF;

    IF v_talhao_id IS NULL THEN
        -- Mandatory name for creation
        IF p_nome_talhao IS NULL THEN
            RETURN jsonb_build_object('status', 'error', 'message', 'nome_talhao is required to create a new talhão');
        END IF;

        -- Calculate Area M2
        IF p_area_ha IS NOT NULL THEN
            v_area_m2 := p_area_ha * 10000;
        END IF;

        INSERT INTO public.talhoes (
            pmo_id, user_id, propriedade_id, nome, area_ha, area_total_m2,
            geometry, cor_identificacao, fill_color, border_color
        ) VALUES (
            p_pmo_id, p_user_id, v_resolved_prop_id, p_nome_talhao, p_area_ha, v_area_m2,
            '{"type": "Polygon", "coordinates": []}'::jsonb,
            '#4CAF50', '#3bb444', '#228b22'
        )
        RETURNING id INTO v_talhao_id;
    END IF;

    -- 3. Create Canteiros if provided
    IF p_canteiros IS NOT NULL AND jsonb_array_length(p_canteiros) > 0 THEN
        FOR v_canteiro IN SELECT * FROM jsonb_array_elements(p_canteiros)
        LOOP
            INSERT INTO public.canteiros (
                talhao_id, nome, largura_metros, comprimento_metros, area_total_m2, tipo_estrutura
            ) VALUES (
                v_talhao_id,
                v_canteiro->>'nome',
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, (v_canteiro->>'largura')::NUMERIC, 1.0),
                COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, (v_canteiro->>'comprimento')::NUMERIC, 10.0),
                COALESCE((v_canteiro->>'largura_metros')::NUMERIC, (v_canteiro->>'largura')::NUMERIC, 1.0) * COALESCE((v_canteiro->>'comprimento_metros')::NUMERIC, (v_canteiro->>'comprimento')::NUMERIC, 10.0),
                'canteiro'
            );
            v_created_canteiros_count := v_created_canteiros_count + 1;
        END LOOP;
    END IF;

    -- 4. Construct Result
    v_result := jsonb_build_object(
        'talhao_id', v_talhao_id,
        'nome_talhao', p_nome_talhao,
        'canteiros_criados', v_created_canteiros_count,
        'status', 'success'
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'message', SQLERRM,
            'detail', SQLSTATE
        );
END;
$function$;

-- ── Registro de atividade no caderno de campo ───────────────────────────────
--
-- NOTA: SECURITY DEFINER sem SET search_path (ver DT-46). Alem disso, o bloco
-- EXCEPTION WHEN OTHERS engole QUALQUER erro e devolve status 'error' em JSON,
-- inclusive falha de integridade — o chamador precisa checar o campo `status`,
-- porque a chamada em si nunca falha. Comportamento da producao, preservado.
CREATE OR REPLACE FUNCTION public.registrar_atividade_pmo(pmo_id_arg bigint, user_id_arg uuid, atividade_arg text, data_arg date, produto_arg text, quantidade_valor_arg numeric, quantidade_unidade_arg text, talhao_nome_arg text, canteiros_arg text[], insumo_aplicado_arg text DEFAULT NULL::text, fornecedor_arg text DEFAULT NULL::text, nota_fiscal_arg text DEFAULT NULL::text, detalhes_arg jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_talhao_id BIGINT;
    v_caderno_id UUID;
    v_lote TEXT := NULL;
    v_detalhes JSONB;
    v_canteiro_id UUID;
    v_nome_canteiro TEXT;
    v_atividade_upper TEXT;
BEGIN
    -- 1. Resolve Talhão ID
    SELECT id INTO v_talhao_id
    FROM talhoes
    WHERE pmo_id = pmo_id_arg AND nome ILIKE '%' || talhao_nome_arg || '%'
    LIMIT 1;

    IF v_talhao_id IS NULL THEN
        RAISE EXCEPTION 'Talhão "%" não encontrado para o PMO %', talhao_nome_arg, pmo_id_arg;
    END IF;

    -- 2. Auto-generate Lote for Colheita
    v_atividade_upper := UPPER(atividade_arg);
    IF v_atividade_upper = 'COLHEITA' THEN
        v_lote := 'LOTE-' || to_char(data_arg, 'YYYYMMDD') || '-' || LPAD(floor(random() * 10000)::text, 4, '0');
    END IF;

    -- 3. Prepare detalhes_tecnicos (Parity with Go/React logic)
    v_detalhes := detalhes_arg;
    IF v_detalhes IS NULL THEN v_detalhes := '{}'::jsonb; END IF;

    CASE v_atividade_upper
        WHEN 'PLANTIO' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'qtd_utilizada', quantidade_valor_arg,
                'unidade_medida', quantidade_unidade_arg
            );
        WHEN 'COLHEITA' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'qtd', quantidade_valor_arg,
                'unidade', quantidade_unidade_arg,
                'unidade_medida', quantidade_unidade_arg,
                'lote', COALESCE(v_detalhes->>'lote', v_lote)
            );
        WHEN 'VENDA' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'qtd', quantidade_valor_arg,
                'unidade', quantidade_unidade_arg
            );
        WHEN 'MANEJO' THEN
            v_detalhes := v_detalhes || jsonb_build_object(
                'dosagem', quantidade_valor_arg,
                'unidade_dosagem', quantidade_unidade_arg,
                'unidade_medida', quantidade_unidade_arg
            );
            IF insumo_aplicado_arg IS NOT NULL AND insumo_aplicado_arg <> '' THEN
                v_detalhes := v_detalhes || jsonb_build_object('insumo_aplicado', insumo_aplicado_arg);
            END IF;
        ELSE
            -- No specific mapping for other types, keep as is
    END CASE;

    -- Add canteiro names to details for fallback/reference
    IF array_length(canteiros_arg, 1) > 0 THEN
        v_detalhes := v_detalhes || jsonb_build_object('canteiros', canteiros_arg);
    END IF;

    -- 4. Insert into caderno_campo
    INSERT INTO caderno_campo (
        pmo_id,
        user_id,
        tipo_atividade,
        data_registro,
        produto,
        quantidade_valor,
        quantidade_unidade,
        talhao_id,
        talhao_canteiro,
        lote,
        fornecedor,
        nota_fiscal,
        detalhes_tecnicos
    ) VALUES (
        pmo_id_arg,
        user_id_arg,
        atividade_arg,
        data_arg,
        produto_arg,
        quantidade_valor_arg,
        quantidade_unidade_arg,
        v_talhao_id,
        talhao_nome_arg,
        COALESCE(v_detalhes->>'lote', v_lote),
        fornecedor_arg,
        nota_fiscal_arg,
        v_detalhes
    ) RETURNING id INTO v_caderno_id;

    -- 5. Resolve and Link Canteiros
    IF array_length(canteiros_arg, 1) > 0 THEN
        FOREACH v_nome_canteiro IN ARRAY canteiros_arg
        LOOP
            -- Resolve canteiro ID (Simple ILIKE match within the talhão)
            SELECT id INTO v_canteiro_id
            FROM canteiros
            WHERE talhao_id = v_talhao_id AND nome ILIKE '%' || v_nome_canteiro || '%'
            LIMIT 1;

            IF v_canteiro_id IS NOT NULL THEN
                INSERT INTO caderno_campo_canteiros (caderno_campo_id, canteiro_id)
                VALUES (v_caderno_id, v_canteiro_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- 6. Return response
    RETURN jsonb_build_object(
        'status', 'success',
        'id', v_caderno_id,
        'lote', COALESCE(v_detalhes->>'lote', v_lote),
        'talhao_id', v_talhao_id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$function$;


-- ── Rastreabilidade publica ─────────────────────────────────────────────────
--
-- NOTA sobre o SECURITY DEFINER sem checagem: aqui pode ser INTENCIONAL, ao
-- contrario das demais do DT-46. A funcao recebe um codigo de lote e devolve o
-- historico de manejo — e o caso de uso de rastreabilidade ao consumidor, que
-- por definicao e anonimo (alguem le um QR na embalagem). O que vale revisar
-- nao e o acesso em si, e QUANTO ela devolve: `endereco_completo` da
-- propriedade sai no payload, e endereco de produtor rural para consumidor
-- anonimo e mais do que rastreabilidade exige.
--
-- Sem SET search_path, mesmo assim (DT-46).
--
-- Ver tambem DT-48: o staging tem uma `get_rastreabilidade_publica` que a
-- producao nao tem, e que pode ser a sucessora desta.
CREATE OR REPLACE FUNCTION public.get_traceability_data(p_codigo_lote text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_result JSONB;
BEGIN
    SELECT
        jsonb_build_object(
            'lote', jsonb_build_object(
                'id', l.id,
                'codigo_lote', l.codigo_lote,
                'cultura', l.cultura,
                'quantidade', l.quantidade,
                'data_colheita', l.data_colheita,
                'created_at', l.created_at
            ),
            'propriedade', jsonb_build_object(
                'nome', p.nome,
                'modalidade_predominante', p.modalidade_predominante,
                'cidade', p.cidade,
                'uf', p.uf,
                'endereco_completo', p.endereco_cadastral
            ),
            'historico_manejo', (
                SELECT jsonb_agg(manejo)
                FROM (
                    -- Fetch planting and input applications for the same talhao and culture
                    -- in the 12 months preceding the harvest
                    SELECT
                        data_registro::DATE as data,
                        tipo_atividade as atividade,
                        COALESCE(produto, 'Operação de Manejo') as produto
                    FROM public.caderno_campo
                    WHERE propriedade_id = l.propriedade_id
                      AND tipo_atividade IN ('plantio', 'manejo', 'aplicacao_insumo', 'colheita')
                      -- Filter by the specific talhao if available in the harvest record
                      AND (
                          (SELECT talhao_id FROM public.caderno_campo WHERE id = l.caderno_campo_id) IS NULL
                          OR talhao_id = (SELECT talhao_id FROM public.caderno_campo WHERE id = l.caderno_campo_id)
                      )
                      -- Time window: from 1 year before harvest until harvest date
                      AND data_registro::DATE <= l.data_colheita
                      AND data_registro::DATE >= (l.data_colheita - INTERVAL '1 year')
                    ORDER BY data_registro ASC
                ) manejo
            )
        ) INTO v_result
    FROM public.lotes_rastreabilidade l
    JOIN public.propriedades p ON l.propriedade_id = p.id
    WHERE l.codigo_lote = p_codigo_lote;

    RETURN v_result;
END;
$function$;


-- ============================================================================
-- 3. TRIGGER
-- ============================================================================
--
-- O item mais importante deste arquivo do ponto de vista de seguranca.
--
-- `trg_prevent_self_promotion` sozinha nao protege nada — funcao sem trigger
-- e codigo que ninguem executa. Na producao existe o trigger que a dispara; no
-- staging nao existia NENHUM trigger de protecao de papel sobre profiles. Ou
-- seja, o controle que impede um usuario de se auto-promover a admin estava
-- presente num ambiente e ausente no outro.
--
-- Idempotente via DROP antes do CREATE: o Postgres nao tem
-- CREATE TRIGGER IF NOT EXISTS.

DROP TRIGGER IF EXISTS ensure_role_protection ON public.profiles;
CREATE TRIGGER ensure_role_protection
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_prevent_self_promotion();

COMMIT;
