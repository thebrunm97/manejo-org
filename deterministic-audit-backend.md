# Deterministic Audit Trail Backend Plan

## Goal
Refactor the pmo-bot-go webhook ingestion pipeline to persist all raw payloads, enforce idempotency at the database level, propagate the audit record UUID, and update status accordingly.

## Tasks
- [ ] Task 1: Extend `ports.IncomingMessage` in `internal/ports/whatsapp.go` to include `RawPayloadID` (string).
  → Verify: Run `go build ./...` to check if compiling.
- [ ] Task 2: Create a new file `internal/supabase/audit.go` defining the `RawPayload` DB model, `InsertRawPayload` method (handling 409 conflict errors), and `UpdateRawPayloadStatus` method.
  → Verify: Method signatures compile successfully.
- [ ] Task 3: Refactor the webhook handler `handleWebhook` in `internal/webhook/handler.go` to perform initial raw payload persistence on webhook entry, handle 409 conflict immediately (returning 200 OK), and populate `payload.RawPayloadID`.
  → Verify: Compilation passes.
- [ ] Task 4: Propagate `raw_payload_id` to business functions and RPCs (such as `RegistrarAtividadeRPC`, `RegistrarTransacaoComRateioRPC`, `RegistrarCompraInsumoRPC`, and `RegistrarOperacaoCampoRPC`) by passing it as part of their database query payloads.
  → Verify: Code compile check.
- [ ] Task 5: Implement status updates ('PROCESSED' or 'FAILED' with `processing_error` log) at the end of message processing in both the async Harness queue worker (`internal/queue/ai_worker.go`) and the legacy processing flow (`internal/webhook/handler.go`'s `processLegacy`).
  → Verify: Run `go build ./...` successfully.

## Done When
- [ ] The Go codebase compiles cleanly with no errors when running `go build ./...`.
- [ ] Raw payloads are inserted as 'PENDING', updated to 'PROCESSED' on success, or 'FAILED' with error details on failure.
