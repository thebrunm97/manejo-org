package geo

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// GEEAuth gerencia a autenticação com o Google Earth Engine via Service Account.
type GEEAuth struct {
	ProjectID string
	client    *http.Client
}

// NewGEEAuth inicializa a autenticação JWT/OAuth2 a partir de um arquivo JSON.
// Se credentialsPath for vazio, tenta usar o Application Default Credentials.
func NewGEEAuth(ctx context.Context, credentialsPath string) (*GEEAuth, error) {
	// Escopos necessários para a API REST do Earth Engine
	scopes := []string{
		"https://www.googleapis.com/auth/earthengine",
		"https://www.googleapis.com/auth/cloud-platform",
	}

	var client *http.Client
	var projectID string

	if credentialsPath != "" {
		b, err := os.ReadFile(credentialsPath)
		if err != nil {
			return nil, fmt.Errorf("falha ao ler credentials JSON (%s): %w", credentialsPath, err)
		}

		creds, err := google.CredentialsFromJSON(ctx, b, scopes...)
		if err != nil {
			return nil, fmt.Errorf("falha ao parsear credentials JSON: %w", err)
		}
		client = oauth2.NewClient(ctx, creds.TokenSource)
		projectID = creds.ProjectID
	} else {
		// Fallback para Application Default Credentials (útil para produção no Cloud Run)
		creds, err := google.FindDefaultCredentials(ctx, scopes...)
		if err != nil {
			return nil, fmt.Errorf("falha ao obter Application Default Credentials: %w", err)
		}
		client = oauth2.NewClient(ctx, creds.TokenSource)
		projectID = creds.ProjectID
	}

	return &GEEAuth{
		ProjectID: projectID,
		client:    client,
	}, nil
}

// Client retorna o HTTP client HTTP autenticado que injetará o token Bearer
// automaticamente em cada request para os domínios do escopo.
func (a *GEEAuth) Client() *http.Client {
	return a.client
}
