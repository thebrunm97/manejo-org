//go:build real_postgres

// Requer Postgres/PostgREST real — não roda em CI (DT-30). Local:
//
//	go test -tags=real_postgres ./internal/queue/... -run RealPostgreSQL

package queue

// Fase 5 do PLAN-message-buffer-coalescing.md (DT-68): valida o dreno de
// claim_next_message_job contra um Postgres/PostgREST real — não é possível
// exercitar SKIP LOCKED, FOR UPDATE e a semântica transacional do dreno
// contra um fake HTTP em memória (ver reaper_test.go para o que É testável
// assim). Segue o mesmo padrão de
// internal/guardrails/mutation_drafts_real_postgres_test.go: requer
// `supabase start` local (127.0.0.1:54321) rodando as migrations até
// 20260901120100_add_message_queue_drain_on_claim.sql; sem isso, FALHA na
// primeira chamada HTTP — não pula silenciosamente.
//
// Executado com sucesso em 2026-09-01 contra o Supabase local desta máquina
// (`npx supabase db reset` + `go test ./internal/queue/... -run
// RealPostgreSQL`), depois de corrigido um gap de GRANT do ambiente local
// (service_role sem INSERT em message_queue — não relacionado ao DT-68, ver
// histórico em docs/debitos_tecnicos.md). Todos os subtestes passaram.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// testSupabaseConn resolve o endpoint e a chave contra os quais estes testes
// rodam. Sem overrides, aponta para o Postgres local de desenvolvimento (a
// mesma chave service_role de demonstração que TODOS os testes real-Postgres
// deste repo já usam — não é segredo, é pública no próprio CLI do Supabase).
//
// Para validar contra STAGING antes de um deploy (Fase 6 do
// PLAN-message-buffer-coalescing.md), rode com:
//
//	SUPABASE_TEST_URL=https://<projeto-staging>.supabase.co \
//	SUPABASE_TEST_SERVICE_KEY=<service_role_key_do_staging> \
//	go test -count=1 -run RealPostgreSQL ./internal/queue/...
//
// ATENÇÃO: staging é infraestrutura compartilhada (outros devs, CI de e2e).
// Rodar isto ali insere e reivindica jobs sintéticos de verdade na tabela
// message_queue do staging — decisão consciente de quem roda, não algo para
// automatizar sem avisar ninguém. NUNCA aponte isto para produção
// (hejewayflbuemnffrhae.supabase.co): não há proteção alguma contra isso
// aqui além de você não colar a URL errada.
func testSupabaseConn() (url, key string) {
	url = os.Getenv("SUPABASE_TEST_URL")
	if url == "" {
		url = "http://127.0.0.1:54321"
	}
	key = os.Getenv("SUPABASE_TEST_SERVICE_KEY")
	if key == "" {
		key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
	}
	return url, key
}

