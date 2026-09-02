//go:build real_postgres

// Requer Postgres/PostgREST real (supabase start local ou SUPABASE_TEST_URL/
// SUPABASE_TEST_SERVICE_KEY) — não roda em CI (DT-30). Local:
//
//	go test -tags=real_postgres ./internal/guardrails/...

package guardrails_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/guardrails"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func setupRealPostgresUser(t *testing.T, localURL, serviceRoleKey string) (profileID, phone string, pmoID, propID int64, client *supabase.Client) {
	var err error
	client, err = supabase.NewClient(supabase.Config{
		URL: localURL,
		Key: serviceRoleKey,
	})
	if err != nil {
		t.Fatalf("Falha ao instanciar client Supabase: %v", err)
	}

	ctx := context.Background()
	uniqueSuffix := time.Now().UnixNano()
	phone = fmt.Sprintf("5511%09d", uniqueSuffix%1000000000)
	email := fmt.Sprintf("produtor-%d@manejo.org", uniqueSuffix)

	authURL := localURL + "/auth/v1/admin/users"
	authBody, _ := json.Marshal(map[string]interface{}{
		"email":         email,
		"phone":         phone,
		"email_confirm": true,
		"phone_confirm": true,
	})
	authReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, authURL, bytes.NewReader(authBody))
	authReq.Header.Set("apikey", serviceRoleKey)
	authReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	authReq.Header.Set("Content-Type", "application/json")
	authResp, err := http.DefaultClient.Do(authReq)
	if err != nil {
		t.Fatalf("Falha no auth admin: %v", err)
	}
	defer authResp.Body.Close()

	var authUser struct {
		ID string `json:"id"`
	}
	json.NewDecoder(authResp.Body).Decode(&authUser)
	profileID = authUser.ID
	if profileID == "" {
		t.Fatalf("Falha ao obter ID do usuário criado no Auth")
	}

	// Criar Profile
	profileURL := localURL + "/rest/v1/profiles"
	profBody, _ := json.Marshal(map[string]interface{}{
		"id":       profileID,
		"telefone": phone,
		"nome":     "Produtor HITL Teste",
		"role":     "produtor",
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, profileURL, bytes.NewReader(profBody))
	req.Header.Set("apikey", serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")
	http.DefaultClient.Do(req)

	propID, pmoID, err = client.CriarPropriedadeComPMO(ctx, profileID, "Fazenda HITL Staging", 20.0, "Holambra", "SP", "ORGANICO")
	if err != nil {
		t.Fatalf("Falha ao criar propriedade/PMO: %v", err)
	}

	return profileID, phone, pmoID, propID, client
}

func TestMutationDrafts_RealPostgreSQL_Integration(t *testing.T) {
	localURL := "http://127.0.0.1:54321"
	serviceRoleKey := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

	profileID, phone, pmoID, propID, client := setupRealPostgresUser(t, localURL, serviceRoleKey)
	hitlCtrl := guardrails.NewHITLController(localURL, serviceRoleKey)
	ctx := context.Background()

	t.Run("1_PartialUniqueIndex_And_AtomicSupersede", func(t *testing.T) {
		ops1 := []domain.BatchMutationItem{
			{
				Type: "compra_insumo",
				Payload: map[string]interface{}{
					"produto":            "Esterco Bovino",
					"quantidade_valor":   10.0,
					"quantidade_unidade": "sacos",
					"valor_total":        250.0,
				},
			},
		}

		draftID1, sup1, err := hitlCtrl.CreateOrSupersedeDraft(ctx, pmoID, profileID, phone, ops1, "Primeiro rascunho", 45)
		if err != nil {
			t.Fatalf("Erro ao criar 1º rascunho: %v", err)
		}
		if sup1 != nil {
			t.Fatalf("Esperava nenhum superseded no 1º rascunho, obteve %v", *sup1)
		}

		// Segundo rascunho para o mesmo (phone, pmoID) -> deve superseder o primeiro atomicamente
		ops2 := []domain.BatchMutationItem{
			{
				Type: "compra_insumo",
				Payload: map[string]interface{}{
					"produto":            "Esterco Bovino",
					"quantidade_valor":   15.0,
					"quantidade_unidade": "sacos",
					"valor_total":        375.0,
				},
			},
		}

		draftID2, sup2, err := hitlCtrl.CreateOrSupersedeDraft(ctx, pmoID, profileID, phone, ops2, "Segundo rascunho ajustado", 45)
		if err != nil {
			t.Fatalf("Erro ao criar 2º rascunho: %v", err)
		}
		if sup2 == nil || *sup2 != draftID1 {
			t.Fatalf("Esperava que o 2º rascunho supersedesse o 1º (%s), obteve %v", draftID1, sup2)
		}

		// Validar que apenas o 2º rascunho está 'pending'
		pendingDraft, err := hitlCtrl.FindPendingDraft(ctx, phone, pmoID)
		if err != nil {
			t.Fatalf("Erro ao buscar rascunho pendente: %v", err)
		}
		if pendingDraft == nil || pendingDraft.ID != draftID2 {
			t.Fatalf("Esperava encontrar rascunho pendente %s, obteve: %v", draftID2, pendingDraft)
		}
	})

	t.Run("2_MultiTenant_Isolation", func(t *testing.T) {
		// Criar uma segunda PMO para o mesmo usuário
		_, pmoID2, err := client.CriarPropriedadeComPMO(ctx, profileID, "Fazenda 2", 10.0, "Artur Nogueira", "SP", "ORGANICO")
		if err != nil {
			t.Fatalf("Erro ao criar 2ª propriedade: %v", err)
		}

		ops := []domain.BatchMutationItem{
			{
				Type: "compra_insumo",
				Payload: map[string]interface{}{
					"produto":            "Calcário",
					"quantidade_valor":   5.0,
					"quantidade_unidade": "sacos",
					"valor_total":        100.0,
				},
			},
		}

		draftID_PMO2, _, err := hitlCtrl.CreateOrSupersedeDraft(ctx, pmoID2, profileID, phone, ops, "Rascunho PMO 2", 45)
		if err != nil {
			t.Fatalf("Erro ao criar rascunho PMO 2: %v", err)
		}

		// Busca por PMO 1
		p1, err := hitlCtrl.FindPendingDraft(ctx, phone, pmoID)
		if err != nil || p1 == nil {
			t.Fatalf("Falha ao buscar pendente PMO 1: %v", err)
		}

		// Busca por PMO 2
		p2, err := hitlCtrl.FindPendingDraft(ctx, phone, pmoID2)
		if err != nil || p2 == nil {
			t.Fatalf("Falha ao buscar pendente PMO 2: %v", err)
		}

		if p1.ID == p2.ID {
			t.Fatalf("Rascunhos de PMOs diferentes colidiram! p1=%s p2=%s", p1.ID, p2.ID)
		}
		if p2.ID != draftID_PMO2 {
			t.Fatalf("Esperava draftID_PMO2=%s, obteve=%s", draftID_PMO2, p2.ID)
		}
	})

	t.Run("3_AtomicExecution_4_Operations_HappyPath", func(t *testing.T) {
		// Criar organização cooperativa e demanda coletiva para testar cota
		coopURL := localURL + "/rest/v1/organizacoes"
		coopBody, _ := json.Marshal(map[string]interface{}{
			"nome": fmt.Sprintf("Cooperativa Teste %d", time.Now().UnixNano()),
			"tipo": "cooperativa",
		})
		coopReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, coopURL, bytes.NewReader(coopBody))
		coopReq.Header.Set("apikey", serviceRoleKey)
		coopReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
		coopReq.Header.Set("Content-Type", "application/json")
		coopReq.Header.Set("Prefer", "return=representation")
		coopResp, err := http.DefaultClient.Do(coopReq)
		if err != nil {
			t.Fatalf("Falha ao criar cooperativa: %v", err)
		}
		defer coopResp.Body.Close()
		var createdCoop []struct {
			ID int64 `json:"id"`
		}
		json.NewDecoder(coopResp.Body).Decode(&createdCoop)
		coopID := createdCoop[0].ID

		demandaURL := localURL + "/rest/v1/demandas_coletivas"
		demandaBody, _ := json.Marshal(map[string]interface{}{
			"titulo":             fmt.Sprintf("Demanda Teste %d", time.Now().UnixNano()),
			"cultura":            "Alface Crespa",
			"unidade":            "unidades",
			"quantidade_total":   5000.0,
			"data_entrega":       "2026-10-01",
			"status":             "aberta",
			"modalidade_exigida": "ORGANICO",
			"criado_por":         profileID,
			"cooperativa_id":     coopID,
		})
		demReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, demandaURL, bytes.NewReader(demandaBody))
		demReq.Header.Set("apikey", serviceRoleKey)
		demReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
		demReq.Header.Set("Content-Type", "application/json")
		demReq.Header.Set("Prefer", "return=representation")
		demResp, err := http.DefaultClient.Do(demReq)
		if err != nil {
			t.Fatalf("Falha ao criar demanda: %v", err)
		}
		defer demResp.Body.Close()
		var createdDemanda []struct {
			ID string `json:"id"`
		}
		json.NewDecoder(demResp.Body).Decode(&createdDemanda)
		demandaID := createdDemanda[0].ID

		opsBatch := []domain.BatchMutationItem{
			{
				Type: "caderno_campo",
				TipoOperacao: "plantio",
				Payload: map[string]interface{}{
					"produto":            "Alface Crespa",
					"quantidade_valor":   500.0,
					"quantidade_unidade": "mudas",
					"talhao_nome":        "Talhão 1",
				},
			},
			{
				Type: "compra_insumo",
				Payload: map[string]interface{}{
					"produto":            "Substrato Orgânico",
					"quantidade_valor":   20.0,
					"quantidade_unidade": "sacos",
					"valor_total":        600.0,
					"propriedade_id":     propID,
				},
			},
			{
				Type: "transacoes_com_rateio",
				Payload: map[string]interface{}{
					"tipo":               "despesa",
					"valor_total":        300.0,
					"fornecedor_cliente": "Mudas do Vale",
					"descricao":          "Compra de mudas de alface",
					"propriedade_id":     propID,
				},
			},
			{
				Type: "cotas_produtores",
				Payload: map[string]interface{}{
					"demanda_id":     demandaID,
					"propriedade_id": propID,
					"quantidade":     500.0,
					"data_plantio":   "2026-08-20",
					"observacao":     "Compromisso cota cooperativa",
				},
			},
		}

		draftID, _, err := hitlCtrl.CreateOrSupersedeDraft(ctx, pmoID, profileID, phone, opsBatch, "Lote 4 Operações", 45)
		if err != nil {
			t.Fatalf("Erro ao criar rascunho com 4 operações: %v", err)
		}

		// Executar Commit
		commitRes, err := hitlCtrl.CommitDraft(ctx, draftID, profileID, pmoID)
		if err != nil {
			t.Fatalf("Erro ao executar commit_mutation_draft: %v", err)
		}

		if commitRes.Status != "approved" {
			t.Fatalf("Esperava status approved, obteve %s (detail: %s)", commitRes.Status, commitRes.ErrorDetail)
		}

		if len(commitRes.Results) != 4 {
			t.Fatalf("Esperava 4 resultados, obteve %d", len(commitRes.Results))
		}

		// Idempotência: Chamar commit novamente no mesmo draft
		commitRes2, err := hitlCtrl.CommitDraft(ctx, draftID, profileID, pmoID)
		if err != nil {
			t.Fatalf("Erro na 2ª chamada de commit: %v", err)
		}
		if commitRes2.Status != "already_approved" {
			t.Fatalf("Esperava status already_approved na 2ª chamada, obteve: %s", commitRes2.Status)
		}
	})

	t.Run("4_PartialFailure_SubBlockException_Persistence", func(t *testing.T) {
		opsFail := []domain.BatchMutationItem{
			{
				Type: "caderno_campo",
				TipoOperacao: "plantio",
				Payload: map[string]interface{}{
					"produto":            "Couve Manteiga",
					"quantidade_valor":   100.0,
					"quantidade_unidade": "mudas",
					"talhao_nome":        "Talhão 1",
				},
			},
			{
				Type: "tipo_inexistente_que_vai_falhar",
				Payload: map[string]interface{}{
					"foo": "bar",
				},
			},
		}

		draftIDFail, _, err := hitlCtrl.CreateOrSupersedeDraft(ctx, pmoID, profileID, phone, opsFail, "Rascunho que deve falhar", 45)
		if err != nil {
			t.Fatalf("Erro ao criar rascunho com falha: %v", err)
		}

		// Executar commit — deve retornar status 'failed' normalmente (sem estourar erro de conexão)
		commitRes, err := hitlCtrl.CommitDraft(ctx, draftIDFail, profileID, pmoID)
		if err != nil {
			t.Fatalf("CommitDraft retornou erro de transporte inesperado: %v", err)
		}

		if commitRes.Status != "failed" {
			t.Fatalf("Esperava status 'failed', obteve: %s", commitRes.Status)
		}

		if commitRes.ErrorDetail == "" {
			t.Fatalf("Esperava error_detail preenchido com a mensagem de erro da subtransação")
		}

		// Verificar que o estado no DB é terminal ('failed')
		checkReq, _ := http.NewRequestWithContext(ctx, http.MethodGet, localURL+fmt.Sprintf("/rest/v1/mutation_drafts?id=eq.%s", draftIDFail), nil)
		checkReq.Header.Set("apikey", serviceRoleKey)
		checkReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
		checkReq.Header.Set("Accept", "application/json")
		checkResp, err := http.DefaultClient.Do(checkReq)
		if err != nil {
			t.Fatalf("Erro ao consultar DB: %v", err)
		}
		defer checkResp.Body.Close()

		var dbRecords []domain.MutationDraftRecord
		json.NewDecoder(checkResp.Body).Decode(&dbRecords)
		if len(dbRecords) == 0 {
			t.Fatalf("Rascunho não encontrado no DB")
		}
		if dbRecords[0].Status != domain.DraftStatusFailed {
			t.Fatalf("Esperava status persistido no DB como 'failed', obteve: %s", dbRecords[0].Status)
		}

		// Terminalidade: Nova tentativa de commit deve recusar
		retryRes, _ := hitlCtrl.CommitDraft(ctx, draftIDFail, profileID, pmoID)
		if retryRes.Status != "failed" {
			t.Fatalf("Esperava recusa terminal de retry, obteve: %s", retryRes.Status)
		}
	})

	t.Run("5_Real_Concurrency_Commit_LockForUpdate", func(t *testing.T) {
		opsConc := []domain.BatchMutationItem{
			{
				Type: "compra_insumo",
				Payload: map[string]interface{}{
					"produto":            "Adubo Foliar Concorrente",
					"quantidade_valor":   2.0,
					"quantidade_unidade": "litros",
					"valor_total":        150.0,
					"propriedade_id":     propID,
				},
			},
		}

		draftIDConc, _, err := hitlCtrl.CreateOrSupersedeDraft(ctx, pmoID, profileID, phone, opsConc, "Teste Concorrência", 45)
		if err != nil {
			t.Fatalf("Erro ao criar rascunho concorrente: %v", err)
		}

		var wg sync.WaitGroup
		results := make([]domain.CommitMutationResult, 2)
		errors := make([]error, 2)

		wg.Add(2)
		for i := 0; i < 2; i++ {
			idx := i
			go func() {
				defer wg.Done()
				results[idx], errors[idx] = hitlCtrl.CommitDraft(context.Background(), draftIDConc, profileID, pmoID)
			}()
		}
		wg.Wait()

		for i := 0; i < 2; i++ {
			if errors[i] != nil {
				t.Fatalf("Erro na goroutine %d: %v", i, errors[i])
			}
		}

		// Uma deve ser approved e a outra already_approved (ou ambas approved/already_approved sem duplicação)
		statuses := fmt.Sprintf("%s-%s", results[0].Status, results[1].Status)
		if statuses != "approved-already_approved" && statuses != "already_approved-approved" && statuses != "approved-approved" {
			t.Fatalf("Combinação inesperada de status concorrentes: %s", statuses)
		}
	})
}
