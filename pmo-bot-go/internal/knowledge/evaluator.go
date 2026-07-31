package knowledge

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// AutomatedEvaluator is the engine for LLM-as-a-Judge RAG evaluations.
type AutomatedEvaluator struct {
	supa          *supabase.Client
	openrouter    llm.LLMProvider
	model         string
	promptVersion string
	schemaVersion string
	timeout       time.Duration
}

type JudgeResult struct {
	FaithfulnessScore    float64  `json:"faithfulness_score"`
	AnswerRelevanceScore float64  `json:"answer_relevance_score"`
	ConfidenceScore      float64  `json:"confidence_score"`
	Verdict              string   `json:"verdict"`
	ReasoningShort       string   `json:"reasoning_short"`
	UnsupportedClaims    []string `json:"unsupported_claims"`
	MissingPoints        []string `json:"missing_points"`
}

type JudgeUsage struct {
	PromptTokens     int
	CompletionTokens int
	CostUSD          float64
}

// NewAutomatedEvaluator creates a new Evaluator.
func NewAutomatedEvaluator(supa *supabase.Client, openrouter llm.LLMProvider) *AutomatedEvaluator {
	model := getenv("LLM_JUDGE_MODEL_ID", "openai/gpt-4o")
	promptVersion := getenv("JUDGE_PROMPT_VERSION", "judge_v2")
	schemaVersion := getenv("JUDGE_SCHEMA_VERSION", "v2")
	timeoutSec := getenvInt("JUDGE_TIMEOUT_SECONDS", 30)

	return &AutomatedEvaluator{
		supa:          supa,
		openrouter:    openrouter,
		model:         model,
		promptVersion: promptVersion,
		schemaVersion: schemaVersion,
		timeout:       time.Duration(timeoutSec) * time.Second,
	}
}

// EvaluateRunAsync executes the judge logic for a pending judgment.
// It uses an opportunistic goroutine to judge the result immediately.
func (e *AutomatedEvaluator) EvaluateRunAsync(exp supabase.RagExperiment, run supabase.RagExperimentRun, evalID string) {
	// We create a detached context with timeout for the background job
	ctx, cancel := context.WithTimeout(context.Background(), e.timeout)
	defer cancel()

	// Update status to processing
	err := e.supa.UpdateRagExperimentEvaluation(ctx, evalID, map[string]any{
		"status": "processing",
	})
	if err != nil {
		fmt.Printf("[Judge] Failed to mark eval %s as processing: %v\n", evalID, err)
		return
	}

	// 2. Call the LLM Judge
	result, _, err := e.callJudge(ctx, exp, run)

	if err != nil {
		_ = e.failJudgment(ctx, evalID, fmt.Sprintf("llm judge failed: %v", err))
		return
	}

	// 3. Save Success
	unsupportedJSON, _ := json.Marshal(result.UnsupportedClaims)
	missingJSON, _ := json.Marshal(result.MissingPoints)

	now := time.Now()
	err = e.supa.UpdateRagExperimentEvaluation(ctx, evalID, map[string]any{
		"status":                 "success",
		"faithfulness_score":     result.FaithfulnessScore,
		"answer_relevance_score": result.AnswerRelevanceScore,
		"confidence_score":       result.ConfidenceScore,
		"verdict":                result.Verdict,
		"reasoning_short":        result.ReasoningShort,
		"unsupported_claims":     unsupportedJSON,
		"missing_points":         missingJSON,
		"evaluated_at":           now,
	})
	if err != nil {
		fmt.Printf("[Judge] Failed to save judgment success for %s: %v\n", evalID, err)
	}
}

func (e *AutomatedEvaluator) failJudgment(ctx context.Context, evalID string, errorMsg string) error {
	fmt.Printf("[Judge] Eval %s failed: %s\n", evalID, errorMsg)
	return e.supa.UpdateRagExperimentEvaluation(ctx, evalID, map[string]any{
		"status":        "error",
		"error_message": errorMsg,
	})
}

