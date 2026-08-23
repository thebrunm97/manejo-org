-- Preferência de formato de resposta por produtor (DT-29).
--
-- POR QUE ESTA COLUNA EXISTE
--
-- Hoje o formato da resposta é decidido POR MENSAGEM: mandou áudio, recebe
-- áudio. Isso é um bom palpite inicial, mas não é uma preferência — é um
-- espelho. O produtor que grava um áudio uma vez porque estava dirigindo passa
-- a receber áudio para sempre naquela conversa, e quem prefere áudio precisa
-- lembrar de gravar toda vez.
--
-- Além da UX, há três efeitos diretos:
--   * CAPACIDADE — o Piper é o único passo do pipeline que gasta CPU local e,
--     por isso, é o teto de capacidade da VPS (medido no DT-38: ~170 áudios/h
--     com 1 vCPU, e concorrência NÃO aumenta a vazão). Não sintetizar para
--     quem não quer áudio elimina carga, em vez de otimizá-la.
--   * PRIVACIDADE — menos áudio gerado é menos áudio armazenado no Cofre
--     Efêmero (DT-42) e menos texto enviado a um TTS de terceiros, se e quando
--     um provedor de nuvem entrar no roteador.
--   * CUSTO — cobrança de TTS gerenciado é por caractere sintetizado.
--
-- OS TRÊS VALORES
--
--   'texto'       → só texto, nunca áudio
--   'audio'       → texto e áudio, sempre
--   'automatico'  → espelha a entrada (comportamento atual)
--
-- Note que 'audio' significa "texto E áudio", não "só áudio": desde o DT-31 o
-- texto é enviado ANTES do áudio, sempre, nos dois caminhos de entrega. Isso é
-- deliberado — a síntese leva 15-40s e o texto é a degradação segura quando o
-- TTS falha ou satura. Por isso não existe um valor 'só áudio': ele deixaria o
-- produtor sem resposta nenhuma quando o Piper estivesse saturado.
--
-- POR QUE O DEFAULT É 'automatico' E NÃO 'texto'
--
-- Texto como padrão economizaria mais CPU, mas cobra o preço na acessibilidade
-- e cobra de quem menos pode pagar. O público é produtor rural; quem manda
-- áudio muitas vezes o faz porque ler e escrever é custoso. Com áudio em
-- opt-in, essa pessoa precisaria LER uma instrução para descobrir que pode
-- receber áudio — a barreira recai exatamente sobre quem o recurso existe para
-- atender. O espelhamento já é um sinal de preferência razoável e não exige
-- alfabetização para funcionar.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS preferencia_resposta TEXT;

-- Idempotente: DROP antes de ADD, porque re-executar a migration num ambiente
-- que já a aplicou falharia com "constraint already exists".
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_preferencia_resposta_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_preferencia_resposta_check
    CHECK (preferencia_resposta IS NULL
           OR preferencia_resposta IN ('texto', 'audio', 'automatico'));

-- NULL é tratado como 'automatico' pelo código (ports.ResolveResponseMode).
-- Deixar NULL em vez de DEFAULT 'automatico' preserva a distinção entre
-- "nunca escolheu" e "escolheu automático": útil para medir a adoção real da
-- preferência, que é um dos números que faltam para dimensionar a VPS.
COMMENT ON COLUMN public.profiles.preferencia_resposta IS
    'DT-29: formato de resposta preferido. texto | audio | automatico. '
    'NULL = nunca escolheu, tratado como automatico (espelha a entrada). '
    'audio significa texto E audio, pois o texto sempre vai antes (DT-31).';
