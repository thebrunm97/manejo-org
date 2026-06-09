package guardrails

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"
)

// JudgeRequest contains all the context needed for the Output Judge.
// The judge sees both the original user question and the LLM's final answer
// to evaluate conformance against agronomic safety policies.
type JudgeRequest struct {
	UserInput    string   // Original user message (after PII redaction)
	LLMOutput    string   // Final text produced by the LLM
	Intent       string   // Classified intent: RAG, DATABASE, CHAT
	ModalityFarm string   // ORGANICO | CONVENCIONAL | "" (unknown)
	ToolsUsed    []string // Names of MCP tools that were called during this turn
}

// JudgeVerdict is the result of the output governance check.
type JudgeVerdict struct {
	Approved   bool     `json:"approved"`
	Violations []string `json:"violations,omitempty"` // Policy codes violated
	Reason     string   `json:"reason,omitempty"`
	RiskScore  float64  `json:"risk_score"`
}

// OutputJudge validates the LLM's final response before it is delivered to the user.
// Implementations MUST apply the fail-open rule: if the judge itself fails
// (timeout, parse error, API error), it returns Approved=true and logs the anomaly.
type OutputJudge interface {
	Judge(ctx context.Context, req JudgeRequest) JudgeVerdict
}

// judgeCallable abstracts the LLM call needed by GeminiFlashJudge,
// avoiding a direct import cycle with the gemini package.
// The caller passes a function that matches this signature.
type judgeCallable func(prompt, systemPrompt string) (string, error)

// GeminiFlashJudge implements OutputJudge using a fast LLM (gemini-1.5-flash)
// to evaluate the final response against agronomic safety policies.
//
// Architecture:
//   - The judge runs with a 3-second hard timeout (set by caller in ctx, OR
//     enforced internally below). This prevents the judge from adding visible
//     latency to the user's experience.
//   - Fail-open: any failure (timeout, API error, parse error) returns Approved=true
//     plus a log entry. The user always receives an answer; anomalies are audited.
//   - The judge prompt is kept as a package-level const for easy policy updates.
type GeminiFlashJudge struct {
	callLLM judgeCallable
	logger  ViolationLogger
	timeout time.Duration // Defaults to 3s if zero
}

// NewGeminiFlashJudge creates an OutputJudge backed by a fast Gemini model.
//
// Usage in wiring (server main.go or orchestrator):
//
//	judge := guardrails.NewGeminiFlashJudge(
//	    func(prompt, sys string) (string, error) {
//	        resp, _, err := geminiClient.AskExpert(prompt, sys)
//	        return resp, err
//	    },
//	    guardrails.NewSupabaseViolationLogger(sbURL, sbKey),
//	)
func NewGeminiFlashJudge(callLLM judgeCallable, logger ViolationLogger) *GeminiFlashJudge {
	if logger == nil {
		logger = NoOpLogger{}
	}
	return &GeminiFlashJudge{
		callLLM: callLLM,
		logger:  logger,
		timeout: 3 * time.Second,
	}
}

// judgeSystemPrompt defines the agronomic compliance policies the judge enforces.
// It is intentionally written in Portuguese to match the production domain.
const judgeSystemPrompt = `Você é um auditor de conformidade para assistentes agrícolas orgânicos.

Sua tarefa é avaliar se a RESPOSTA DO ASSISTENTE viola alguma das políticas abaixo.
Analise apenas o que foi dito — não faça suposições ou extrapole.

## POLÍTICAS DE CONFORMIDADE (avalie cada uma)

PESTICIDAS_PROIBIDOS:
  Recomendação de pesticidas de Classe I ou II (ANVISA) para propriedades orgânicas.
  Exemplos críticos: Glifosato, Roundup, Paraquat, Malathion, Fipronil, Imidacloprid,
  Dimetoato, Metamidofós, Acefato — qualquer referência positiva/recomendatória é violação.

DOSAGEM_PERIGOSA:
  Sugestão de dosagem que exceda 300% da faixa agronômica padrão sem justificativa técnica.

ALUCINACAO_DADOS:
  Afirmação de datas, produtividades ou registros ESPECÍFICOS DA FAZENDA DO PRODUTOR
  que não foram mencionados pelo usuário e não constam no contexto fornecido.
  ATENÇÃO — NÃO é alucinação de dados:
  - Nomes de pragas, doenças e técnicas agronômicas gerais (ex: "Traça-do-tomateiro", "Tuta absoluta")
  - Recomendações de manejo baseadas em fontes públicas (Embrapa, universidades, manuais técnicos)
  - Informações técnicas que o assistente obteve via consulta RAG à base de documentos
  Se [INTENT=RAG] e [FONTE_RAG=sim], seja muito conservador ao acusar esta violação.

INFORMACAO_REGULATORIA:
  Orientação jurídica, fiscal ou regulatória (ex: como emitir nota fiscal, legislação)
  apresentada como verdade absoluta sem citar fontes oficiais.

PII_VAZAMENTO:
  Exposição de dados pessoais de outros produtores (nomes, telefones, CPF, etc.).

CONTEUDO_OFENSIVO:
  Discriminação, discurso de ódio ou linguagem inadequada para produtor rural.

## INSTRUÇÃO DE RESPOSTA

Responda SOMENTE com um objeto JSON válido, sem markdown, sem explicações extras:
{
  "approved": true,
  "violations": [],
  "reason": "",
  "risk_score": 0.0
}

Se houver violação:
{
  "approved": false,
  "violations": ["CODIGO_POLITICA"],
  "reason": "Explicação breve citando a fonte se possível (máx 120 caracteres)",
  "risk_score": 0.85
}

Códigos válidos: PESTICIDAS_PROIBIDOS, DOSAGEM_PERIGOSA, ALUCINACAO_DADOS,
INFORMACAO_REGULATORIA, PII_VAZAMENTO, CONTEUDO_OFENSIVO`