func TestMessageQueue_BufferDrain_RealPostgreSQL_Integration(t *testing.T) {
	localURL, serviceRoleKey := testSupabaseConn()

	mgr := NewManager(localURL, serviceRoleKey)
	ctx := context.Background()

	t.Run("dreno_combina_fragmentos_prontos_do_mesmo_telefone_na_ordem_certa", func(t *testing.T) {
		phone := uniqueTestPhone()
		defer deleteTestJobsByPhone(t, localURL, serviceRoleKey, phone)
		// created_at/next_retry_at no passado = já elegível. msg-1 é o mais
		// antigo -> vira o "pai" reivindicado por ORDER BY created_at ASC.
		insertAIPendingJob(t, localURL, serviceRoleKey, phone, testMsgID("buf-msg-1", phone), "plantei alface hoje", false, -3*time.Second, -3*time.Second)
		insertAIPendingJob(t, localURL, serviceRoleKey, phone, testMsgID("buf-msg-2", phone), "no talhão 3", false, -2*time.Second, -2*time.Second)
		insertAIPendingJob(t, localURL, serviceRoleKey, phone, testMsgID("buf-msg-3", phone), "umas 200 mudas", true, -1*time.Second, -1*time.Second)

		job, err := mgr.ClaimAIPending(ctx, "test-worker-1")
		if err != nil {
			t.Fatalf("ClaimAIPending falhou: %v", err)
		}
		if job == nil {
			t.Fatalf("esperava reivindicar um job combinado, obteve nil (fila vazia)")
		}

		wantText := "plantei alface hoje\nno talhão 3\numas 200 mudas"
		if job.BodyText != wantText {
			t.Fatalf("body_text combinado incorreto:\n  got:  %q\n  want: %q", job.BodyText, wantText)
		}
		if job.PartsCount != 3 {
			t.Fatalf("parts_count = %d, esperava 3", job.PartsCount)
		}
		// respond_audio deve vencer pelo fragmento MAIS RECENTE (buf-msg-3=true),
		// não pelo pai (buf-msg-1=false) — preferência do PLAN.
		if !job.RespondAudio {
			t.Fatalf("respond_audio deveria refletir o fragmento mais recente (true), obteve false")
		}

		// Os dois irmãos viraram 'merged': uma segunda reivindicação para este
		// telefone não deve encontrar mais nada elegível.
		again, err := mgr.ClaimAIPending(ctx, "test-worker-2")
		if err != nil {
			t.Fatalf("segunda ClaimAIPending falhou: %v", err)
		}
		if again != nil {
			t.Fatalf("esperava fila vazia para o telefone após o dreno, obteve outro job: %+v", again)
		}
	})

	t.Run("mensagem_isolada_sem_irmaos_nao_e_alterada", func(t *testing.T) {
		phone := uniqueTestPhone()
		defer deleteTestJobsByPhone(t, localURL, serviceRoleKey, phone)
		insertAIPendingJob(t, localURL, serviceRoleKey, phone, testMsgID("solo-1", phone), "só isso mesmo", false, -1*time.Second, -1*time.Second)

		job, err := mgr.ClaimAIPending(ctx, "test-worker-1")
		if err != nil {
			t.Fatalf("ClaimAIPending falhou: %v", err)
		}
		if job == nil {
			t.Fatalf("esperava reivindicar o job solo")
		}
		if job.BodyText != "só isso mesmo" {
			t.Fatalf("body_text alterado sem irmãos: %q", job.BodyText)
		}
		if job.PartsCount != 1 {
			t.Fatalf("parts_count = %d, esperava 1 (nenhuma fusão)", job.PartsCount)
		}
	})

	t.Run("fragmento_com_next_retry_at_futuro_fica_de_fora_do_dreno", func(t *testing.T) {
		phone := uniqueTestPhone()
		defer deleteTestJobsByPhone(t, localURL, serviceRoleKey, phone)
		// wait-1 já elegível; wait-2 CHEGOU perto (created_at recente) mas seu
		// PRÓPRIO next_retry_at ainda não passou — simula um fragmento que
		// ainda está dentro da própria janela MESSAGE_BUFFER_WINDOW.
		insertAIPendingJob(t, localURL, serviceRoleKey, phone, testMsgID("wait-1", phone), "primeiro fragmento", false, -1*time.Second, -1*time.Second)
		insertAIPendingJob(t, localURL, serviceRoleKey, phone, testMsgID("wait-2", phone), "fragmento ainda na janela", false, -1*time.Second, 30*time.Second)

		job, err := mgr.ClaimAIPending(ctx, "test-worker-1")
		if err != nil {
			t.Fatalf("ClaimAIPending falhou: %v", err)
		}
		if job == nil {
			t.Fatalf("esperava reivindicar o job pronto")
		}
		if job.PartsCount != 1 {
			t.Fatalf("parts_count = %d, esperava 1 — o fragmento ainda não elegível não deveria ter sido drenado", job.PartsCount)
		}
		if job.BodyText != "primeiro fragmento" {
			t.Fatalf("body_text = %q, não deveria ter absorvido o fragmento ainda na janela", job.BodyText)
		}

		// wait-2 continua ai_pending e sozinho — não deve ter virado 'merged'.
		waitJob, err := mgr.ClaimAIPending(ctx, "test-worker-2")
		if err != nil {
			t.Fatalf("terceira ClaimAIPending falhou: %v", err)
		}
		if waitJob != nil {
			t.Fatalf("wait-2 ainda não deveria estar elegível (next_retry_at no futuro), mas foi reivindicado: %+v", waitJob)
		}
	})

	t.Run("pending_media_layer_nao_sofre_coalescencia", func(t *testing.T) {
		// Camada de mídia (status='pending') não tem dreno — comportamento
		// idêntico ao pré-DT-68: um job por claim, sem olhar para irmãos.
		phone := uniqueTestPhone()
		defer deleteTestJobsByPhone(t, localURL, serviceRoleKey, phone)
		msgID1, msgID2 := testMsgID("media-1", phone), testMsgID("media-2", phone)
		insertPendingJob(t, localURL, serviceRoleKey, phone, msgID1, -2*time.Second)
		insertPendingJob(t, localURL, serviceRoleKey, phone, msgID2, -1*time.Second)

		job, err := mgr.Claim(ctx, "test-worker-1")
		if err != nil {
			t.Fatalf("Claim (pending) falhou: %v", err)
		}
		if job == nil {
			t.Fatalf("esperava reivindicar media-1")
		}
		if job.MsgID != msgID1 {
			t.Fatalf("esperava reivindicar o mais antigo (%s), obteve %s", msgID1, job.MsgID)
		}
		if job.PartsCount != 1 {
			t.Fatalf("parts_count = %d, esperava 1 — a camada de mídia não drena irmãos", job.PartsCount)
		}

		// media-2 continua pending e disponível para o próximo claim isolado.
		job2, err := mgr.Claim(ctx, "test-worker-2")
		if err != nil {
			t.Fatalf("segundo Claim (pending) falhou: %v", err)
		}
		if job2 == nil || job2.MsgID != msgID2 {
			t.Fatalf("esperava reivindicar media-2 isoladamente, obteve %+v", job2)
		}
	})
}

