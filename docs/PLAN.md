# Orchestration Plan: LLM-as-a-Judge RAG Pipeline (Revised)

**Phase 1: Database Architecture (Audit & Versioning Focus)**
- Maintain `rag_run_judgments` as a separate table to preserve historical evaluations per run.
- Update `rag_run_judgments` schema (via new migration or altering `20260721230000_rag_judge_runs.sql`) to strictly include:
  - `id`, `run_id`, `judge_model`, `judge_provider`, `judge_prompt_version`, `judge_schema_version`
  - `rating`, `rationale`, `criteria_json`, `evaluated_at`, `status`, `error_message`
  - `evaluation_source` (e.g., `async`, `batch`, `manual`)
  - `is_latest` (boolean) to easily identify the active judgment.
- Add an optional cache column `latest_rating` to `rag_experiment_runs` for rapid consultation.

**Phase 2: Motor de Julgamento (`evaluator.go`)**
- Create/Update `AutomatedEvaluator` to interface with this expanded table.
- Guarantee strict mapping of JSON output into `criteria_json` and `rationale`.
- Update the Financial Prompt rule: Differentiate conceptual questions ("O que é DRE?") from data questions ("Qual meu DRE atual?"). Enforce tool usage only for data questions. Remove ambiguity between `consultar_balanco_financeiro` and `get_dre_mensal` (canonicalize tool name).

**Phase 3: Comando CLI em Lote (Idempotente)**
- Implement `cmd/evaluate/main.go` that queries `rag_experiment_runs` (or `rag_run_judgments`) checking for pending status or missing judgments.
- Execute evaluations and insert new rows into `rag_run_judgments` with `evaluation_source = 'batch'`, setting `is_latest = true` and invalidating previous ones.
- Guarantee backoff (500ms) and retry logic.

**Phase 4: Filas & Integração Assíncrona**
- Deprecate simple `go evaluator.EvaluateRun(...)` goroutine firing in `handler.go`.
- Replace with a durable job insertion (e.g., into `rag_run_judgments` with `status='pending'`) that a worker or CLI can safely consume, avoiding uncontrolled concurrency and data loss if the server crashes.

## User Approval Required
Does this revised plan accurately capture all architectural and operational constraints required?
