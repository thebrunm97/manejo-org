package supabase

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
)

// IdentityResolutionResult contém os dados encontrados a partir de um vínculo de canal.
type IdentityResolutionResult struct {
	UserID   string
	TenantID string
	IsAdmin  bool
}

// ResolveIdentity busca a identidade canônica (user_id e tenant_id) de um produtor
// a partir do seu identificador de canal (ex: telefone no WhatsApp, chat_id no Telegram).
func (c *Client) ResolveIdentity(ctx context.Context, channel string, channelUserID string) (*IdentityResolutionResult, error) {
	reqURL := fmt.Sprintf("%s/rest/v1/channel_links?channel=eq.%s&channel_user_id=eq.%s&select=user_id,profiles!inner(tenant_id,role)&limit=1", c.config.URL, channel, channelUserID)
	
	body, err := c.doRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to query channel_links: %w", err)
	}

	var result []struct {
		UserID   string `json:"user_id"`
		Profiles struct {
			TenantID string `json:"tenant_id"`
			Role     string `json:"role"`
		} `json:"profiles"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to decode channel_links response: %w", err)
	}

	if len(result) == 0 {
		return nil, nil // Not found
	}

	role := result[0].Profiles.Role
	isAdmin := role == "admin" || role == "cooperativa" || role == "tecnico"

	return &IdentityResolutionResult{
		UserID:   result[0].UserID,
		TenantID: result[0].Profiles.TenantID,
		IsAdmin:  isAdmin,
	}, nil
}

// GetOrCreateConversation resolve a conversa ativa para o par (tenant_id, user_id).
// Se não existir uma 'active', cria uma nova e retorna o ID.
//
// tenantID pode vir vazio — hoje sempre vem, porque tenant ativo ainda mora
// em profiles.pmo_ativo_id e a modelagem de tenant por conversa depende do
// ADR-010 (multitenancy), que segue com status "Proposto". Vazio aqui não é
// um valor qualquer: é tratado como "sem tenant ainda" (NULL na coluna, que
// é nullable de propósito para isso), nunca como uma string a comparar. Uma
// string vazia mandada como UUID para o PostgREST quebra com 22P02 — por
// isso os dois ramos abaixo tratam tenantID=="" separadamente. Quando o
// ADR-010 fechar, popular o tenant real é mudança isolada aqui dentro.
func (c *Client) GetOrCreateConversation(ctx context.Context, tenantID, userID string, channel string, phone string) (string, error) {
	// TODO: Replace 'phone' with the appropriate channel_user_id logic when fully migrated,
	// but for now we keep it for backward compatibility in the DB if needed.

	tenantFilter := fmt.Sprintf("tenant_id=eq.%s", tenantID)
	if tenantID == "" {
		tenantFilter = "tenant_id=is.null"
	}
	reqURL := fmt.Sprintf("%s/rest/v1/conversations?%s&user_id=eq.%s&status=eq.active&select=id&limit=1", c.config.URL, tenantFilter, userID)

	body, err := c.doRequestWithContext(ctx, "GET", reqURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to query active conversation: %w", err)
	}

	var convs []struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(body, &convs); err != nil {
		return "", fmt.Errorf("failed to decode conversation response: %w", err)
	}

	if len(convs) > 0 {
		return convs[0].ID, nil
	}

	// Not found, create a new one. tenant_id só entra no payload quando
	// conhecido — omitir a chave deixa a coluna cair no DEFAULT NULL dela;
	// mandar "" quebraria a mesma forma que a query GET quebraria acima.
	newConv := map[string]interface{}{
		"user_id": userID,
		"status":  "active",
		"channel": channel, // fallback legacy channel
		"phone":   phone,   // fallback legacy phone
	}
	if tenantID != "" {
		newConv["tenant_id"] = tenantID
	}

	payload, _ := json.Marshal(newConv)
	insertURL := fmt.Sprintf("%s/rest/v1/conversations", c.config.URL)
	
	// Use POST and request Prefer: return=representation to get the ID back
	insertBody, err := c.doRequestWithPrefer("POST", insertURL, bytes.NewReader(payload), "return=representation")
	if err != nil {
		return "", fmt.Errorf("failed to insert new conversation: %w", err)
	}

	var inserted []struct {
		ID string `json:"id"`
	}

	if err := json.Unmarshal(insertBody, &inserted); err != nil {
		return "", fmt.Errorf("failed to decode new conversation response: %w", err)
	}

	if len(inserted) == 0 {
		return "", fmt.Errorf("inserted conversation but got no ID back")
	}

	return inserted[0].ID, nil
}