// testPhoneCounter garante unicidade mesmo quando time.Now().UnixNano() repete
// entre chamadas: a resolução do relógio do Windows (~15ms) é grosseira o
// bastante para duas chamadas de uniqueTestPhone() em subtestes consecutivos
// devolverem o MESMO valor, contaminando um subteste com os dados inseridos
// pelo outro sob o mesmo "telefone" — foi exatamente o que aconteceu na
// primeira rodada destes testes (ver histórico em docs/debitos_tecnicos.md).
var testPhoneCounter uint64

func uniqueTestPhone() string {
	n := atomic.AddUint64(&testPhoneCounter, 1)
	suffix := (uint64(time.Now().UnixNano()) + n*7919) % 1_000_000_000
	return fmt.Sprintf("5511%09d", suffix)
}

// testMsgID monta um msg_id único combinando um rótulo legível com o telefone
// (já garantidamente único via uniqueTestPhone). Necessário desde que
// `idx_mq_msg_id` (índice único em message_queue.msg_id, aplicado ao staging
// em 2026-09-01 corrigindo um gap de dedup — ver docs/debitos_tecnicos.md)
// passou a existir: rótulos fixos como "buf-msg-1" colidiam entre execuções
// deste arquivo contra o mesmo banco, derrubando os testes com 409 Conflict
// na segunda rodada em diante.
func testMsgID(label, phone string) string {
	return label + "-" + phone
}

// insertAIPendingJob grava uma linha em message_queue já em ai_pending,
// simulando o estado que MarkAIPending produziria — mas com controle
// independente de created_at/next_retry_at, que MarkAIPending não expõe (de
// propósito: só ele decide isso em produção, a partir de
// MESSAGE_BUFFER_WINDOW/MESSAGE_BUFFER_MAX).
func insertAIPendingJob(t *testing.T, baseURL, key, phone, msgID, bodyText string, respondAudio bool, createdOffset, nextRetryOffset time.Duration) {
	t.Helper()
	insertJob(t, baseURL, key, phone, msgID, bodyText, "ai_pending", respondAudio, createdOffset, nextRetryOffset)
}

