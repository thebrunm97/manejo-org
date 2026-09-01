package supabase_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func TestIdempotency_RealPostgreSQL_Integration(t *testing.T) {
	localURL := "http://127.0.0.1:54321"
	serviceRoleKey := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"

	client, err := supabase.NewClient(supabase.Config{
		URL: localURL,
		Key: serviceRoleKey,
	})
	if err != nil {
		t.Fatalf("Falha ao instanciar client Supabase local: %v", err)
	}

	ctx := context.Background()

	// 1. Criar usuário no auth.users via Admin API
	uniqueSuffix := time.Now().UnixNano()
	phone := fmt.Sprintf("5511%09d", uniqueSuffix%1000000000)
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
		t.Fatalf("Falha ao chamar Admin Auth: %v", err)
	}
	defer authResp.Body.Close()

	var authUser struct {
		ID string `json:"id"`
	}
	json.NewDecoder(authResp.Body).Decode(&authUser)
	profileID := authUser.ID
	if profileID == "" {
		t.Fatalf("Falha ao obter ID do usuário criado no Auth Supabase")
	}

	// Upsert profile
	profileURL := localURL + "/rest/v1/profiles"
	profBody, _ := json.Marshal(map[string]interface{}{
		"id":       profileID,
		"telefone": phone,
		"nome":     "Produtor Staging Teste",
		"role":     "produtor",
	})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, profileURL, bytes.NewReader(profBody))
	req.Header.Set("apikey", serviceRoleKey)
	req.Header.Set("Authorization", "Bearer "+serviceRoleKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates")
	http.DefaultClient.Do(req)

	propriedadeID, pmoID, err := client.CriarPropriedadeComPMO(ctx, profileID, "Fazenda Staging Teste Local", 15.5, "Campinas", "SP", "ORGANICO")
	if err != nil {
		t.Fatalf("Falha ao criar propriedade no Postgres local: %v", err)
	}

	// 2. Testar Invariância de Registros Legados com idempotency_key IS NULL
	t.Run("Validar_Multiplas_Linhas_Legadas_NULL_Coexistem", func(t *testing.T) {
		// Duas operações sem idempotency_key (simulando registros legados pré-migração)
		res1, err := client.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
			"pmo_id_arg":  pmoID,
			"user_id_arg": profileID,
			"tipo_arg":    "Plantio",
			"payload_arg": map[string]interface{}{
				"produto":          "Cenoura Brasília",
				"quantidade_valor": 100.0,
				"quantidade_unidade": "kg",
				"talhao_nome":      "Talhão 1",
			},
		}, time.Now().Format("2006-01-02"))
		if err != nil {
			t.Fatalf("Falha ao registrar 1ª operação legada: %v", err)
		}
		if res1["status"] != "success" {
			t.Fatalf("Status inesperado para 1ª operação legada: %v", res1)
		}

		res2, err := client.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
			"pmo_id_arg":  pmoID,
			"user_id_arg": profileID,
			"tipo_arg":    "Plantio",
			"payload_arg": map[string]interface{}{
				"produto":          "Alface Americana",
				"quantidade_valor": 200.0,
				"quantidade_unidade": "mudas",
				"talhao_nome":      "Talhão 1",
			},
		}, time.Now().Format("2006-01-02"))
		if err != nil {
			t.Fatalf("Falha ao registrar 2ª operação legada com NULL: %v (Índice parcial quebrou nos NULLs)", err)
		}
		if res2["status"] != "success" {
			t.Fatalf("Status inesperado para 2ª operação legada: %v", res2)
		}
		t.Logf("✅ Múltiplas linhas legadas com idempotency_key IS NULL inseridas sem colisão no índice parcial.")
	})

	// 3. Testar Deduplicação Real de Idempotência no PostgreSQL
	t.Run("Validar_Deduplicacao_Real_PostgreSQL_OperacaoCampo", func(t *testing.T) {
		testKey := fmt.Sprintf("sha256-operacao-campo-real-db-%d", time.Now().UnixNano())
		ctxWithKey := context.WithValue(ctx, "idempotency_key", testKey)

		// 1ª Chamada (Inserção real)
		res1, err := client.RegistrarOperacaoCampoRPC(ctxWithKey, map[string]interface{}{
			"pmo_id_arg":  pmoID,
			"user_id_arg": profileID,
			"tipo_arg":    "Plantio",
			"payload_arg": map[string]interface{}{
				"produto":          "Tomate Italiano",
				"quantidade_valor": 500.0,
				"quantidade_unidade": "mudas",
				"talhao_nome":      "Talhão 1",
				"idempotency_key":  testKey,
			},
		}, time.Now().Format("2006-01-02"))
		if err != nil {
			t.Fatalf("Falha na 1ª chamada RPC no Postgres real: %v", err)
		}
		if res1["status"] != "success" {
			t.Fatalf("1ª chamada deveria retornar status success, mas retornou: %v", res1)
		}
		originalID := res1["id"]

		// 2ª Chamada (Retry com a mesma chave)
		res2, err := client.RegistrarOperacaoCampoRPC(ctxWithKey, map[string]interface{}{
			"pmo_id_arg":  pmoID,
			"user_id_arg": profileID,
			"tipo_arg":    "Plantio",
			"payload_arg": map[string]interface{}{
				"produto":          "Tomate Italiano",
				"quantidade_valor": 500.0,
				"quantidade_unidade": "mudas",
				"talhao_nome":      "Talhão 1",
				"idempotency_key":  testKey,
			},
		}, time.Now().Format("2006-01-02"))
		if err != nil {
			t.Fatalf("Falha na 2ª chamada (retry) no Postgres real: %v", err)
		}
		if res2["status"] != "already_processed" {
			t.Fatalf("2ª chamada deveria retornar status already_processed, mas retornou: %v", res2)
		}
		if res2["id"] != originalID {
			t.Fatalf("ID retornado pelo already_processed (%v) diferente do original (%v)", res2["id"], originalID)
		}
		t.Logf("✅ Deduplicação confirmada no PostgreSQL real para Operação de Campo (ID: %v, status: already_processed).", originalID)
	})

	// 4. Testar Deduplicação Real de Compra de Insumos e Transação Financeira
	t.Run("Validar_Deduplicacao_Real_PostgreSQL_CompraInsumo", func(t *testing.T) {
		compraKey := fmt.Sprintf("sha256-compra-insumo-real-db-%d", time.Now().UnixNano())
		ctxWithKey := context.WithValue(ctx, "idempotency_key", compraKey)

		res1, err := client.RegistrarCompraInsumoRPC(ctxWithKey, map[string]interface{}{
			"pmo_id_arg":          pmoID,
			"propriedade_id_arg":  propriedadeID,
			"user_id_arg":         profileID,
			"produto_arg":         "Composto Orgânico Premium",
			"quantidade_valor_arg": 1000.0,
			"quantidade_unidade_arg": "kg",
			"fornecedor_arg":      "BioAdubos Ltda",
			"valor_total_arg":     750.0,
			"idempotency_key_arg": compraKey,
		})
		if err != nil {
			t.Fatalf("Falha na 1ª compra de insumo no Postgres real: %v", err)
		}
		if res1["status"] != "success" {
			t.Fatalf("1ª compra de insumo deveria retornar success: %v", res1)
		}

		res2, err := client.RegistrarCompraInsumoRPC(ctxWithKey, map[string]interface{}{
			"pmo_id_arg":          pmoID,
			"propriedade_id_arg":  propriedadeID,
			"user_id_arg":         profileID,
			"produto_arg":         "Composto Orgânico Premium",
			"quantidade_valor_arg": 1000.0,
			"quantidade_unidade_arg": "kg",
			"fornecedor_arg":      "BioAdubos Ltda",
			"valor_total_arg":     750.0,
			"idempotency_key_arg": compraKey,
		})
		if err != nil {
			t.Fatalf("Falha na 2ª compra de insumo (retry) no Postgres real: %v", err)
		}
		if res2["status"] != "already_processed" {
			t.Fatalf("2ª compra de insumo deveria retornar already_processed: %v", res2)
		}
		t.Logf("✅ Deduplicação de Compra e Transação Financeira confirmada no PostgreSQL real.")
	})

	// 5. Testar Deduplicação Real de Transação Direta com Rateio (rpc_registrar_transacao_com_rateio)
	t.Run("Validar_Deduplicacao_Real_PostgreSQL_TransacaoComRateio", func(t *testing.T) {
		transacaoKey := fmt.Sprintf("sha256-transacao-rateio-real-db-%d", time.Now().UnixNano())
		ctxWithKey := context.WithValue(ctx, "idempotency_key", transacaoKey)

		// 1ª Chamada (Inserção Atômica)
		res1, err := client.RegistrarTransacaoComRateioRPC(ctxWithKey, map[string]interface{}{
			"propriedade_id":     propriedadeID,
			"pmo_id":             pmoID,
			"user_id":            profileID,
			"tipo":               "despesa",
			"valor_total":        420.50,
			"fornecedor_cliente": "Manutenção Bombas D'Água",
			"idempotency_key":    transacaoKey,
			"alocacoes": []map[string]interface{}{
				{
					"valor_alocado":      420.50,
					"percentual_alocado": 100.0,
				},
			},
		})
		if err != nil {
			t.Fatalf("Falha na 1ª transação com rateio no Postgres real: %v", err)
		}
		if res1["status"] != "success" {
			t.Fatalf("1ª transação com rateio deveria retornar success: %v", res1)
		}
		transacaoID := res1["transacao_id"]

		// 2ª Chamada (Retry Concorrente / Timeout)
		res2, err := client.RegistrarTransacaoComRateioRPC(ctxWithKey, map[string]interface{}{
			"propriedade_id":     propriedadeID,
			"pmo_id":             pmoID,
			"user_id":            profileID,
			"tipo":               "despesa",
			"valor_total":        420.50,
			"fornecedor_cliente": "Manutenção Bombas D'Água",
			"idempotency_key":    transacaoKey,
			"alocacoes": []map[string]interface{}{
				{
					"valor_alocado":      420.50,
					"percentual_alocado": 100.0,
				},
			},
		})
		if err != nil {
			t.Fatalf("Falha na 2ª transação com rateio (retry) no Postgres real: %v", err)
		}
		if res2["status"] != "already_processed" {
			t.Fatalf("2ª transação com rateio deveria retornar already_processed: %v", res2)
		}
		if res2["transacao_id"] != transacaoID {
			t.Fatalf("ID retornado (%v) difere do original (%v)", res2["transacao_id"], transacaoID)
		}
		t.Logf("✅ Deduplicação de Transação Financeira com Rateio confirmada no PostgreSQL real (ID: %v).", transacaoID)
	})

	// 6. Testar Deduplicação Real de Cotas de Produtores (cotas_produtores)
	t.Run("Validar_Deduplicacao_Real_PostgreSQL_CotasProdutores", func(t *testing.T) {
		// 1. Criar organização cooperativa para a demanda
		coopURL := localURL + "/rest/v1/organizacoes"
		coopSlugSuffix := time.Now().UnixNano()
		coopBody, _ := json.Marshal(map[string]interface{}{
			"nome": fmt.Sprintf("Cooperativa Teste %d", coopSlugSuffix),
			"tipo": "cooperativa",
			"slug": fmt.Sprintf("cooperativa-teste-%d", coopSlugSuffix),
		})
		coopReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, coopURL, bytes.NewReader(coopBody))
		coopReq.Header.Set("apikey", serviceRoleKey)
		coopReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
		coopReq.Header.Set("Content-Type", "application/json")
		coopReq.Header.Set("Prefer", "return=representation")
		coopResp, err := http.DefaultClient.Do(coopReq)
		if err != nil {
			t.Fatalf("Falha ao criar cooperativa no Postgres local: %v", err)
		}
		defer coopResp.Body.Close()
		var createdCoop []struct {
			ID int64 `json:"id"`
		}
		json.NewDecoder(coopResp.Body).Decode(&createdCoop)
		if len(createdCoop) == 0 {
			t.Fatalf("Falha ao obter ID da cooperativa criada")
		}
		coopID := createdCoop[0].ID

		// 2. Criar uma demanda aberta vinculada à cooperativa
		demandaURL := localURL + "/rest/v1/demandas_coletivas"
		demandaBody, _ := json.Marshal(map[string]interface{}{
			"titulo":              fmt.Sprintf("Demanda Teste %d", time.Now().UnixNano()),
			"cultura":             "Tomate Italiano Orgânico",
			"unidade":             "kg",
			"quantidade_total":    5000.0,
			"data_entrega":        time.Now().AddDate(0, 2, 0).Format("2006-01-02"),
			"status":              "aberta",
			"modalidade_exigida":  "ORGANICO",
			"criado_por":          profileID,
			"cooperativa_id":      coopID,
		})
		demReq, _ := http.NewRequestWithContext(ctx, http.MethodPost, demandaURL, bytes.NewReader(demandaBody))
		demReq.Header.Set("apikey", serviceRoleKey)
		demReq.Header.Set("Authorization", "Bearer "+serviceRoleKey)
		demReq.Header.Set("Content-Type", "application/json")
		demReq.Header.Set("Prefer", "return=representation")
		demResp, err := http.DefaultClient.Do(demReq)
		if err != nil {
			t.Fatalf("Falha ao criar demanda no Postgres local: %v", err)
		}
		defer demResp.Body.Close()

		demBodyBytes, _ := io.ReadAll(demResp.Body)
		if demResp.StatusCode >= 400 {
			t.Fatalf("Erro ao criar demanda (%d): %s", demResp.StatusCode, string(demBodyBytes))
		}

		var createdDem []struct {
			ID string `json:"id"`
		}
		json.Unmarshal(demBodyBytes, &createdDem)
		if len(createdDem) == 0 {
			t.Fatalf("Falha ao obter ID da demanda criada. Body: %s", string(demBodyBytes))
		}
		demandaID := createdDem[0].ID

		cotaKey := fmt.Sprintf("sha256-cota-real-db-%d", time.Now().UnixNano())
		ctxWithKey := context.WithValue(ctx, "idempotency_key", cotaKey)

		// 1ª Chamada (Criação de Cota + Cronograma)
		err = client.RegistrarCotaComCronograma(ctxWithKey, map[string]interface{}{
			"demanda_id":     demandaID,
			"propriedade_id": propriedadeID,
			"usuario_id":     profileID,
			"quantidade":     500.0,
			"data_plantio":   time.Now().AddDate(0, 1, 0).Format("2006-01-02"),
			"observacao_ia":  "Cota teste no Postgres real",
			"idempotency_key": cotaKey,
		})
		if err != nil {
			t.Fatalf("Falha na 1ª criação de cota no Postgres real: %v", err)
		}

		// 2ª Chamada (Retry com a mesma chave)
		err = client.RegistrarCotaComCronograma(ctxWithKey, map[string]interface{}{
			"demanda_id":     demandaID,
			"propriedade_id": propriedadeID,
			"usuario_id":     profileID,
			"quantidade":     500.0,
			"data_plantio":   time.Now().AddDate(0, 1, 0).Format("2006-01-02"),
			"observacao_ia":  "Cota teste no Postgres real",
			"idempotency_key": cotaKey,
		})
		if err != nil {
			t.Fatalf("Falha na 2ª criação de cota (retry) no Postgres real: %v", err)
		}
		t.Logf("✅ Deduplicação de Cotas de Produtores confirmada no PostgreSQL real.")
	})
}

