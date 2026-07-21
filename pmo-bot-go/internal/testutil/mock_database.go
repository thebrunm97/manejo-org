package testutil

import (
	"context"

	"github.com/stretchr/testify/mock"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// MockDatabaseRepository is a mock for ports.DatabaseRepository
type MockDatabaseRepository struct {
	mock.Mock
}

func (m *MockDatabaseRepository) ResolvePhone(from string) (string, error) {
	args := m.Called(from)
	return args.String(0), args.Error(1)
}

func (m *MockDatabaseRepository) GetProfileByPhone(phone string) (*supabase.Profile, error) {
	args := m.Called(phone)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*supabase.Profile), args.Error(1)
}

func (m *MockDatabaseRepository) RegistrarOperacaoCampoRPC(ctx context.Context, argsMap map[string]interface{}, dataArg string) (map[string]interface{}, error) {
	args := m.Called(ctx, argsMap, dataArg)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

func (m *MockDatabaseRepository) RegistrarTransacaoComRateioRPC(ctx context.Context, argsMap map[string]interface{}) (map[string]interface{}, error) {
	args := m.Called(ctx, argsMap)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

func (m *MockDatabaseRepository) RegistrarCompraInsumoRPC(ctx context.Context, argsMap map[string]interface{}) (map[string]interface{}, error) {
	args := m.Called(ctx, argsMap)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(map[string]interface{}), args.Error(1)
}

func (m *MockDatabaseRepository) InsertLogProcessamento(logData supabase.LogProcessamentoInsert) error {
	args := m.Called(logData)
	return args.Error(0)
}

func (m *MockDatabaseRepository) InsertLogTreinamento(logData supabase.LogTreinamentoInsert) error {
	args := m.Called(logData)
	return args.Error(0)
}

func (m *MockDatabaseRepository) InsertLogConsumo(logData supabase.LogConsumoInsert) error {
	args := m.Called(logData)
	return args.Error(0)
}

func (m *MockDatabaseRepository) InsertRawPayload(ctx context.Context, msgID string, raw []byte, source string) (string, error) {
	args := m.Called(ctx, msgID, raw, source)
	return args.String(0), args.Error(1)
}

func (m *MockDatabaseRepository) UpdateRawPayloadStatus(ctx context.Context, id, status, reason string) error {
	args := m.Called(ctx, id, status, reason)
	return args.Error(0)
}

func (m *MockDatabaseRepository) InsertMessage(ctx context.Context, msg supabase.MessageInsert) error {
	args := m.Called(ctx, msg)
	return args.Error(0)
}
