package guardrails

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// SupabaseViolationLogger persists GuardrailEvents to the guardrail_events table
// via the Supabase REST API.
//
// Key design decisions:
//   - Fire-and-forget: LogViolation spawns a goroutine so the calling goroutine
//     (the AI worker processing path) is never blocked by network I/O.
//   - Bounded timeout: each insert attempt has a 5s deadline to prevent goroutine
//     accumulation under Supabase latency spikes.
//   - Fail-silent: logging failures are printed to stderr but never propagated.
//     Guardrail audit must not degrade the core user experience.
type SupabaseViolationLogger struct {
	url        string       // Supabase project URL (e.g. https://xyz.supabase.co)
	key        string       // Service role API key
	httpClient *http.Client // Reused to benefit from connection pooling
}

// NewSupabaseViolationLogger creates a logger backed by the guardrail_events table.
// Reuses the same credentials as the main supabase.Client.
func NewSupabaseViolationLogger(supabaseURL, supabaseKey string) *SupabaseViolationLogger {
	return &SupabaseViolationLogger{
		url: supabaseURL,
		key: supabaseKey,
		httpClient: &http.Client{
			Timeout: 6 * time.Second, // Outer client timeout (goroutine budget)
		},
	}
}

// guardrailEventRow is the JSON shape written to the database.
// Flattens FilterVerdict fields for direct column mapping.
type guardrailEventRow struct {
	ID         string                 `json:"id"`
	CreatedAt  string                 `json:"created_at"`
	Layer      string                 `json:"layer"`
	FilterName string                 `json:"filter_name"`
	Phone      string                 `json:"phone,omitempty"`
	JobID      string                 `json:"job_id,omitempty"`
	Blocked    bool                   `json:"blocked"`
	RiskScore  float64                `json:"risk_score"`
	Reason     string                 `json:"reason,omitempty"`
	Violations []ViolationDetail      `json:"violations"`
	Metadata   map[string]interface{} `json:"metadata"`
}

// LogViolation implements ViolationLogger.
// Spawns a short-lived goroutine to persist the event asynchronously.
func (l *SupabaseViolationLogger) LogViolation(ctx context.Context, event GuardrailEvent) {
	// Capture all values before the goroutine to avoid data races on the caller's stack.
	row := l.toRow(event)

	go func() {
		// Dedicate a fresh context with bounded timeout — the parent ctx may already
		// be cancelled by the time this goroutine runs.
		insertCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		if err := l.insert(insertCtx, row); err != nil {
			log.Printf("⚠️ [Guardrail/Logger] Falha ao persistir evento (layer=%s filter=%s): %v",
				row.Layer, row.FilterName, err)
			// Fail-silent: do not propagate. The guardrail itself already acted correctly.
		}
	}()
}

// insert performs the actual HTTP POST to the Supabase REST endpoint.
func (l *SupabaseViolationLogger) insert(ctx context.Context, row guardrailEventRow) error {
	payload, err := json.Marshal(row)
	if err != nil {
		return fmt.Errorf("marshal error: %w", err)
	}

	reqURL := fmt.Sprintf("%s/rest/v1/guardrail_events", l.url)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("request creation error: %w", err)
	}

	req.Header.Set("apikey", l.key)
	req.Header.Set("Authorization", "Bearer "+l.key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal") // Avoid response body overhead

	resp, err := l.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase error (%d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// toRow converts a GuardrailEvent to the flat DB row format.
func (l *SupabaseViolationLogger) toRow(event GuardrailEvent) guardrailEventRow {
	id := event.ID
	if id == "" {
		id = generateID()
	}

	ts := event.Timestamp
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	violations := event.Verdict.Violations
	if violations == nil {
		violations = []ViolationDetail{} // Never insert null — use empty array
	}

	meta := event.Metadata
	if meta == nil {
		meta = map[string]interface{}{}
	}

	return guardrailEventRow{
		ID:         id,
		CreatedAt:  ts.Format(time.RFC3339Nano),
		Layer:      event.Layer,
		FilterName: event.FilterName,
		Phone:      event.Phone,
		JobID:      event.JobID,
		Blocked:    event.Verdict.Blocked,
		RiskScore:  event.Verdict.RiskScore,
		Reason:     event.Verdict.Reason,
		Violations: violations,
		Metadata:   meta,
	}
}

// generateID returns a UUID-format hex ID using stdlib crypto/rand.
func generateID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(b)
}

// ─── Ensure interface compliance at compile time ──────────────────────────────

var _ ViolationLogger = (*SupabaseViolationLogger)(nil)
