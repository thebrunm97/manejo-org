-- F13 (TECHNICAL_DEBT.md): create_pmo não tinha chave de idempotência.
--
-- useSyncEngine.ts processa a fila offline com o padrão "claim-then-delete":
-- marca o item como syncing, chama createPmo(payload), e só remove da fila
-- IndexedDB depois da resposta de sucesso. Se a resposta se perder entre o
-- servidor já ter criado o PMO e o cliente confirmar (rede caiu, aba fechou),
-- o item continua "pending" e o próximo sync chama create_pmo de novo com o
-- mesmo payload — cria um segundo PMO duplicado. Não há como o cliente saber
-- se o create anterior chegou a rodar; só uma chave determinística no lado do
-- banco resolve isso.
--
-- Mesmo padrão de deduplicação já usado em rpc_registrar_operacao_campo e
-- companhia (20260816000000_add_idempotency_to_mutations.sql): coluna
-- idempotency_key + índice UNIQUE, checagem antes do insert, devolve a linha
-- existente em vez de inserir de novo quando a chave já foi vista.
--
-- update_pmo não recebe o mesmo tratamento aqui: um retry de UPDATE só
-- reaplica os mesmos campos sobre a mesma linha (sem risco de duplicação),
-- diferente do create.

ALTER TABLE public.pmos
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Escopado por usuário (não globalmente único): duas pessoas não devem
-- colidir por coincidência de UUID gerado no cliente, por mais improvável
-- que seja.
CREATE UNIQUE INDEX IF NOT EXISTS idx_pmos_user_idempotency_key
ON public.pmos (user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_pmo(p_payload jsonb)
RETURNS public.pmos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_record public.pmos;
    v_idempotency_key text := NULLIF(p_payload->>'idempotency_key', '');
    v_existing public.pmos;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    IF v_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing FROM public.pmos
        WHERE user_id = v_user_id AND idempotency_key = v_idempotency_key
        LIMIT 1;

        IF v_existing.id IS NOT NULL THEN
            RETURN v_existing;
        END IF;
    END IF;

    v_record := jsonb_populate_record(null::public.pmos, p_payload);
    v_record.user_id := v_user_id;
    v_record.created_at := now();
    v_record.idempotency_key := v_idempotency_key;

    IF v_record.propriedade_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.propriedades p
            WHERE p.id = v_record.propriedade_id AND p.user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Propriedade inválida ou não pertence ao usuário';
        END IF;
    END IF;

    INSERT INTO public.pmos SELECT v_record.*
    RETURNING * INTO v_record;

    RETURN v_record;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_pmo FROM public;
GRANT EXECUTE ON FUNCTION public.create_pmo TO authenticated;
