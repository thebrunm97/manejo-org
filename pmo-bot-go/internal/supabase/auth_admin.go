package supabase

// Operações de autenticação que só o backend pode fazer (DT-58/DT-59).
//
// Este arquivo concentra o que exige privilégio de service_role: descobrir se
// alguém é administrador do painel e criar o usuário de um produtor que chegou
// pelo WhatsApp, sem nunca ter passado pelo portal web.

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
)

// IsAdmin diz se o usuário é administrador do painel.
//
// POR QUE NÃO USA A RPC `is_admin` QUE O FRONTEND USA
//
// Aquela RPC não recebe argumentos: ela resolve o usuário por `auth.uid()`,
// que só existe quando a chamada carrega o JWT da pessoa. O backend fala com o
// PostgREST usando a chave de serviço, então `auth.uid()` vem nulo e a RPC
// responderia "não é admin" para todo mundo, inclusive para quem é. Por isso a
// checagem aqui lê `profiles.role` diretamente, com o id que veio do token já
// verificado pelo middleware.
func (c *Client) IsAdmin(userID string) (bool, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return false, fmt.Errorf("IsAdmin: userID vazio")
	}

	reqURL := fmt.Sprintf("%s/rest/v1/profiles?id=eq.%s&select=role", c.config.URL, userID)
	body, err := c.doRequest(http.MethodGet, reqURL, nil)
	if err != nil {
		return false, fmt.Errorf("IsAdmin: consulta falhou: %w", err)
	}

	var linhas []struct {
		Role string `json:"role"`
	}
	if err := json.Unmarshal(body, &linhas); err != nil {
		return false, fmt.Errorf("IsAdmin: resposta inesperada: %w", err)
	}
	if len(linhas) == 0 {
		// Token válido de alguém sem profile. Não é erro — é simplesmente
		// não-admin (o caso do produtor que se cadastrou pelo WhatsApp e
		// ainda não tem linha, por exemplo).
		return false, nil
	}

	return strings.EqualFold(strings.TrimSpace(linhas[0].Role), "admin"), nil
}

// AuthUser é o subconjunto da resposta da Admin API que interessa aqui.
type AuthUser struct {
	ID    string `json:"id"`
	Phone string `json:"phone"`
	Email string `json:"email"`
}

// CreateAuthUserByPhone cria um usuário em auth.users a partir do telefone.
//
// POR QUE ISTO É NECESSÁRIO
//
// `profiles.id` tem FK para `auth.users(id)` (ON DELETE CASCADE). Um produtor
// que chega só pelo WhatsApp não passou por nenhum fluxo de login, então não
// existe em `auth.users` — e sem essa linha não há como criar o profile nem,
// por consequência, propriedade ou talhão. Esta função abre esse caminho.
//
// O usuário é criado com o telefone já confirmado: quem mandou a mensagem
// provou a posse do número pelo próprio WhatsApp, então exigir um segundo
// código por SMS seria refazer uma verificação que já aconteceu — e cobraria
// do produtor exatamente o atrito que o DT-58 existe para remover.
func (c *Client) CreateAuthUserByPhone(phone string, metadata map[string]interface{}) (*AuthUser, error) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return nil, fmt.Errorf("CreateAuthUserByPhone: telefone vazio")
	}

	payload := map[string]interface{}{
		"phone":         phone,
		"phone_confirm": true,
	}
	if len(metadata) > 0 {
		payload["user_metadata"] = metadata
	}

	corpo, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("CreateAuthUserByPhone: marshal: %w", err)
	}

	reqURL := fmt.Sprintf("%s/auth/v1/admin/users", c.config.URL)
	req, err := http.NewRequest(http.MethodPost, reqURL, strings.NewReader(string(corpo)))
	if err != nil {
		return nil, fmt.Errorf("CreateAuthUserByPhone: request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("CreateAuthUserByPhone: HTTP: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("CreateAuthUserByPhone: supabase (%d): %s", resp.StatusCode, string(respBody))
	}

	var u AuthUser
	if err := json.Unmarshal(respBody, &u); err != nil {
		return nil, fmt.Errorf("CreateAuthUserByPhone: decode: %w", err)
	}
	if u.ID == "" {
		return nil, fmt.Errorf("CreateAuthUserByPhone: supabase respondeu sem id")
	}

	log.Printf("🆕 [Auth] Usuário criado para o telefone %s (id=%s)", phone, u.ID)
	return &u, nil
}

