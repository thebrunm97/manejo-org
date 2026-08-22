-- Cofre de Auditoria Efêmero (DT-42).
--
-- POR QUE O ÁUDIO É RETIDO
--
-- Descartar a gravação logo após a transcrição seria o ideal em privacidade —
-- biometria vocal é dado sensível (LGPD art. 5º, II). Mas deixaria o produtor
-- indefeso: se a IA alucinar um registro no caderno de campo, ele precisa poder
-- provar o que de fato disse. O sistema existe para defendê-lo perante a
-- certificadora, e essa defesa depende do não-repúdio.
--
-- O equilíbrio é a EFEMERIDADE: retém-se pelo tempo em que uma contestação de
-- registro é plausível (90 dias) e não além disso. Sem prazo, o cofre viraria
-- arquivo permanente de voz — exatamente o que se quer evitar.
--
-- ACESSO
--
-- Só o titular ouve a própria gravação, garantido por RLS. Isto é diferente do
-- estado atual: o bucket `audios_audit` hoje é PÚBLICO (verificado:
-- storage.buckets.public = true), o que torna toda gravação já existente
-- acessível por URL a qualquer um. Por isso o cofre usa um bucket NOVO e
-- privado, em vez de reaproveitar o antigo — ver P0-1 no registro de riscos.
--
-- NOTA SOBRE NOMES: existe um BUCKET chamado `audios_audit` e esta migration
-- cria uma TABELA de mesmo nome. São namespaces distintos e não colidem, mas a
-- semelhança é enganosa: o bucket antigo é o legado público a ser desativado,
-- a tabela é o índice do cofre novo. O bucket do cofre chama-se `audit-vault`.

BEGIN;

-- ─── Tabela de metadados do cofre ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audios_audit (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Titular da gravação. É a chave da RLS: sem ele não há como provar quem
    -- pode ouvir o quê.
    profile_id   uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,

    -- Caminho do objeto no bucket privado `audit-vault`. Guarda-se o CAMINHO,
    -- nunca uma URL pública: o acesso se dá por URL assinada de curta duração,
    -- emitida sob demanda depois da checagem de RLS.
    storage_path text NOT NULL UNIQUE,

    -- Intenção que o sistema atribuiu ao áudio. É o elo do não-repúdio: permite
    -- confrontar "o que a IA entendeu" com "o que o produtor disse".
    final_intent text,

    created_at   timestamptz NOT NULL DEFAULT now(),

    -- Instante de expiração. Materializado em coluna, e não calculado a partir
    -- de created_at, para que a política de retenção fique auditável no próprio
    -- dado: se o prazo mudar no futuro, os registros antigos preservam o prazo
    -- sob o qual foram criados.
    expires_at   timestamptz NOT NULL,

    CONSTRAINT audios_audit_expira_depois_de_criado CHECK (expires_at > created_at)
);

COMMENT ON TABLE public.audios_audit IS
  'Cofre de Auditoria Efemero (DT-42). Indice dos audios retidos por 90 dias '
  'para nao-repudio do produtor. Objetos no bucket privado audit-vault. '
  'NAO confundir com o bucket legado publico de mesmo nome, que sera desativado.';

COMMENT ON COLUMN public.audios_audit.expires_at IS
  'Prazo de retencao (criacao + 90 dias). Registros vencidos devem ser apagados '
  'junto com o objeto no storage — expirar a linha sem remover o audio nao '
  'cumpre a minimizacao.';

-- Índice para a rotina de expurgo, que varre por expires_at.
CREATE INDEX IF NOT EXISTS idx_audios_audit_expires_at
    ON public.audios_audit (expires_at);

-- Índice para a consulta do titular ("minhas gravações, mais recentes antes").
CREATE INDEX IF NOT EXISTS idx_audios_audit_profile_created
    ON public.audios_audit (profile_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.audios_audit ENABLE ROW LEVEL SECURITY;

-- Sem FORCE, o dono da tabela contornaria a política. Como o cofre guarda dado
-- sensível, a restrição vale inclusive para o owner.
ALTER TABLE public.audios_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "titular le a propria gravacao" ON public.audios_audit;
CREATE POLICY "titular le a propria gravacao"
    ON public.audios_audit
    FOR SELECT
    TO authenticated
    USING (auth.uid() = profile_id);

-- Só SELECT é concedido ao titular, deliberadamente.
--
-- Não há política de INSERT, UPDATE ou DELETE para `authenticated`: a escrita é
-- do bot (service_role, que contorna RLS) e o expurgo é da rotina de retenção.
-- Permitir que o titular apagasse a própria gravação destruiria o não-repúdio
-- que motiva o cofre — o pedido de eliminação (art. 18, VI) deve passar por um
-- procedimento auditável, não por um DELETE direto na tabela.
GRANT SELECT ON public.audios_audit TO authenticated;

COMMIT;
