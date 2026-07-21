# Project Plan - Training Logs Fix

## Goal
Restore the flow of interaction logs to the dashboard "Treinamento" section, which stopped receiving data on 07/04.

## Diagnosis
The `recordLog` function in `utils.go` requires a non-nil `extraction` object to register a training log. The new `handleDuvidaFallback` handler in `specialized_handlers.go` (used for RAG and complex queries) was passing `nil` as the extraction result, causing these interactions to be skipped by the training logger.

## Proposed Changes
1.  **utils.go**: Update `recordLog` to allow logging even when `extraction` is nil, provided there is a success and an intent.
2.  **specialized_handlers.go**: Synthesize a basic extraction map (e.g., `{ "query": body }`) to pass to `recordLog`.

## Verification Path
1.  Verify compilation: `go build ./...`
2.  Manual Test: Send a technical question via WhatsApp and check the `logs_treinamento` table.

## Agent Assignments
- **backend-specialist**: Logic implementation in Go.
