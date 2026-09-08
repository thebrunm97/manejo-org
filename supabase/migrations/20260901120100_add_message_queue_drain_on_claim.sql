-- DT-68 / PLAN-message-buffer-coalescing.md (pmo-bot-go/docs) — Fase 2.
--
-- Ensina `claim_next_message_job` a drenar, na MESMA transação do claim, os
-- demais jobs `ai_pending` já elegíveis do mesmo telefone, fundindo-os no job
-- reivindicado ("pai").
--
-- HISTÓRICO DE DESIGN (deixado de propósito — é o ponto de maior risco do
-- recurso inteiro): a primeira versão desta função tentava só um
-- `UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)` para
-- escolher o pai, igual ao claim de sempre, e SÓ DEPOIS buscava os irmãos
-- pelo `from_phone` do pai. Isso tem um bug real sob concorrência: a seleção
-- do pai não tem noção de telefone, então dois workers correndo ao mesmo
-- tempo podem cada um vencer o SKIP LOCKED sobre uma linha DIFERENTE da MESMA
-- rajada (ex: worker A trava "um", worker B — que não via "um" mais
-- disponível — trava "dois" como SEU PRÓPRIO pai) e cada um dreno só os
-- irmãos que ainda conseguir travar, fatiando um turno em dois. Pego pelo
-- teste de concorrência da Fase 5 (`TestMessageQueue_BufferDrain_Concurrency_
-- RealPostgreSQL_Integration`, 5 workers × 5 fragmentos, esperando 1 pai e
-- obtendo 3) — sem esse teste, isso teria ido para produção quebrado.
--
-- CORREÇÃO: a unidade de contenção passa a ser o TELEFONE, não a linha. Um
-- advisory lock TRANSACIONAL (`pg_try_advisory_xact_lock`, liberado sozinho
-- no commit/rollback) serializa qualquer outro worker mirando o MESMO
-- telefone antes de qualquer linha ser tocada. Só depois de garantir posse
-- exclusiva do telefone é que a função descobre e trava o grupo inteiro de
-- jobs elegíveis daquele telefone numa única `SELECT ... FOR UPDATE` (sem
-- SKIP LOCKED aqui — sob o advisory lock, nada mais deveria estar disputando
-- essas linhas; se algo bloquear, é melhor esperar do que silenciosamente
-- devolver um grupo incompleto). Se o try-lock falhar (outro worker já detém
-- o telefone do job mais antigo), a chamada devolve vazio e desiste desta
-- rodada — o próximo poll do worker resolve sozinho, mesmo espírito do
-- SKIP LOCKED de sempre.
--
-- Contrato de retorno INALTERADO: a função continua devolvendo no máximo UMA
-- linha (RETURNS SETOF, mas sempre 0 ou 1 via RETURN NEXT + RETURN). O client
-- Go (`Manager.claimByStatus`, internal/queue/manager.go) já sabe lidar com
-- objeto único ou array de 1 vindo do PostgREST — zero mudança necessária ali
-- além de propagar `job.CreatedAt`, feita à parte deste arquivo. Os jobs
-- irmãos são atualizados como efeito colateral da função, não devolvidos.
--
-- Para p_from_status = 'pending' (Camada de mídia) o comportamento é IDÊNTICO
-- ao anterior — a Camada de mídia processa um job por vez, sem coalescência
-- e sem noção de telefone: juntar áudio/imagem ainda não transcritos não faz
-- sentido antes de virarem texto.
--
-- Preferência de `respond_audio`: vale a do fragmento mais recente por
-- `created_at` entre pai e irmãos — é a manifestação mais atual da
-- preferência do produtor (ver "efeitos colaterais" do PLAN).
--
-- `p_worker_id` segue aceito e não utilizado pelo corpo da função — já era
-- assim antes desta migration, não é uma regressão introduzida aqui.
CREATE OR REPLACE FUNCTION public.claim_next_message_job(p_from_status text, p_target_status text, p_worker_id text)
 RETURNS SETOF message_queue
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_parent message_queue;
  v_phone text;
  v_group_ids uuid[];
