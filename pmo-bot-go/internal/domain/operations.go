package domain

// FinancialOperation marks a payload that represents a financial transaction.
type FinancialOperation interface {
	GetValorTotal() float64
	GetProduto() string
}

// AgriculturalOperation marks a payload that represents an agricultural field operation.
type AgriculturalOperation interface {
	GetQuantidade() float64
	GetUnidade() string
	GetProduto() string
	GetTalhao() string
	GetTipoAtividade() string
}
