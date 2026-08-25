package supabase

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GenerateOnboardingJWT cria um token temporário (JWT) válido para o Supabase.
// O frontend usará este token para fazer setSession() e salvar os dados
// do onboarding diretamente no banco com as políticas de RLS (Row Level Security) corretas.
func GenerateOnboardingJWT(userID string, phone string) (string, error) {
	secret := os.Getenv("SUPABASE_JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("GenerateOnboardingJWT: SUPABASE_JWT_SECRET não configurada")
	}

	// Claims compatíveis com a estrutura do JWT do Supabase (GoTrue)
	claims := jwt.MapClaims{
		"aud":   "authenticated",
		"role":  "authenticated",
		"sub":   userID,
		"phone": phone,
		"exp":   time.Now().Add(24 * time.Hour).Unix(), // Válido por 24h
		"app_metadata": map[string]interface{}{
			"provider":  "phone",
			"providers": []string{"phone"},
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(secret))
	if err != nil {
		return "", fmt.Errorf("GenerateOnboardingJWT: erro ao assinar token: %w", err)
	}

	return tokenString, nil
}