// EvaluateRun executes the judge logic for a pending evaluation synchronously.
func (e *AutomatedEvaluator) EvaluateRun(ctx context.Context, eval supabase.RagExperimentEvaluation) error {
	// Update status to processing
	err := e.supa.UpdateRagExperimentEvaluation(ctx, eval.ID, map[string]any{
		"status": "processing",
	})
	if err != nil {
		return fmt.Errorf("failed to mark eval %s as processing: %w", eval.ID, err)
	}

	run, err := e.supa.GetRagExperimentRun(ctx, eval.RunID)
	if err != nil {
		_ = e.failJudgment(ctx, eval.ID, fmt.Sprintf("failed to get run: %v", err))
		return err
	}

	exp, err := e.supa.GetRagExperiment(ctx, run.RagExperimentID)
	if err != nil {
		_ = e.failJudgment(ctx, eval.ID, fmt.Sprintf("failed to get experiment: %v", err))
		return err
	}

	// Call the LLM Judge
	result, _, err := e.callJudge(ctx, *exp, *run)

	if err != nil {
		_ = e.failJudgment(ctx, eval.ID, fmt.Sprintf("llm judge failed: %v", err))
		return err
	}

	// Save Success
	unsupportedJSON, _ := json.Marshal(result.UnsupportedClaims)
	missingJSON, _ := json.Marshal(result.MissingPoints)

	now := time.Now()
	err = e.supa.UpdateRagExperimentEvaluation(ctx, eval.ID, map[string]any{
		"status":                 "success",
		"faithfulness_score":     result.FaithfulnessScore,
		"answer_relevance_score": result.AnswerRelevanceScore,
		"confidence_score":       result.ConfidenceScore,
		"verdict":                result.Verdict,
		"reasoning_short":        result.ReasoningShort,
		"unsupported_claims":     unsupportedJSON,
		"missing_points":         missingJSON,
		"evaluated_at":           now,
	})
	if err != nil {
		return fmt.Errorf("failed to save judgment success for %s: %w", eval.ID, err)
	}
	return nil
}

func (e *AutomatedEvaluator) callJudge(ctx context.Context, experiment supabase.RagExperiment, run supabase.RagExperimentRun) (JudgeResult, JudgeUsage, error) {
	var out JudgeResult
	judgeModel := e.model

	// Fetch model capabilities to protect against Structured Outputs failure
	modelDB, err := e.supa.GetArenaModelByID(ctx, judgeModel)
	if err == nil && !modelDB.SupportsStructuredOutputs {
		fmt.Printf("[Judge] WARNING: Configured judge model '%s' does not support structured outputs. Falling back to 'openai/gpt-4o-mini'\n", judgeModel)
		judgeModel = "openai/gpt-4o-mini"
	} else if err != nil {
		fmt.Printf("[Judge] WARNING: Could not verify if '%s' supports structured outputs (err: %v). Proceeding cautiously.\n", judgeModel, err)
	}

	systemPromptBytes, err := os.ReadFile("internal/knowledge/prompts/" + e.promptVersion + ".txt")
	if err != nil {
		return out, JudgeUsage{}, err
	}

	userPayload := map[string]any{
		"question":          experiment.QueryText,
		"retrieved_context": experiment.RetrievedChunksSnapshot,
		"generated_answer":  run.ResponseText,
	}

	userJSON, _ := json.Marshal(userPayload)

	resp, err := e.openrouter.ChatRaw(ctx, llm.ChatRequest{
		Model:        judgeModel,
		SystemPrompt: string(systemPromptBytes),
		UserPrompt:   string(userJSON),
		Temperature:  0,
		ResponseFormat: map[string]any{
			"type": "json_schema",
			"json_schema": map[string]any{
				"name":   "judge_result",
				"strict": true,
				"schema": map[string]any{
					"type": "object",
					"additionalProperties": false,
					"properties": map[string]any{
						"faithfulness_score": map[string]any{"type": "number"},
						"answer_relevance_score": map[string]any{"type": "number"},
						"confidence_score": map[string]any{"type": "number"},
						"verdict": map[string]any{"type": "string", "enum": []string{"pass", "warning", "fail"}},
						"reasoning_short": map[string]any{"type": "string"},
						"unsupported_claims": map[string]any{
							"type": "array",
							"items": map[string]any{"type": "string"},
						},
						"missing_points": map[string]any{
							"type": "array",
							"items": map[string]any{"type": "string"},
						},
					},
					"required": []string{
						"faithfulness_score",
						"answer_relevance_score",
						"confidence_score",
						"verdict",
						"reasoning_short",
						"unsupported_claims",
						"missing_points",
					},
				},
			},
		},
	})
	if err != nil {
		return out, JudgeUsage{}, err
	}

	if err := json.Unmarshal([]byte(resp.Text), &out); err != nil {
		return out, JudgeUsage{}, fmt.Errorf("judge parse error: %w", err)
	}

	return out, JudgeUsage{
		PromptTokens:     resp.Usage.PromptTokens,
		CompletionTokens: resp.Usage.CompletionTokens,
		CostUSD:          resp.Usage.CostUSD,
	}, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		var out int
		_, _ = fmt.Sscanf(v, "%d", &out)
		if out > 0 {
			return out
		}
	}
	return fallback
}