// DeleteAuthUser remove um usuário de auth.users.
//
// Existe para desfazer uma criação parcial: se o usuário for criado e o
// cadastro seguinte falhar, deixar a linha órfã faria a próxima mensagem do
// mesmo número tentar criar OUTRO usuário, acumulando lixo em auth.users a
// cada tentativa. É compensação de falha, não uma operação de produto.
func (c *Client) DeleteAuthUser(userID string) error {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return fmt.Errorf("DeleteAuthUser: userID vazio")
	}

	reqURL := fmt.Sprintf("%s/auth/v1/admin/users/%s", c.config.URL, userID)
	req, err := http.NewRequest(http.MethodDelete, reqURL, nil)
	if err != nil {
		return fmt.Errorf("DeleteAuthUser: request: %w", err)
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("DeleteAuthUser: HTTP: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("DeleteAuthUser: supabase (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// CreateBasicProfileResult espelha o retorno JSON da RPC create_basic_profile.
type CreateBasicProfileResult struct {
	Success bool   `json:"success"`
	UserID  string `json:"user_id"`
	Error   string `json:"error"`
}

// CreateBasicProfile chama a RPC que cria (ou atualiza) só o profile com o
// nome do produtor — a etapa mínima do onboarding progressivo (DT-58,
// Fatia 2). Propriedade, área e talhão ficam para a complementação futura,
// que usa setup_initial_profile.
func (c *Client) CreateBasicProfile(userID, nome string) (*CreateBasicProfileResult, error) {
	payload := map[string]interface{}{
		"p_user_id": userID,
		"p_nome":    nome,
	}

	corpo, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("CreateBasicProfile: marshal: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/rpc/create_basic_profile", c.config.URL)
	body, err := c.doRequest(http.MethodPost, reqURL, corpo)
	if err != nil {
		return nil, fmt.Errorf("CreateBasicProfile: RPC falhou: %w", err)
	}

	var res CreateBasicProfileResult
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("CreateBasicProfile: decode: %w", err)
	}
	if !res.Success {
		return &res, fmt.Errorf("CreateBasicProfile: RPC recusou: %s", res.Error)
	}

	log.Printf("✅ [Onboarding] Profile básico criado (user=%s)", userID)
	return &res, nil
}

// SetupInitialProfileResult espelha o retorno JSON da RPC setup_initial_profile.
type SetupInitialProfileResult struct {
	Success       bool   `json:"success"`
	PropriedadeID int64  `json:"propriedade_id"`
	TalhaoID      int64  `json:"talhao_id"`
	Error         string `json:"error"`
}

// SetupInitialProfile chama a RPC que cria Profile + Propriedade + Talhão numa
// única transação — a mesma que o portal web já usa em onboardingService.ts.
//
// Reaproveitar a RPC em vez de inserir tabela por tabela aqui é o que mantém a
// promessa do ADR-002: a atomicidade fica no banco, e um cadastro interrompido
// no meio não deixa produtor com propriedade mas sem talhão.
func (c *Client) SetupInitialProfile(userID, nome, propriedadeNome string, areaHa float64, talhaoNome string) (*SetupInitialProfileResult, error) {
	payload := map[string]interface{}{
		"p_user_id":          userID,
		"p_nome":             nome,
		"p_propriedade_nome": propriedadeNome,
		"p_area_ha":          areaHa,
		"p_talhao_nome":      talhaoNome,
	}

	corpo, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("SetupInitialProfile: marshal: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/rpc/setup_initial_profile", c.config.URL)
	body, err := c.doRequest(http.MethodPost, reqURL, corpo)
	if err != nil {
		return nil, fmt.Errorf("SetupInitialProfile: RPC falhou: %w", err)
	}

	var res SetupInitialProfileResult
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, fmt.Errorf("SetupInitialProfile: decode: %w", err)
	}
	if !res.Success {
		return &res, fmt.Errorf("SetupInitialProfile: RPC recusou: %s", res.Error)
	}

	log.Printf("✅ [Onboarding] Cadastro criado (user=%s propriedade=%d talhao=%d)", userID, res.PropriedadeID, res.TalhaoID)
	return &res, nil
}
