package guardrails

import (
	"context"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
)

// HITLHandler is the interface the Orchestrator and Webhook depend on.
// Implemented by *HITLController. Use nil to disable HITL in tests.
type HITLHandler interface {
	RequestApproval(ctx context.Context, rec HITLRecord) (token string, err error)
	FindPendingByPhone(ctx context.Context, phone string) (*HITLRecord, error)
	Approve(ctx context.Context, id string) (toolName string, toolArgs map[string]interface{}, err error)
	Reject(ctx context.Context, id string) error

	// Phase 2.2 Mutation Drafts Two-Phase Commit methods
	CreateOrSupersedeDraft(ctx context.Context, pmoID int64, userID, phone string, operations []domain.BatchMutationItem, summaryText string, ttlMinutes int) (draftID string, supersededID *string, err error)
	FindPendingDraft(ctx context.Context, phone string, pmoID int64) (*domain.MutationDraftRecord, error)
	CommitDraft(ctx context.Context, draftID string, userID string, pmoID int64) (domain.CommitMutationResult, error)
	RejectDraft(ctx context.Context, draftID string) error
}

// compile-time check
var _ HITLHandler = (*HITLController)(nil)