// insertPendingJob grava uma linha 'pending' (Camada de mídia, ainda sem
// body_text) para exercitar que o dreno não se aplica a essa camada.
func insertPendingJob(t *testing.T, baseURL, key, phone, msgID string, createdOffset time.Duration) {
	t.Helper()
	insertJob(t, baseURL, key, phone, msgID, "", "pending", false, createdOffset, createdOffset)
}

func insertJob(t *testing.T, baseURL, key, phone, msgID, bodyText, status string, respondAudio bool, createdOffset, nextRetryOffset time.Duration) {
	t.Helper()

	createdAt := time.Now().Add(createdOffset)
	nextRetryAt := time.Now().Add(nextRetryOffset)

	// Marshal de um ports.IncomingMessage de verdade, não JSON escrito à mão:
	// IncomingMessage não tem tags json (o marshal usa os nomes de campo Go
	// tal qual, ex: "ID" maiúsculo), e claimByStatus faz
	// json.Unmarshal(row.RawPayload, &msg) — um raw_payload mal formado faz o
	// job ser silenciosamente marcado failed (ver claimByStatus), mascarando
	// o teste.
	rawMsg := ports.IncomingMessage{
		ID:        msgID,
		From:      phone,
		Body:      bodyText,
		Type:      "text",
		Timestamp: createdAt,
	}
	rawPayload, err := json.Marshal(rawMsg)
	if err != nil {
		t.Fatalf("falha ao serializar raw_payload de teste: %v", err)
	}

	record := map[string]interface{}{
		"msg_id":        msgID,
		"from_phone":    phone,
		"raw_payload":   json.RawMessage(rawPayload),
		"body_text":     bodyText,
		"respond_audio": respondAudio,
		"status":        status,
		"created_at":    createdAt.UTC().Format(time.RFC3339Nano),
		"next_retry_at": nextRetryAt.UTC().Format(time.RFC3339Nano),
	}

	payload, err := json.Marshal(record)
	if err != nil {
		t.Fatalf("falha ao serializar job de teste: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/rest/v1/message_queue", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("falha ao montar request de insert: %v", err)
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("falha ao inserir job de teste: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		t.Fatalf("insert de job de teste falhou (status %d)", resp.StatusCode)
	}
}

// TestMessageQueue_MarkAIPending_BufferMath_RealPostgreSQL_Integration cobre
// os itens (d)/(e) da Fase 5 do PLAN: o cálculo de next_retry_at que
// MarkAIPending grava, isolado do dreno de claim (que já é coberto acima).
func TestMessageQueue_MarkAIPending_BufferMath_RealPostgreSQL_Integration(t *testing.T) {
	localURL, serviceRoleKey := testSupabaseConn()
	ctx := context.Background()

	t.Run("window_zero_e_kill_switch_imediato", func(t *testing.T) {
		mgr := NewManager(localURL, serviceRoleKey)
		mgr.SetBufferConfig(0, 0)

		phone := uniqueTestPhone()
		defer deleteTestJobsByPhone(t, localURL, serviceRoleKey, phone)
		jobID := insertRawJobForMarkAIPending(t, localURL, serviceRoleKey, phone, testMsgID("kill-switch-1", phone))

		if err := mgr.MarkAIPending(ctx, jobID, "texto", false, time.Now()); err != nil {
			t.Fatalf("MarkAIPending falhou: %v", err)
		}

		nextRetryAt := fetchNextRetryAt(t, localURL, serviceRoleKey, jobID)
		if nextRetryAt.After(time.Now().Add(2 * time.Second)) {
			t.Fatalf("MESSAGE_BUFFER_WINDOW=0 deveria deixar o job elegível de imediato, next_retry_at ficou no futuro: %s", nextRetryAt)
		}
	})

	t.Run("buffer_max_vence_quando_menor_que_window", func(t *testing.T) {
		mgr := NewManager(localURL, serviceRoleKey)
		mgr.SetBufferConfig(30*time.Second, 2*time.Second) // max intencionalmente menor que window

		phone := uniqueTestPhone()
		defer deleteTestJobsByPhone(t, localURL, serviceRoleKey, phone)
		jobID := insertRawJobForMarkAIPending(t, localURL, serviceRoleKey, phone, testMsgID("max-cap-1", phone))

		createdAt := time.Now().Add(-1 * time.Second) // fragmento "chegou" 1s atrás
		if err := mgr.MarkAIPending(ctx, jobID, "texto", false, createdAt); err != nil {
			t.Fatalf("MarkAIPending falhou: %v", err)
		}

		nextRetryAt := fetchNextRetryAt(t, localURL, serviceRoleKey, jobID)
		wantCeiling := createdAt.Add(2 * time.Second)
		if nextRetryAt.After(wantCeiling.Add(2 * time.Second)) {
			t.Fatalf("next_retry_at (%s) deveria respeitar o teto createdAt+bufferMax (%s) mesmo com bufferWindow maior, mas passou muito do teto", nextRetryAt, wantCeiling)
		}
		floor := time.Now().Add(25 * time.Second) // se window (30s) tivesse vencido, estaria bem além disto
		if nextRetryAt.After(floor) {
			t.Fatalf("next_retry_at (%s) parece ter usado bufferWindow (30s) em vez do teto bufferMax (2s) — cap não aplicado", nextRetryAt)
		}
	})
}

// TestMessageQueue_BufferDrain_Concurrency_RealPostgreSQL_Integration cobre o
// item (b) da Fase 5 do PLAN: N workers disputando a mesma rajada de
// fragmentos precisam produzir exatamente UM turno combinado, sem perder
// nem duplicar texto — é o cenário que valida o FOR UPDATE SKIP LOCKED do
// dreno sob concorrência real, não só a lógica sequencial.
func TestMessageQueue_BufferDrain_Concurrency_RealPostgreSQL_Integration(t *testing.T) {
	localURL, serviceRoleKey := testSupabaseConn()
	mgr := NewManager(localURL, serviceRoleKey)
	ctx := context.Background()

	phone := uniqueTestPhone()
	defer deleteTestJobsByPhone(t, localURL, serviceRoleKey, phone)
	fragments := []string{"um", "dois", "tres", "quatro", "cinco"}
	for i, text := range fragments {
		offset := time.Duration(-(len(fragments)-i)) * time.Second // ordem crescente, todos já elegíveis
		insertAIPendingJob(t, localURL, serviceRoleKey, phone, testMsgID(fmt.Sprintf("race-%d", i), phone), text, false, offset, offset)
	}

	const numWorkers = 5 // >= len(fragments): mais disputa do que fragmentos possíveis
	var wg sync.WaitGroup
	results := make(chan *Job, numWorkers)
	errs := make(chan error, numWorkers)

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			job, err := mgr.ClaimAIPending(ctx, fmt.Sprintf("race-worker-%d", workerID))
			if err != nil {
				errs <- err
				return
			}
			results <- job
		}(w)
	}
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		t.Fatalf("worker retornou erro: %v", err)
	}

	// Filtra por telefone: a tabela é compartilhada com outros testes deste
	// arquivo rodando na mesma bateria, então um worker "sobrando" (temos 5
	// workers para 5 fragmentos, de propósito, mais disputa que trabalho) pode
	// legitimamente reivindicar um job de OUTRO teste caso ele deixe alguma
	// linha 'ai_pending' elegível para trás. Isso não é falha da coalescência
	// desta rajada — só ruído de outro teste. O que importa é quantos workers
	// reivindicaram ESTE telefone especificamente.
	var claimed []*Job
	for job := range results {
		if job != nil && job.FromPhone == phone {
			claimed = append(claimed, job)
		}
	}

	if len(claimed) != 1 {
		t.Fatalf("esperava exatamente 1 worker reivindicar o turno combinado desta rajada, %d reivindicaram", len(claimed))
	}

	wantText := "um\ndois\ntres\nquatro\ncinco"
	if claimed[0].BodyText != wantText {
		t.Fatalf("body_text combinado incorreto sob concorrência:\n  got:  %q\n  want: %q", claimed[0].BodyText, wantText)
	}
	if claimed[0].PartsCount != len(fragments) {
		t.Fatalf("parts_count = %d, esperava %d (nenhum fragmento perdido nem duplicado)", claimed[0].PartsCount, len(fragments))
	}
}

