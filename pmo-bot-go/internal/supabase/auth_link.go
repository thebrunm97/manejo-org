package supabase

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// SessaoSemTrocarSenha emite uma sessão para o usuário do link do WhatsApp sem
// mexer na senha dele.
//
// Quem tem e-mail entra pelo par admin generate_link (magiclink, sem enviar
// e-mail) + verify, que devolve a sessão direto. Trocar a senha, como o fluxo
// antigo fazia, derrubava o login por e-mail e senha no app.
//
// Quem só tem telefone não tem como entrar por senha no frontend (o login é
// e-mail + senha), e o GoTrue não gera magiclink sem e-mail: para esses segue
// a senha aleatória, que não tira nada do usuário.
func (c *Client) SessaoSemTrocarSenha(userID string, senhaAleatoria string) (*AuthSession, error) {
	user, err := c.buscarAuthUser(userID)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(user.Email) == "" {
		return c.UpdateUserPasswordAndLogin(userID, senhaAleatoria)
	}

	var link struct {
		HashedToken string `json:"hashed_token"`
		Properties  struct {
			HashedToken string `json:"hashed_token"`
		} `json:"properties"`
	}
	if err := c.postAuth("/auth/v1/admin/generate_link", map[string]string{"type": "magiclink", "email": user.Email}, true, &link); err != nil {
		return nil, fmt.Errorf("SessaoSemTrocarSenha: generate_link: %w", err)
	}
	hash := link.HashedToken
	if hash == "" {
		hash = link.Properties.HashedToken
	}
	if hash == "" {
		return nil, fmt.Errorf("SessaoSemTrocarSenha: generate_link sem hashed_token")
	}

	var sessao AuthSession
	if err := c.postAuth("/auth/v1/verify", map[string]string{"type": "magiclink", "token_hash": hash}, false, &sessao); err != nil {
		return nil, fmt.Errorf("SessaoSemTrocarSenha: verify: %w", err)
	}
	return &sessao, nil
}

func (c *Client) buscarAuthUser(userID string) (*AuthUser, error) {
	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/auth/v1/admin/users/%s", c.config.URL, userID), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Authorization", "Bearer "+c.config.Key)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("buscarAuthUser: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		corpo, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("buscarAuthUser: supabase (%d): %s", resp.StatusCode, corpo)
	}
	var u AuthUser
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, fmt.Errorf("buscarAuthUser: %w", err)
	}
	return &u, nil
}

// postAuth faz POST no GoTrue. admin=true manda a service key como Bearer.
func (c *Client) postAuth(caminho string, payload interface{}, admin bool, destino interface{}) error {
	corpo, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPost, c.config.URL+caminho, bytes.NewReader(corpo))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", c.config.Key)
	req.Header.Set("Content-Type", "application/json")
	if admin {
		req.Header.Set("Authorization", "Bearer "+c.config.Key)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	resposta, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return fmt.Errorf("supabase (%d): %s", resp.StatusCode, resposta)
	}
	return json.Unmarshal(resposta, destino)
}
