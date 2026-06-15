# PLAN-whatsapp-ux-buttons.md - WhatsApp UX Refactoring: Interactive Buttons & Business Logic

This document details the implementation plan to support native interactive buttons (Evolution API) in WhatsApp flows, silence the LLM orchestrator during Human-in-the-Loop (HITL) requests, make quantity fields optional in the insumo purchase tool, and improve HITL messages formatting.

---

## Overview

The Goal is to improve WhatsApp UX by replacing plain text prompt approvals ("SIM/NÃO") with native quick reply buttons ("SIM" and "NÃO") via Evolution API, preventing Gemini from generating conversational text during active HITL approvals (preventing double messages), making quantity/talhão allocation optional when registering a purchase, and cleanly formatting Go map structures in HITL text blocks.

---

## Project Type
**BACKEND** (Go codebase in `pmo-bot-go`)

---

## Success Criteria

1. **Native Quick Reply Buttons**: Under pending HITL, Evolution API receives a `POST /send/button` request containing two reply-type buttons (SIM and NÃO).
2. **Webhook Click Processing**: A webhook event `"ButtonClick"` containing `"SIM"` or `"NÃO"` as `buttonText` is parsed and processed exactly like user text input.
3. **Orchestrator Bypass**: When HITL is triggered, the Orchestrator stops LLM text generation, yielding only the button prompt (no redundant text responses like "Consulta Técnica").
4. **Optional Quantities in Purchase**: `RegistrarCompraInsumoRPC` allows registering a purchase without physical quantities (weight/volume) or a specific talhão allocation (falling back to global cost if omitted).
5. **Clean HITL Output Formatting**: Map types (like allocations) are formatted cleanly (e.g. key-value bullet points or braces) instead of internal Go representation (`map[...]`).

---

## Tech Stack
* **Go** (v1.22+)
* **Evolution API** (`POST /send/button`)
* **Supabase / Postgres** (RPC layer)
* **Gemini Pro** (LLM Provider)

---

## File Structure

```
pmo-bot-go/
├── internal/
│   ├── ports/
│   │   └── whatsapp.go (Update MessageSender interface)
│   ├── adapter/
│   │   ├── evolution/
│   │   │   └── adapter.go (Implement SendButton and parse ButtonClick webhook)
│   │   └── wppconnect/
│   │       └── adapter.go (Stub implementation of SendButton)
│   ├── state/
│   │   ├── fsm.go (Bypass fallback text on hitl_pending)
│   │   ├── orchestrator.go (Send button on HITL and return early with hitl_pending status)
│   │   ├── specialized_handlers.go (Handle hitl_pending status from orchestrator)
│   │   └── handlers_manejo_test.go (Update test mocks)
│   ├── mcp/
│   │   ├── tools_registry.go (Make quantity_valor/quantidade_unidade optional in registrar_compra_insumo definition)
│   │   └── tools_manejo.go (Update handleRegistrarCompraInsumo input validation)
│   ├── guardrails/
│   │   └── hitl.go (Clean formatting for map types in BuildConfirmationMessage)
│   └── prompt/
│       └── prompts/
│           └── system_prompt.md (Document optional quantity/talhão in registrar_compra_insumo rules)
```

---

## Proposed Changes

### Component 1: Ports & Adapters (Interactive Buttons)

#### [MODIFY] [whatsapp.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/ports/whatsapp.go)
* Add `SendButton(to string, title, description, footer string, buttons []map[string]string) error` to the `MessageSender` interface.

#### [MODIFY] [adapter.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/adapter/evolution/adapter.go)
* Implement `SendButton(to string, title, description, footer string, buttons []map[string]string) error` by posting to `%s/send/button` with the required `ButtonStruct` format.
* Update `ParseWebhook` to handle the `ButtonClick` event:
  * Extract `buttonText` (or `buttonId` if empty) from `data`.
  * Map `key.remoteJid` to `From`, `key.id` to `ID`, and `key.fromMe` to `IsFromMe`.
  * Return a normalized `ports.IncomingMessage` with `Body` set to `"SIM"` or `"NÃO"`.