// deleteTestJobsByPhone remove TODAS as linhas de message_queue de um
// telefone de teste, qualquer que seja o status final (reivindicado,
// 'ai_pending' órfão, 'merged' etc.). Sem isto, cada execução destes testes
// deixa lixo permanente na tabela — inofensivo contra o Postgres local
// (descartável), mas real contra SUPABASE_TEST_URL apontado para staging:
// infraestrutura compartilhada, sem limpeza automática para linhas fora de
// done/merged (`cleanup_message_queue` só varre essas duas). Também é o que
// evita a contaminação cruzada entre subtestes que já causou uma falha
// intermitente no teste de concorrência (ver histórico em
// docs/debitos_tecnicos.md).
func deleteTestJobsByPhone(t *testing.T, baseURL, key, phone string) {
	t.Helper()
	req, err := http.NewRequest(http.MethodDelete, baseURL+"/rest/v1/message_queue?from_phone=eq."+phone, nil)
	if err != nil {
		t.Logf("falha ao montar limpeza por telefone (não fatal): %v", err)
		return
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Logf("falha ao limpar jobs do telefone %s (não fatal): %v", phone, err)
		return
	}
	defer resp.Body.Close()
}

// insertRawJobForMarkAIPending cria um job com id conhecido (gerado no
// cliente, aceito pelo DEFAULT gen_random_uuid() da coluna) para que o teste
// possa chamar MarkAIPending diretamente sobre ele, sem passar por ClaimAIPending.
func insertRawJobForMarkAIPending(t *testing.T, baseURL, key, phone, msgID string) string {
	t.Helper()
	jobID := uuid.NewString()

	rawMsg := ports.IncomingMessage{ID: msgID, From: phone, Body: "", Type: "text"}
	rawPayload, err := json.Marshal(rawMsg)
	if err != nil {
		t.Fatalf("falha ao serializar raw_payload: %v", err)
	}

	record := map[string]interface{}{
		"id":          jobID,
		"msg_id":      msgID,
		"from_phone":  phone,
		"raw_payload": json.RawMessage(rawPayload),
		"status":      "processing",
	}
	payload, err := json.Marshal(record)
	if err != nil {
		t.Fatalf("falha ao serializar job de teste: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, baseURL+"/rest/v1/message_queue", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("falha ao montar request de insert: %v", err)
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("falha ao inserir job de teste: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		t.Fatalf("insert de job de teste falhou (status %d)", resp.StatusCode)
	}
	return jobID
}

// fetchNextRetryAt lê next_retry_at diretamente via PostgREST para inspecionar
// o efeito de MarkAIPending sem depender de ClaimAIPending (que aplicaria o
// próprio portão next_retry_at <= NOW() e esconderia o valor gravado).
func fetchNextRetryAt(t *testing.T, baseURL, key, jobID string) time.Time {
	t.Helper()

	req, err := http.NewRequest(http.MethodGet, baseURL+"/rest/v1/message_queue?id=eq."+jobID+"&select=next_retry_at", nil)
	if err != nil {
		t.Fatalf("falha ao montar request de leitura: %v", err)
	}
	req.Header.Set("apikey", key)
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Accept", "application/vnd.pgrst.object+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("falha ao ler job de teste: %v", err)
	}
	defer resp.Body.Close()

	var row struct {
		NextRetryAt time.Time `json:"next_retry_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&row); err != nil {
		t.Fatalf("falha ao decodificar next_retry_at: %v", err)
	}
	return row.NextRetryAt
}
