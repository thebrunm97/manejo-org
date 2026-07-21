package ports

import (
	"context"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// ---------------------------------------------------------------------------
// Segregated Database Interfaces
// ---------------------------------------------------------------------------

// PhoneResolver allows mapping LIDs or other formats to standardized phone numbers.
type PhoneResolver interface {
	ResolvePhone(from string) (string, error)
}

// ProfileLoader provides access to the user's profile and active property.
type ProfileLoader interface {
	GetProfileByPhone(phone string) (*supabase.Profile, error)
}

// StatePersister handles the storage and retrieval of the FSM's conversation state.
type StatePersister interface {
	// (Note: Currently these are generic queries or could be specific methods)
	// We might need to abstract the specific calls the FSM makes for state.
	// For now, this is a placeholder for future state abstraction if needed, 
	// or we can add the actual methods once we identify them.
}

// ManejoWriter defines the interface for registering agricultural activities.
type ManejoWriter interface {
	RegistrarOperacaoCampoRPC(ctx context.Context, args map[string]interface{}, dataArg string) (map[string]interface{}, error)
}

// FinanceiroWriter defines the interface for financial transactions.
type FinanceiroWriter interface {
	RegistrarTransacaoComRateioRPC(ctx context.Context, args map[string]interface{}) (map[string]interface{}, error)
}

// ComprasWriter defines the interface for input purchases.
type ComprasWriter interface {
	RegistrarCompraInsumoRPC(ctx context.Context, args map[string]interface{}) (map[string]interface{}, error)
}

// LogPersister handles audit and conversation logging.
type LogPersister interface {
	InsertLogProcessamento(logData supabase.LogProcessamentoInsert) error
	InsertLogTreinamento(logData supabase.LogTreinamentoInsert) error
	InsertLogConsumo(logData supabase.LogConsumoInsert) error
	InsertRawPayload(ctx context.Context, msgID string, raw []byte, source string) (string, error)
	UpdateRawPayloadStatus(ctx context.Context, id, status, reason string) error
	InsertMessage(ctx context.Context, msg supabase.MessageInsert) error
}

// DatabaseRepository is the composition of all specialized DB interfaces.
// Functions can accept this composite interface, or prefer the specific ones above.
type DatabaseRepository interface {
	PhoneResolver
	ProfileLoader
	ManejoWriter
	FinanceiroWriter
	ComprasWriter
	LogPersister
}