BEGIN
  IF p_from_status <> 'ai_pending' THEN
    -- Camada de mídia: sem coalescência, comportamento idêntico ao anterior
    -- ao DT-68 — um job por claim, SKIP LOCKED por linha (não por telefone).
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
    RETURNING * INTO v_parent;

    IF v_parent.id IS NULL THEN
      RETURN;
    END IF;

    RETURN NEXT v_parent;
    RETURN;
  END IF;

  -- Camada de IA: descobre, sem travar nada ainda, de qual telefone é o job
  -- elegível mais antigo — é só uma leitura para saber ONDE tentar a posse
  -- exclusiva a seguir.
  SELECT from_phone INTO v_phone
  FROM message_queue
  WHERE status = 'ai_pending' AND next_retry_at <= NOW()
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_phone IS NULL THEN
    RETURN; -- fila vazia
  END IF;

  IF NOT pg_try_advisory_xact_lock(hashtext('message_queue_ai_pending:' || v_phone)) THEN
    -- Outro worker já detém este telefone nesta mesma janela. Desistir aqui é
    -- seguro: a rajada não desaparece, só não é reivindicada NESTA chamada.
    RETURN;
  END IF;

  -- A partir daqui temos posse exclusiva do telefone: nenhum outro worker
  -- consegue o mesmo advisory lock enquanto esta transação não terminar.
  --
  -- Duas etapas porque o Postgres proíbe `FOR UPDATE` junto de função
  -- agregada na mesma SELECT (erro 0A000: "FOR UPDATE is not allowed with
  -- aggregate functions") — trava as linhas primeiro, sem agregar; a segunda
  -- leitura, já sem concorrência possível (as linhas estão travadas por esta
  -- transação, mais o advisory lock do telefone), agrega em paz.
  PERFORM 1
  FROM message_queue
  WHERE from_phone = v_phone
    AND status = 'ai_pending'
    AND next_retry_at <= NOW()
  FOR UPDATE;

  SELECT array_agg(id ORDER BY created_at ASC) INTO v_group_ids
  FROM message_queue
  WHERE from_phone = v_phone
    AND status = 'ai_pending'
    AND next_retry_at <= NOW();

  IF v_group_ids IS NULL OR array_length(v_group_ids, 1) = 0 THEN
    RETURN; -- defensivo: não deveria acontecer já com o advisory lock em mãos
  END IF;

  UPDATE message_queue
  SET status = p_target_status,
      claimed_at = NOW()
  WHERE id = v_group_ids[1]
  RETURNING * INTO v_parent;

  IF array_length(v_group_ids, 1) > 1 THEN
    WITH merged AS (
      UPDATE message_queue
      SET status = 'merged',
          merged_into_job_id = v_parent.id,
          processed_at = NOW()
      WHERE id = ANY (v_group_ids[2:array_length(v_group_ids, 1)])
      RETURNING id, body_text, respond_audio, created_at
    )
    UPDATE message_queue
    SET body_text = v_parent.body_text || COALESCE(
          (SELECT E'\n' || string_agg(body_text, E'\n' ORDER BY created_at ASC) FROM merged),
          ''
        ),
        parts_count = array_length(v_group_ids, 1),
        respond_audio = COALESCE(
          (SELECT respond_audio FROM merged ORDER BY created_at DESC LIMIT 1),
          v_parent.respond_audio
        )
    WHERE id = v_parent.id
    RETURNING * INTO v_parent;
  END IF;

  RETURN NEXT v_parent;
  RETURN;
END;
$function$;

-- Fecha a nota deixada em 20260901120000_add_message_queue_buffer_coalescing.sql:
-- jobs 'merged' agora recebem `processed_at` no momento da fusão (acima), então
-- entram no mesmo TTL operacional de 7 dias que already regia os 'done'. Sem
-- isto, todo job fundido acumularia para sempre — o dreno cria o status mas
-- nunca o encerra.
CREATE OR REPLACE FUNCTION public.cleanup_message_queue()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM message_queue
    WHERE status IN ('done', 'merged')
      AND processed_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RAISE LOG '[message_queue] Limpeza automática: % jobs removidos (done/merged + 7 dias)', deleted_count;
    RETURN deleted_count;
END;
$function$;
