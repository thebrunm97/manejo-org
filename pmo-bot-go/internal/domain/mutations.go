package domain

import (
	"fmt"
	"strings"
	"time"
)

// MutationType identifies the target domain table / RPC.
type MutationType string

const (
	MutationTypeCadernoCampo     MutationType = "caderno_campo"
	MutationTypeCompraInsumo     MutationType = "compra_insumo"
	MutationTypeTransacaoRateio  MutationType = "transacoes_com_rateio"
	MutationTypeCotaProdutor     MutationType = "cotas_produtores"
)

// MutationDraftStatus identifies the state of a mutation draft in Two-Phase Commit HITL.
type MutationDraftStatus string

const (
	DraftStatusPending    MutationDraftStatus = "pending"
	DraftStatusApproved   MutationDraftStatus = "approved"
	DraftStatusRejected   MutationDraftStatus = "rejected"
	DraftStatusSuperseded MutationDraftStatus = "superseded"
	DraftStatusExpired    MutationDraftStatus = "expired"
	DraftStatusFailed     MutationDraftStatus = "failed"
)

// BatchMutationItem represents a single mutation within a batch proposal.
type BatchMutationItem struct {
	Type         string                 `json:"type"`
	TipoOperacao string                 `json:"tipo_operacao,omitempty"`
	Payload      map[string]interface{} `json:"payload"`
}

// ProposeBatchMutationsPayload is the arguments structure for the propose_batch_mutations tool call.
type ProposeBatchMutationsPayload struct {
	Operacoes      []BatchMutationItem `json:"operacoes"`
	ResumoAmigavel string              `json:"resumo_amigavel,omitempty"`
}

// MutationDraftRecord represents a persisted row in public.mutation_drafts.
type MutationDraftRecord struct {
	ID                string              `json:"id,omitempty"`
	PmoID             int64               `json:"pmo_id"`
	UserID            string              `json:"user_id"`
	FromPhone         string              `json:"from_phone"`
	SupersedesDraftID *string             `json:"supersedes_draft_id,omitempty"`
	Status            MutationDraftStatus `json:"status"`
	Operations        []BatchMutationItem `json:"operations"`
	SummaryText       string              `json:"summary_text,omitempty"`
	ErrorDetail       string              `json:"error_detail,omitempty"`
	ExpiresAt         time.Time           `json:"expires_at"`
	CreatedAt         time.Time           `json:"created_at,omitempty"`
	UpdatedAt         time.Time           `json:"updated_at,omitempty"`
}

// CommitMutationResult is the structured response returned by public.commit_mutation_draft.
type CommitMutationResult struct {
	Status      string                   `json:"status"`
	DraftID     string                   `json:"draft_id"`
	Results     []map[string]interface{} `json:"results,omitempty"`
	ErrorDetail string                   `json:"error_detail,omitempty"`
	Message     string                   `json:"message"`
}

// DeriveOperationIdempotencyKey creates a deterministic idempotency key for a specific item in a batch draft.
func DeriveOperationIdempotencyKey(draftID string, index int) string {
	draftID = strings.TrimSpace(draftID)
	return fmt.Sprintf("%s-op-%d", draftID, index)
}
