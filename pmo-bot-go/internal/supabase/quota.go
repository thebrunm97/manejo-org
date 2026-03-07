package supabase

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const FREE_TIER_DAILY_LIMIT = 100

// CheckAndDeductQuota verifica o saldo do perfil e deduz os créditos equivalentes (15 para áudio, 5 para texto).
// Retorna (true, saldo) se autorizado, ou (false, saldo) se o limite for estourado.
func (c *Client) CheckAndDeductQuota(profileID string, pmoAtivoID int64, isAudio bool) (bool, int, error) {
	// Bypass de Quota para o uduário Benchmark (PMO 524)
	if pmoAtivoID == 524 {
		return true, 99999, nil
	}

	custo := 5
	if isAudio {
		custo = 15
	}

	// Como a lógica nativa do Postgres é complexa de reproduzir no client,
	// idealmente chamamos uma RPC (Remote Procedure Call) no Supabase.
	// Se a RPC 'deduzir_creditos' não existir, faremos em duas etapas (Read -> Update).

	// Passo 1: Buscar perfil atual para verificar o saldo e limite
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s&select=plan_tier,daily_request_count,last_usage_date", c.config.URL, profileID)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return false, 0, err
	}

	var records []struct {
		PlanTier          string `json:"plan_tier"`
		DailyRequestCount int    `json:"daily_request_count"`
		LastUsageDate     string `json:"last_usage_date"` // expected "YYYY-MM-DD" or similar
	}

	if err := json.Unmarshal(body, &records); err != nil {
		return false, 0, fmt.Errorf("falha ao ler quotas: %v", err)
	}

	if len(records) == 0 {
		return false, 0, fmt.Errorf("perfil não encontrado ao checar quota")
	}

	p := records[0]
	today := time.Now().UTC().Format("2006-01-02")

	dailyCount := p.DailyRequestCount
	if p.LastUsageDate != "" {
		// Just take first 10 chars for YYYY-MM-DD to avoid time zone mismatches if saved as timestamp
		lastDateOnly := p.LastUsageDate
		if len(lastDateOnly) >= 10 {
			lastDateOnly = lastDateOnly[:10]
		}
		if lastDateOnly != today {
			dailyCount = 0 // Reset daily limit since it's a new day
		}
	}

	limit := FREE_TIER_DAILY_LIMIT
	isPremium := p.PlanTier == "premium" || p.PlanTier == "pro"
	if isPremium {
		limit = 99999
	}

	saldoRestante := limit - dailyCount

	// Se for plano gratuito/ilimitado sem limite rígido (ex: limite 0 ou muito alto),
	// aprova. Mas supondo que o limite real bloqueie:
	if !isPremium && saldoRestante < custo {
		log.Printf("⛔ [Quota] Bloqueado: Saldo insuficiente (%d restantes, precisa de %d)", saldoRestante, custo)
		return false, saldoRestante, nil
	}

	// Passo 2: Deduzir incrementando tokens_usados (ou daily_request_count)
	updateURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s", c.config.URL, profileID)

	patchData := map[string]interface{}{
		"daily_request_count": dailyCount + custo,
		"last_usage_date":     today,
	}

	patchBytes, _ := json.Marshal(patchData)

	req, _ := http.NewRequest(http.MethodPatch, updateURL, bytes.NewReader(patchBytes))
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return true, saldoRestante, fmt.Errorf("aviso: quota validada, mas falha ao descontar: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		log.Printf("⚠️ [Quota] Falha no Update (%d): %s", resp.StatusCode, string(respBody))
	} else {
		log.Printf("🪙 [Quota] %d créditos deduzidos do usuário %s. (Usados Hoje: %d -> %d)", custo, profileID, dailyCount, dailyCount+custo)
	}

	return true, saldoRestante - custo, nil
}

// CheckSaldo retorna os dados de limite do usuário
func (c *Client) CheckSaldo(profileID string) (int, int, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s&select=plan_tier,daily_request_count,last_usage_date", c.config.URL, profileID)

	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return 0, 0, err
	}

	var records []struct {
		PlanTier          string `json:"plan_tier"`
		DailyRequestCount int    `json:"daily_request_count"`
		LastUsageDate     string `json:"last_usage_date"` // expected "YYYY-MM-DD" or similar
	}

	if err := json.Unmarshal(body, &records); err != nil {
		log.Printf("❌ [Quota Debug] Erro ao decodificar saldo. Body Raw: %s | Erro: %v", string(body), err)
		return 0, 0, err
	}

	if len(records) == 0 {
		return 0, 0, fmt.Errorf("perfil não encontrado")
	}

	p := records[0]
	today := time.Now().UTC().Format("2006-01-02")

	dailyCount := p.DailyRequestCount
	if p.LastUsageDate != "" {
		lastDateOnly := p.LastUsageDate
		if len(lastDateOnly) >= 10 {
			lastDateOnly = lastDateOnly[:10]
		}
		if lastDateOnly != today {
			dailyCount = 0 // Reset daily limit since it's a new day
		}
	}

	limit := FREE_TIER_DAILY_LIMIT
	isPremium := p.PlanTier == "premium" || p.PlanTier == "pro"
	if isPremium {
		limit = 99999
	}

	return dailyCount, limit, nil
}

// LinkDeviceToWeb handles the "CONECTAR" command process pairing the device.
// It searches for the 6-digit code in the profiles table, and if found, updates the telefone column.
func (c *Client) LinkDeviceToWeb(phone string, code string) error {
	// First, lookup if this code exists and is pending
	reqURL := fmt.Sprintf("%s/rest/v1/profiles?codigo_vinculo=eq.%s&select=id", c.config.URL, code)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return fmt.Errorf("falha ao buscar código: %w", err)
	}

	var profiles []struct {
		ID string `json:"id"`
	}

	err = json.Unmarshal(body, &profiles)
	if err != nil || len(profiles) == 0 {
		return fmt.Errorf("código inválido ou expirado")
	}

	profileID := profiles[0].ID

	// Update the profile with the sanitized phone number and clear the code
	updateURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s", c.config.URL, profileID)

	patchData := map[string]interface{}{
		"telefone":       phone,
		"codigo_vinculo": nil, // Limpa para não reutilizarem
	}

	patchBytes, _ := json.Marshal(patchData)

	req, _ := http.NewRequest(http.MethodPatch, updateURL, bytes.NewReader(patchBytes))
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("falha HTTP ao vincular: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("erro do supabase (%d): %s", resp.StatusCode, string(respBody))
	}

	log.Printf("🔗 [Vínculo] Objeto Web ID `%s` vinculado ao WhatsApp `%s`", profileID, phone)
	return nil
}