#### [MODIFY] [adapter.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/adapter/wppconnect/adapter.go)
* Implement a stub `SendButton` that prints a warning/fallback log and uses the existing `SendMessage` to deliver the text-based buttons representation.

#### [MODIFY] [handlers_manejo_test.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/state/handlers_manejo_test.go)
* Add stub `SendButton` method to `mockSender` struct to satisfy the modified `MessageSender` interface.

---

### Component 2: State Machine & Orchestrator (Bypass / Silence LLM)

#### [MODIFY] [orchestrator.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/state/orchestrator.go)
* Modify the HITL block inside `ExecuteAgenticLoop`:
  * If a high-risk tool matches and `RequestApproval` succeeds, send the native buttons via `o.WhatsApp.SendButton` (instead of sending a text message).
  * Return immediately from `ExecuteAgenticLoop` with `"", history, trace, usage, effectiveModel, fmt.Errorf("hitl_pending")`. This prevents Gemini from continuing the loop and generating a technical response.

#### [MODIFY] [specialized_handlers.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/state/specialized_handlers.go)
* In `handleDuvidaFallback`:
  * If `orchestrator.ExecuteAgenticLoop` returns an error with message `"hitl_pending"`:
    * Save the history using `historyManager.AppendAgnosticHistory`.
    * Log the interaction via `recordLog` with value `"[HITL PENDING]"`.
    * Return an empty string `""` and `ProcessResult{Success: false, Reason: "hitl_pending"}` to the caller.

#### [MODIFY] [fsm.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/state/fsm.go)
* At the consolidated feedback block:
  * If `lastRes.Reason == "hitl_pending"`, return `lastRes` immediately without sending any fallback message, allowing full silence for the conversational text.

---

### Component 3: Tool Schemas & System Prompts (Optional Parameters)

#### [MODIFY] [tools_registry.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/mcp/tools_registry.go)
* Update `registrar_compra_insumo` definition:
  * Remove `"quantidade_valor"` and `"quantidade_unidade"` from the `"required"` parameters list. The new required parameters list will be: `[]string{"pmo_id", "propriedade_id", "produto"}`.

#### [MODIFY] [tools_manejo.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/mcp/tools_manejo.go)
* Update `handleRegistrarCompraInsumo`:
  * Modify validation: only return a fatal error if `produto` is empty. Allow `qtdValor <= 0` or empty units to pass as optional/nil values.
  * In `rpcArgs`, only pass the float value of `quantidade_valor_arg` and string `quantidade_unidade_arg` if they are defined (not zero/empty), otherwise pass `nil` so it maps to Postgres `NULL`.

#### [MODIFY] [system_prompt.md](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/prompt/prompts/system_prompt.md)
* In `system_prompt.md`, update the `## DIRETRIZES DE ENTREVISTA ATIVA (DADOS FALTANTES)` section:
  * Explicitly state that `registrar_compra_insumo` is an exception: physical quantities (weight/volume) and talhão allocation (`alocacoes_talhoes`) are optional. If the user omits them, register without them (talhão defaults to general cost automatically).

---

### Component 4: HITL Message Formatters (Clean Output)

#### [MODIFY] [hitl.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/guardrails/hitl.go)
* Refactor `formatArgsForHuman` and map-formatting helpers:
  * If a value `v` is of type map (or slice of maps), pretty-print its elements cleanly (e.g. using simple indentation, braces, or bullet lists) instead of using raw `%v` format that outputs internal Go syntax (`map[key:value]`).

---

## Verification Plan

### Automated Tests
* Run the existing Go test suite:
  ```bash
  go test -v ./internal/state/...
  go test -v ./internal/webhook/...
  ```

### Manual Verification
1. **Evolution Webhook Integration Test**: Send a mock webhook payload of type `"ButtonClick"` to `http://localhost:8080/webhook/evolution` with data containing `"SIM"` to confirm execution.
2. **Evolution API Mocking**: Ensure the simulated webhook routes correctly to `handleHITLResponse` and triggers the corresponding MCP tool registration.
3. **Optional Quantity Purchase Test**: Invoke `registrar_compra_insumo` without specifying quantities and confirm it inserts successfully into the database (the database defaults physical volume to NULL and talhão rateios to general cost).
