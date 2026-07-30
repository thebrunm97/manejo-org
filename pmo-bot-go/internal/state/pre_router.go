package state

import (
	"regexp"
	"strings"
)

type PreRouter interface {
	Evaluate(message string) (RouterResult, bool)
}

type RegexPreRouter struct{}

var (
	greetRegex = regexp.MustCompile(`(?i)^(olá|ola|bom dia|boa tarde|boa noite|tudo bem)\??$`)
)

func (r *RegexPreRouter) Evaluate(message string) (RouterResult, bool) {
	msgLower := strings.ToLower(strings.TrimSpace(message))

	if greetRegex.MatchString(msgLower) {
		return RouterResult{
			PrimaryIntent:         IntentChat,
			Confidence:            1.0,
			ConfidenceCalibration: ConfidenceWellCalibrated,
			NeedsWrite:            false,
			WriteScope:            WriteScopeNone,
			IsMixed:               false,
			DebugMeta: DebugMeta{
				RouteSource:  "pre_router",
				RulesMatched: []string{"greetRegex"},
				Explain:      "Mensagem de saudação simples identificada via regex",
			},
		}, true
	}

	if strings.HasPrefix(msgLower, "/registrar") || strings.HasPrefix(msgLower, "/novo") {
		return RouterResult{
			PrimaryIntent:         IntentDatabase,
			Confidence:            1.0,
			ConfidenceCalibration: ConfidenceWellCalibrated,
			NeedsWrite:            true,
			WriteScope:            WriteScopeFarmRecord, // Default for /registrar
			IsMixed:               false,
			DebugMeta: DebugMeta{
				RouteSource:  "pre_router",
				RulesMatched: []string{"prefix_command"},
				Explain:      "Atalho explícito para inserção de dados na base",
			},
		}, true
	}

	return RouterResult{}, false
}
