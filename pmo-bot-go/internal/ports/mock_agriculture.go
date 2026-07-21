package ports

import (
	"context"
	"fmt"
	"sync"
)

// MockAgriculturalRepository é uma implementação em memória para testes
type MockAgriculturalRepository[T any] struct {
	mu                   sync.Mutex
	OperacoesRegistradas []T
}

func NewMockAgriculturalRepository[T any]() *MockAgriculturalRepository[T] {
	return &MockAgriculturalRepository[T]{
		OperacoesRegistradas: make([]T, 0),
	}
}

func (m *MockAgriculturalRepository[T]) RegistrarLoteOperacoes(ctx context.Context, pmoID int, userID string, operacoes []T) (*BatchResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.OperacoesRegistradas = append(m.OperacoesRegistradas, operacoes...)

	sucessos := make([]string, len(operacoes))
	for i := range operacoes {
		sucessos[i] = fmt.Sprintf("Operação %d mockada com sucesso (PMO: %d, User: %s)", i, pmoID, userID)
	}

	return &BatchResult{
		Sucessos: sucessos,
		Erros:    []string{},
	}, nil
}
