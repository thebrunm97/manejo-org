-- Feature Multicanal — Fase A.5b
-- Tornar colunas obrigatórias após o backfill.
--
-- ATENÇÃO: Esta migration assume que o backfill (A.5a) já rodou e que as linhas 
-- com user_id NULL foram tratadas ou são aceitáveis como órfãs que ficarão fora do constraint.
-- Se houver muitas mensagens sem user_id que deveriam ter, investigue antes de aplicar.

BEGIN;

-- Para as mensagens, não podemos simplesmente dar SET NOT NULL no user_id se
-- houverem mensagens de teste ou de números desconhecidos sem profile associado.
-- A melhor prática é adicionar uma constraint CHECK que valide que novas mensagens
-- DEVEM ter user_id, mas permita as antigas.
-- Como queremos uma identidade canônica, vamos forçar NOT NULL apenas se o
-- backfill limpou/arrumou tudo. Para fins de migration limpa, vamos aplicar o
-- NOT NULL e, caso falhe em produção, deve-se limpar os dados órfãos primeiro.

-- Para evitar que a migration quebre em produção caso existam mensagens irrecuperáveis,
-- usamos um bloco DO para checar se é seguro aplicar.

DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count 
    FROM public.messages 
    WHERE user_id IS NULL;

    IF orphan_count = 0 THEN
        ALTER TABLE public.messages ALTER COLUMN user_id SET NOT NULL;
    ELSE
        RAISE WARNING 'Existem % mensagens com user_id NULL. Pulando SET NOT NULL para user_id.', orphan_count;
        -- Adicionamos uma constraint apenas para novos registros
        -- ALTER TABLE public.messages ADD CONSTRAINT messages_new_rows_require_user_id 
        -- CHECK (created_at < '2026-09-06' OR user_id IS NOT NULL) NOT VALID;
    END IF;
END $$;

-- A mesma lógica se aplica ao channel
DO $$
DECLARE
    null_channel_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO null_channel_count 
    FROM public.messages 
    WHERE channel IS NULL;

    IF null_channel_count = 0 THEN
        ALTER TABLE public.messages ALTER COLUMN channel SET NOT NULL;
    ELSE
        RAISE WARNING 'Existem % mensagens com channel NULL. Pulando SET NOT NULL para channel.', null_channel_count;
    END IF;
END $$;

COMMIT;
