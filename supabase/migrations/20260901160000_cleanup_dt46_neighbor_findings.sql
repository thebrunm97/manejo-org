-- ============================================================
-- MIGRATION: Limpa os achados vizinhos do DT-46
-- Description: DT-46 corrigiu o núcleo de autorização (SECURITY DEFINER sem
--   checagem) e deixou de propósito quatro achados de correção de código
--   fora daquela correção, cada um por ser uma categoria diferente de
--   defeito. Este migration resolve os quatro:
--
--   1-3 (dropadas). `match_chunks` tem 3 sobrecargas, e a de 4 argumentos
--      referencia `k.pmo_id`, coluna que não existe em `knowledge_chunks`
--      (só estoura quando chamada). Confirmado por grep em todo o repo:
--      NENHUMA das 3 sobrecargas tem chamador real (nem `.rpc('match_chunks'
--      ...)` no frontend, nem no bot Go) — `match_documents_with_context` é
--      quem de fato serve consultar_base_conhecimento hoje, com escopo por
--      PMO sobre `farm_documents`, funcionando. Mantê-las não serve a
--      ninguém e ainda esconde um risco latente: as duas sobrecargas "que
--      funcionam" não escopam por PMO nenhum — se alguém as resgatasse sem
--      notar, vazaria knowledge_chunks entre PMOs. Removidas as 3.
--
--      `criar_infraestrutura_pmo` tem 3 sobrecargas, todas já sem GRANT a
--      ninguém desde o DT-65 (nem service_role) — a própria migration do
--      DT-65 registrou que só apareciam em CHANGELOG.md/docs/state.md e nos
--      tipos TS gerados, nenhum chamador real, e adiou a decisão entre
--      "resgatar" ou "remover como o DT-47 fez com outras órfãs". Decisão
--      tomada agora: remover — já estavam inacessíveis para todo mundo,
--      então isto não muda nenhum comportamento observável, só reduz a
--      chance de alguém "corrigir" a sobrecarga errada no futuro.
--
--   4. `is_chemical_input` era marcada IMMUTABLE mas chama unaccent(), que o
--      próprio Postgres marca STABLE (depende do dicionário/extensão
--      instalada, não é uma garantia eterna). Rebaixada para STABLE — rótulo
--      correto, sem nenhum índice funcional dependendo dela (verificado
--      antes de aplicar) para quebrar.
--
--   5. `validate_file_extension` é SECURITY DEFINER sem nenhum motivo — o
--      corpo só faz SUBSTRING/LOWER numa string, não toca tabela alguma.
--      Rebaixada para SECURITY INVOKER (o padrão), fechando um privilégio
--      concedido à toa.
-- ============================================================

DROP FUNCTION IF EXISTS public.match_chunks(query_embedding halfvec, match_threshold double precision, match_count integer);
DROP FUNCTION IF EXISTS public.match_chunks(query_embedding vector, match_count integer);
DROP FUNCTION IF EXISTS public.match_chunks(query_embedding vector, match_threshold double precision, match_count integer, pmo_id_filter bigint);

DROP FUNCTION IF EXISTS public.criar_infraestrutura_pmo(p_pmo_id bigint, p_user_id uuid, p_propriedade_id bigint, p_nome_talhao text, p_area_ha numeric, p_canteiros jsonb);
DROP FUNCTION IF EXISTS public.criar_infraestrutura_pmo(p_pmo_id bigint, p_user_id uuid, p_nome_talhao text, p_area_ha numeric, p_canteiros jsonb, p_propriedade_id bigint);
DROP FUNCTION IF EXISTS public.criar_infraestrutura_pmo(p_pmo_id bigint, p_user_id uuid, p_nome_talhao text, p_area_ha numeric, p_canteiros jsonb, p_propriedade_id bigint, p_talhao_id bigint);

CREATE OR REPLACE FUNCTION public.is_chemical_input(produto_nome text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
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
    FOR i IN 1..array_length(blacklist, 1) LOOP
        IF produto_lower LIKE '%' || blacklist[i] || '%' THEN
            RETURN TRUE;
        END IF;
    END LOOP;
    RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_file_extension(name text, allowed_extensions text[])
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    file_extension text;
BEGIN
    file_extension := LOWER(
        SUBSTRING(name FROM '\.([^\.\/]+)$')
    );
    RETURN file_extension = ANY(allowed_extensions);
END;
$function$;
