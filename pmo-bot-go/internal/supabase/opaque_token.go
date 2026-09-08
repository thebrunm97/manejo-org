package supabase

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"
)

// GenerateOpaqueToken gera um código opaco com alta entropia (128 bits) 
// e o persiste (hasheado com SHA-256) na tabela onboarding_tokens no Supabase.
// Retorna o token em plaintext que deve ser enviado para o produtor.
func (c *Client) GenerateOpaqueToken(userID string) (string, error) {
	// Geração de 24 bytes de entropia via CSPRNG (~192 bits)
	rawBytes := make([]byte, 24)
	if _, err := rand.Read(rawBytes); err != nil {
		return "", fmt.Errorf("GenerateOpaqueToken: falha ao gerar entropia: %w", err)
	}

	// Plaintext Token (usando base64url para ser URL-safe sem encode adicional)
	plaintextToken := base64.RawURLEncoding.EncodeToString(rawBytes)

	// Hashear com SHA-256 antes de persistir (mitigação contra vazamento do DB)
	hash := sha256.Sum256([]byte(plaintextToken))
	tokenHash := hex.EncodeToString(hash[:])

	// TTL exato de 10 minutos conforme documentado no PLAN-f1-auth-pkce
	expiresAt := time.Now().Add(10 * time.Minute)

	// Inserir token usando service_role (a tabela não deve possuir políticas de RLS públicas)
	type tokenRecord struct {
		UserID    string    `json:"user_id"`
		TokenHash string    `json:"token_hash"`
		ExpiresAt time.Time `json:"expires_at"`
		Used      bool      `json:"used"`
	}

	record := tokenRecord{
		UserID:    userID,
		TokenHash: tokenHash,
		ExpiresAt: expiresAt,
		Used:      false,
	}

	payload, err := json.Marshal(record)
	if err != nil {
		return "", err
	}

	reqURL := fmt.Sprintf("%s/rest/v1/onboarding_tokens", c.config.URL)
	_, err = c.doRequest("POST", reqURL, payload)
	if err != nil {
		return "", fmt.Errorf("GenerateOpaqueToken: falha ao inserir token no Supabase: %w", err)
	}

	return plaintextToken, nil
}

// ExchangeOpaqueToken processa a troca de um código opaco.
// Faz update atômico para marcar como usado e retorna o user_id associado.
func (c *Client) ExchangeOpaqueToken(plaintextToken string) (string, error) {
	// 1. Hashear o token recebido
	hash := sha256.Sum256([]byte(plaintextToken))
	tokenHash := hex.EncodeToString(hash[:])

	// 2. Tentar marcar como usado (atômico) e verificar expiração no banco
	// Utilizamos `used=eq.false` e `expires_at=gt.NOW` para garantir atomicidade.
	nowStr := time.Now().UTC().Format(time.RFC3339)
	reqURL := fmt.Sprintf("%s/rest/v1/onboarding_tokens?token_hash=eq.%s&used=eq.false&expires_at=gt.%s", c.config.URL, tokenHash, nowStr)
	
	// A API REST precisa saber o que estamos atualizando
	updatePayload := map[string]interface{}{
		"used": true,
	}
	payloadBytes, _ := json.Marshal(updatePayload)

	// Para retornar o registro, o PostgREST precisa do cabeçalho "Prefer: return=representation"
	// Como não temos controle sobre os headers no doRequest(), se ele não retornar o corpo
	// atualizado, precisaremos de outra abordagem (como RPC).
	// Felizmente, podemos adicionar isso diretamente na URL do Supabase para forçar a representação? 
	// Não, é via header.
	// O `doRequest` default pode não passar `Prefer: return=representation`. 
	// Se a rota falhar em retornar representação, usaremos GET imediatamente antes,
	// mas um UPDATE sem retornar é o problema.
	// Vamos usar uma query crua se precisar, mas primeiro, vamos verificar se doRequest funciona.
	body, err := c.doRequestWithPrefer("PATCH", reqURL, bytes.NewReader(payloadBytes), "return=representation")
	if err != nil {
		return "", fmt.Errorf("ExchangeOpaqueToken: erro ao consumir token: %w", err)
	}

	var results []struct {
		UserID    string    `json:"user_id"`
		ExpiresAt time.Time `json:"expires_at"`
	}

	if err := json.Unmarshal(body, &results); err != nil {
		return "", fmt.Errorf("ExchangeOpaqueToken: erro ao ler resposta: %w", err)
	}

	if len(results) == 0 {
		return "", fmt.Errorf("ExchangeOpaqueToken: token inválido ou já utilizado")
	}

	tokenData := results[0]

	return tokenData.UserID, nil
}
