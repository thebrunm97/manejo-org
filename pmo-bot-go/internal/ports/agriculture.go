package ports

import "context"

// BatchResult contém o sumário das operações em lote
type BatchResult struct {
	Sucessos []string `json:"sucessos"`
	Erros    []string `json:"erros"`
}

// AgriculturalRepository define as operações genéricas de agricultura,
// parametrizado por T para evitar dependências circulares com a camada MCP,
// mas garantindo tipagem forte nas implementações.
type AgriculturalRepository[T any] interface {
	RegistrarLoteOperacoes(ctx context.Context, pmoID int, userID string, operacoes []T) (*BatchResult, error)
}
