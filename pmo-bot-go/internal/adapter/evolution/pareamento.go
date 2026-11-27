package evolution

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// instanciaComToken é o subconjunto de /instance/all de que precisamos.
type instanciaComToken struct {
	Name  string `json:"name"`
	Token string `json:"token"`
}

// tokenDaInstancia resolve o token da própria instância usando a chave global.
//
// /instance/connect e /instance/pair exigem o token da instância: com a chave
// global a API responde 401. Por isso o adapter busca o token antes de agir.
// O token nunca é logado.
func (a *EvolutionAdapter) tokenDaInstancia(ctx context.Context) (string, error) {
	var resp struct {
		Data []instanciaComToken `json:"data"`
	}
	if err := a.getJSON(ctx, a.BaseURL+"/instance/all", &resp); err != nil {
		return "", fmt.Errorf("listar instâncias: %w", err)
	}
	for _, inst := range resp.Data {
		if inst.Name == a.InstanceName {
			return inst.Token, nil
		}
	}
	return "", fmt.Errorf("instância %q não encontrada", a.InstanceName)
}

// Conectar coloca o cliente em modo de conexão. Precisa acontecer antes de
// PedirCodigoPareamento: sem isso o pareamento devolve código vazio.
//
// O corpo tem de ser JSON ({}), porque o handler faz bind do body; corpo vazio
// responde 400.
func (a *EvolutionAdapter) Conectar(ctx context.Context) error {
	token, err := a.tokenDaInstancia(ctx)
	if err != nil {
		return err
	}
	_, err = a.postComToken(ctx, a.BaseURL+"/instance/connect", token, map[string]interface{}{})
	return err
}

// PedirCodigoPareamento devolve o código de 8 caracteres para digitar no
// WhatsApp (Aparelhos conectados → Conectar com número de telefone).
//
// O código é segredo de curta duração: quem chama não deve logá-lo.
func (a *EvolutionAdapter) PedirCodigoPareamento(ctx context.Context, telefone string) (string, error) {
	token, err := a.tokenDaInstancia(ctx)
	if err != nil {
		return "", err
	}
	raw, err := a.postComToken(ctx, a.BaseURL+"/instance/pair", token, map[string]string{"phone": telefone})
	if err != nil {
		return "", err
	}
	var resp struct {
		Data struct {
			PairingCode string `json:"PairingCode"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &resp); err != nil {
		return "", fmt.Errorf("decodificar resposta de pareamento: %w", err)
	}
	if resp.Data.PairingCode == "" {
		// Código vazio é falha, não sucesso: a API responde 200 mesmo assim
		// quando o whatsmeow recusa o pareamento.
		return "", fmt.Errorf("pareamento retornou código vazio")
	}
	return resp.Data.PairingCode, nil
}

// postComToken faz um POST JSON autenticado pelo token da instância e devolve
// o corpo da resposta quando o status é 2xx.
func (a *EvolutionAdapter) postComToken(ctx context.Context, url, token string, payload interface{}) ([]byte, error) {
	corpo, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("serializar payload: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(corpo))
	if err != nil {
		return nil, fmt.Errorf("criar requisição: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", token)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("requisição falhou: %w", err)
	}
	defer resp.Body.Close()

	lido, _ := io.ReadAll(io.LimitReader(resp.Body, 64<<10))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &StatusError{Code: resp.StatusCode, Body: string(lido)}
	}
	return lido, nil
}
