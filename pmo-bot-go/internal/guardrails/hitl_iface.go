package guardrails

import "context"

// HITLHandler is the interface the Orchestrator depends on.
// Implemented by *HITLController. Use nil to disable HITL in tests.
type HITLHandler interface {
	RequestApproval(ctx context.Context, rec HITLRecord) (token string, err error)
	FindPendingByPhone(ctx context.Context, phone string) (*HITLRecord, error)
	Approve(ctx context.Context, id string) (toolName string, toolArgs map[string]interface{}, err error)
	Reject(ctx context.Context, id string) error
}

// compile-time check
var _ HITLHandler = (*HITLController)(nil)
