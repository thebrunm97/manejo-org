-- Base de conhecimento (RAG) por país — internacionalização (Moçambique).
--
-- Os documentos globais de farm_documents (pmo_id nulo/0) eram todos
-- brasileiros — Lei 10.831, INs do MAPA, guias da Embrapa — e a busca não
-- tinha filtro de país: um produtor de Moçambique perguntando de certificação
-- receberia a lei brasileira como resposta. Antes de ingerir material do IIAM,
-- a busca passa a respeitar o país da propriedade.
--
-- pais NULL = documento universal (vale para qualquer país). Os globais atuais
-- são marcados 'BR' de forma conservadora — inclusive os guias agronômicos da
-- Embrapa, que citam registro de produto e norma brasileiros. Reclassificar um
-- documento como universal é um UPDATE simples, quando alguém revisar.

ALTER TABLE public.farm_documents ADD COLUMN IF NOT EXISTS pais TEXT;

UPDATE public.farm_documents
SET pais = 'BR'
WHERE (pmo_id IS NULL OR pmo_id = 0) AND pais IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'farm_documents_pais_iso2' AND conrelid = 'public.farm_documents'::regclass
  ) THEN
    ALTER TABLE public.farm_documents
      ADD CONSTRAINT farm_documents_pais_iso2 CHECK (pais IS NULL OR pais ~ '^[A-Z]{2}$');
  END IF;
END
$$;

COMMENT ON COLUMN public.farm_documents.pais IS
  'País a que o documento se aplica (ISO 3166-1 alfa-2). NULL = universal. Filtra a busca de match_documents_with_context_1024.';

-- Nova assinatura com match_pais. DROP + CREATE (e não um overload): com as
-- duas versões, uma chamada com 5 argumentos nomeados seria ambígua para o
-- PostgREST. match_pais DEFAULT NULL mantém o comportamento antigo para quem
-- ainda não envia o país (bot em versão anterior durante o deploy).
DROP FUNCTION IF EXISTS public.match_documents_with_context_1024(vector, bigint, double precision, integer, integer);

CREATE FUNCTION public.match_documents_with_context_1024(
  query_embedding vector,
  match_pmo_id bigint,
  match_threshold double precision,
  match_count integer,
  window_size integer DEFAULT 1,
  match_pais text DEFAULT NULL
)
RETURNS TABLE(id bigint, pmo_id bigint, document_name text, content text, similarity double precision, is_global boolean, metadata jsonb, chunk_index integer, source_document_id text)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH matches AS (
    SELECT
      d.id,
      d.pmo_id,
      d.document_name,
      d.content,
      1 - (d.embedding_1024 <=> query_embedding) AS similarity,
      CASE WHEN (d.pmo_id = 0 OR d.pmo_id IS NULL) THEN true ELSE false END AS is_global,
      '{}'::jsonb AS metadata,
      d.chunk_index,
      d.source_document_id::text
    FROM farm_documents d
    WHERE (d.pmo_id = match_pmo_id OR d.pmo_id = 0 OR d.pmo_id IS NULL)
      -- Documento da própria fazenda vale sempre; global só se for do país
      -- da propriedade ou universal (pais NULL).
      AND (
        match_pais IS NULL
        OR (d.pmo_id IS NOT NULL AND d.pmo_id <> 0)
        OR d.pais IS NULL
        OR d.pais = match_pais
      )
      AND d.embedding_1024 IS NOT NULL
      AND 1 - (d.embedding_1024 <=> query_embedding) > match_threshold
    ORDER BY d.embedding_1024 <=> query_embedding
    LIMIT match_count
  )
  SELECT * FROM matches;
END;
$function$;

-- Só o backend chama esta função (service_role). Antes ela era executável por
-- anon/PUBLIC; não vazava nada porque farm_documents tem RLS sem política,
-- mas não há motivo para expor.
REVOKE ALL ON FUNCTION public.match_documents_with_context_1024(vector, bigint, double precision, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_documents_with_context_1024(vector, bigint, double precision, integer, integer, text) TO service_role;
