-- DT-109: "CONECTAR <código>" sem expiração/brute-force/dedupe, e achado
-- colateral: o pareamento estava de fato quebrado em produção.
--
-- Achado ao investigar (confirmado ao vivo via introspecção antes de escrever
-- esta migration, mesma lição do DT-22/DT-70 — não confiar no arquivo):
--   1. `profiles.codigo_vinculo` existe em produção mas NUNCA foi criado por
--      nenhuma migration deste repo (drift, igual ao padrão já documentado).
--      Staging nem tem a coluna.
--   2. `authenticated` só tem SELECT/REFERENCES em `codigo_vinculo` — não tem
--      UPDATE direto. A única gravação possível é via RPC SECURITY DEFINER.
--   3. A única RPC que toca `profiles` (`update_profile`,
--      20260818140000_create_domain_mutation_rpcs.sql:8) tem um whitelist de
--      colunas que NÃO inclui `codigo_vinculo` — confirmado idêntico em
--      produção via pg_get_functiondef, sem drift aqui.
--   4. Logo: `pmo-frontend/src/services/whatsappService.ts:generateWhatsappCode`
--      gera um código, chama `update_profile({codigo_vinculo: code})`, a RPC
--      ignora o campo (fora do CASE WHEN) e devolve o código pro usuário como
--      se tivesse sido salvo — mas `profiles.codigo_vinculo` nunca muda. O
--      pareamento via código está funcionalmente quebrado hoje, não só inseguro.
--
-- Esta migration corrige as duas coisas juntas: formaliza a coluna (para
-- staging/CI convergirem), adiciona expiração, um índice único parcial
-- (evita colisão de dois códigos pendentes iguais) e RPCs dedicadas que
-- geram/revogam o código no servidor — nunca aceitando o valor do cliente,
-- ao contrário do que `generateWhatsappCode` fazia.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS codigo_vinculo TEXT,
    ADD COLUMN IF NOT EXISTS codigo_vinculo_expira_em TIMESTAMPTZ;

-- Só um código pendente por vez no sistema inteiro (índice parcial: não conta
-- linhas com o código já consumido/nulo). Fecha a ambiguidade "LIMIT 1 sem
-- ORDER BY" citada no DT-109 na raiz — colisão vira erro de constraint, não
-- entrega silenciosa do primeiro resultado.
DROP INDEX IF EXISTS public.profiles_codigo_vinculo_pendente_idx;
CREATE UNIQUE INDEX profiles_codigo_vinculo_pendente_idx
    ON public.profiles (codigo_vinculo)
    WHERE codigo_vinculo IS NOT NULL;

-- Gera o código no servidor (nunca aceita valor do cliente) e grava a
-- expiração junto, na mesma transação da RPC.
CREATE OR REPLACE FUNCTION public.generate_whatsapp_link_code()
RETURNS TABLE(codigo TEXT, expira_em TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_codigo TEXT;
    v_expira TIMESTAMPTZ := now() + interval '10 minutes';
    v_tentativas INT := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    LOOP
        v_codigo := upper(substr(md5(gen_random_uuid()::text), 1, 6));
        BEGIN
            UPDATE public.profiles
            SET codigo_vinculo = v_codigo,
                codigo_vinculo_expira_em = v_expira
            WHERE id = v_user_id;
            EXIT;
        EXCEPTION WHEN unique_violation THEN
            v_tentativas := v_tentativas + 1;
            IF v_tentativas >= 5 THEN
                RAISE EXCEPTION 'Não foi possível gerar um código único, tente novamente';
            END IF;
        END;
    END LOOP;

    RETURN QUERY SELECT v_codigo, v_expira;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.generate_whatsapp_link_code FROM public;
GRANT EXECUTE ON FUNCTION public.generate_whatsapp_link_code TO authenticated;

-- Revoga o código pendente (usado no desvínculo e após consumo malsucedido).
CREATE OR REPLACE FUNCTION public.revoke_whatsapp_link_code()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Não autorizado';
    END IF;

    UPDATE public.profiles
    SET codigo_vinculo = NULL,
        codigo_vinculo_expira_em = NULL
    WHERE id = v_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_whatsapp_link_code FROM public;
GRANT EXECUTE ON FUNCTION public.revoke_whatsapp_link_code TO authenticated;
