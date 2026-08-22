-- DT-39 — a coluna `timestamp` de public.messages nunca foi preenchida.
--
-- Sintomas em produção:
--   1. O Monitor ao Vivo exibia 21:00 em TODAS as mensagens. O frontend faz
--      `new Date(msg.timestamp)`; com NULL isso vira epoch (1970-01-01T00:00Z),
--      que em UTC-3 é 21:00 de 31/12/1969.
--   2. Pior: a consulta ordena por essa coluna (`.order('timestamp')`). Com
--      todos os valores NULL, a ordem das mensagens era INDEFINIDA — uma
--      conversa de auditoria podia ser exibida fora de sequência.
--
-- Causa: a coluna é `text` (não `timestamptz`), não tem DEFAULT, e o struct
-- MessageInsert do bot nunca teve um campo de timestamp para enviar.
--
-- Estado verificado em produção antes de escrever esta migration: 337 linhas,
-- das quais 30 TÊM valor e 307 estão NULL. Os 30 valores existentes convivem em
-- dois formatos — ISO 8601 com "Z" ("2026-06-14T18:20:00.000Z") e estilo
-- Postgres com offset ("2026-06-10 00:15:00.000000-03:00") — e todos foram
-- testados como convertíveis para timestamptz (mais antiga 2026-06-10, mais
-- recente 2026-06-15). Ou seja: a conversão abaixo não perde dado nem falha no
-- meio da transação.

BEGIN;

-- 0. A view view_conversas_recentes (lista de conversas do painel) depende
--    desta coluna, e o Postgres recusa ALTER TYPE nesse caso:
--      "cannot alter type of a column used by a view or rule"
--    Por isso ela sai e volta em torno da conversão. Os GRANTs são perdidos com
--    o DROP e precisam ser restaurados explicitamente no final — sem isso o
--    frontend (anon/authenticated) perderia acesso à lista de conversas.
DROP VIEW IF EXISTS public.view_conversas_recentes;

-- 1. Converte para timestamptz.
--
-- O USING normaliza os dois formatos encontrados e trata strings vazias como
-- NULL. O cast do Postgres aceita tanto ISO com "Z" quanto offset explícito, e
-- ambos são armazenados como o mesmo instante absoluto — o que resolve, de
-- quebra, a ambiguidade de fuso que existia enquanto a coluna era texto livre.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'timestamp'
      AND data_type <> 'timestamp with time zone'
  ) THEN
    ALTER TABLE public.messages
      ALTER COLUMN "timestamp" TYPE timestamptz
      USING NULLIF(btrim("timestamp"::text), '')::timestamptz;
  END IF;
END
$$;

-- 2. DEFAULT now() como defesa em profundidade.
--
-- O bot passa a enviar o instante explicitamente, mas o DEFAULT garante que
-- qualquer outro caminho de escrita (script, correção manual, integração
-- futura) não volte a produzir linha sem hora — que foi exatamente como o
-- problema surgiu.
ALTER TABLE public.messages
  ALTER COLUMN "timestamp" SET DEFAULT now();

-- 3. As linhas históricas permanecem NULL, DE PROPÓSITO.
--
-- Seria trivial preenchê-las com now() e "limpar" o painel, mas isso
-- FABRICARIA dado de auditoria: registros de conformidade orgânica passariam a
-- exibir um horário que não corresponde a quando a conversa ocorreu. Para um
-- sistema cujo propósito é servir de prova perante certificadora, inventar
-- timestamp é pior que admitir a lacuna.
--
-- O frontend deve exibir "hora não registrada" para esses casos, em vez do
-- 21:00 fabricado pelo epoch.
COMMENT ON COLUMN public.messages."timestamp" IS
  'Instante da mensagem (trilha de auditoria). NULL em 307 linhas anteriores a '
  '2026-08-22, quando o bot nunca preenchia a coluna (DT-39). NAO retroalimentar '
  'esses NULLs com valores estimados: inventar horario em registro de auditoria '
  'e pior que assumir a lacuna.';

-- 4. Índice para a consulta do Monitor ao Vivo (filtra por phone, ordena por
--    timestamp). Sem ele, a ordenação que passa a existir custaria um sort a
--    cada abertura de conversa.
CREATE INDEX IF NOT EXISTS idx_messages_phone_timestamp
  ON public.messages (phone, "timestamp" DESC);


-- 5. Recria a view, idêntica à original salvo por um detalhe: NULLS LAST no
--    row_number.
--
--    A view escolhe a "última mensagem" de cada telefone via
--    ORDER BY "timestamp" DESC. Com a coluna inteiramente nula, essa ordenação
--    não definia vencedor e a mensagem exibida na lista de conversas era
--    arbitrária. NULLS LAST garante que, havendo qualquer linha com hora, ela
--    prevaleça sobre as históricas sem hora.
CREATE VIEW public.view_conversas_recentes AS
 WITH ranked_messages AS (
         SELECT messages.id,
            messages.phone,
            messages.content,
            messages.role,
            messages."timestamp",
            messages.status,
            row_number() OVER (PARTITION BY messages.phone ORDER BY messages."timestamp" DESC NULLS LAST) AS rn
           FROM messages
          WHERE messages.phone IS NOT NULL
        )
 SELECT r.id,
    r.phone,
    r.content AS last_message,
    r.role AS last_message_role,
    r."timestamp" AS last_message_timestamp,
    r.status AS last_message_status,
    p.nome AS profile_name
   FROM ranked_messages r
     LEFT JOIN profiles p ON normalize_phone(p.telefone) = normalize_phone(r.phone)
  WHERE r.rn = 1;

-- 6. Restaura os GRANTs perdidos no DROP VIEW (conferidos antes da migration).
GRANT SELECT, REFERENCES, TRIGGER ON public.view_conversas_recentes TO anon;
GRANT SELECT, REFERENCES, TRIGGER ON public.view_conversas_recentes TO authenticated;
GRANT ALL ON public.view_conversas_recentes TO postgres;
GRANT ALL ON public.view_conversas_recentes TO service_role;

COMMIT;