// Judge implements OutputJudge.
// Returns Approved=true (fail-open) on any internal error.
func (j *GeminiFlashJudge) Judge(ctx context.Context, req JudgeRequest) JudgeVerdict {
	// Apply a hard timeout so the judge never exceeds its budget.
	timeout := j.timeout
	if timeout <= 0 {
		timeout = 3 * time.Second
	}

	judgeCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	verdict := j.evaluate(judgeCtx, req)

	// Log every non-trivial judgment to the observability layer
	if !verdict.Approved || verdict.RiskScore > 0.1 {
		j.logger.LogViolation(ctx, GuardrailEvent{
			ID:         generateID(),
			Timestamp:  time.Now().UTC(),
			Layer:      "output",
			FilterName: "gemini_judge",
			Verdict: FilterVerdict{
				Blocked:    !verdict.Approved,
				Reason:     verdict.Reason,
				RiskScore:  verdict.RiskScore,
				Violations: policyViolationsToDetails(verdict.Violations),
			},
		})
	}

	return verdict
}

// evaluate performs the actual LLM call and parses the structured verdict.
// All error paths return fail-open (Approved=true).
func (j *GeminiFlashJudge) evaluate(ctx context.Context, req JudgeRequest) JudgeVerdict {
	prompt := buildJudgePrompt(req)

	// Channel-based execution to respect judgeCtx cancellation
	type result struct {
		text string
		err  error
	}
	ch := make(chan result, 1)

	go func() {
		text, err := j.callLLM(prompt, judgeSystemPrompt)
		ch <- result{text, err}
	}()

	select {
	case <-ctx.Done():
		log.Printf("⏰ [Judge] Timeout após %v — fail-open (entrega autorizada)", j.timeout)
		return failOpenVerdict("judge_timeout")

	case res := <-ch:
		if res.err != nil {
			log.Printf("❌ [Judge] Erro na API LLM — fail-open: %v", res.err)
			return failOpenVerdict("judge_api_error")
		}
		return parseJudgeResponse(res.text)
	}
}

// buildJudgePrompt constructs the evaluation prompt with all necessary context.
// The more context the judge has (intent, RAG source), the more precise its verdicts.
func buildJudgePrompt(req JudgeRequest) string {
	modality := req.ModalityFarm
	if modality == "" {
		modality = "NÃO INFORMADO"
	}

	tools := "nenhuma"
	if len(req.ToolsUsed) > 0 {
		tools = strings.Join(req.ToolsUsed, ", ")
	}

	// Determine if RAG was used (consulta à base de documentos da fazenda)
	usedRAG := "não"
	for _, t := range req.ToolsUsed {
		if strings.Contains(t, "document") || strings.Contains(t, "rag") || t == "consultar_documentos" {
			usedRAG = "sim"
			break
		}
	}

	intent := req.Intent
	if intent == "" {
		intent = "NÃO CLASSIFICADO"
	}

	return fmt.Sprintf(
		"[MODALIDADE DA PROPRIEDADE]: %s\n"+
			"[INTENT DA MENSAGEM]: %s\n"+
			"[FONTE_RAG (base de documentos consultada)]: %s\n"+
			"[FERRAMENTAS USADAS]: %s\n"+
			"[PERGUNTA DO PRODUTOR]: %s\n\n"+
			"[RESPOSTA DO ASSISTENTE A AVALIAR]:\n%s",
		modality,
		intent,
		usedRAG,
		tools,
		req.UserInput,
		req.LLMOutput,
	)
}

// parseJudgeResponse extracts a JudgeVerdict from the LLM's JSON response.
// Returns fail-open on any parse error.
func parseJudgeResponse(raw string) JudgeVerdict {
	// Strip markdown fences the model sometimes adds despite instructions
	clean := strings.TrimSpace(raw)
	clean = strings.TrimPrefix(clean, "```json")
	clean = strings.TrimPrefix(clean, "```")
	clean = strings.TrimSuffix(clean, "```")
	clean = strings.TrimSpace(clean)

	// Find the JSON object boundaries (extra text outside JSON is discarded)
	start := strings.Index(clean, "{")
	end := strings.LastIndex(clean, "}")
	if start == -1 || end == -1 || end <= start {
		log.Printf("⚠️ [Judge] Resposta não-JSON detectada — fail-open. Raw: %.100s", raw)
		return failOpenVerdict("judge_parse_error")
	}
	clean = clean[start : end+1]

	var verdict JudgeVerdict
	if err := json.Unmarshal([]byte(clean), &verdict); err != nil {
		log.Printf("⚠️ [Judge] Unmarshal falhou — fail-open: %v. Raw: %.100s", err, clean)
		return failOpenVerdict("judge_parse_error")
	}

	return verdict
}

// failOpenVerdict returns an approved verdict with a reason code for audit logging.
func failOpenVerdict(reason string) JudgeVerdict {
	return JudgeVerdict{
		Approved:  true,
		Reason:    reason + "_fail_open",
		RiskScore: 0,
	}
}

// policyViolationsToDetails converts string policy codes to ViolationDetail structs
// for consistent storage in the guardrail_events.violations JSONB column.
func policyViolationsToDetails(codes []string) []ViolationDetail {
	details := make([]ViolationDetail, 0, len(codes))
	for _, code := range codes {
		details = append(details, ViolationDetail{
			Rule:       code,
			Severity:   "high",
			Confidence: 0.9,
		})
	}
	return details
}

// ─── Ensure interface compliance at compile time ──────────────────────────────

var _ OutputJudge = (*GeminiFlashJudge)(nil)
