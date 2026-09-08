package memory

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

type ImportanceResult struct {
	Score    float64
	Category string
	Reasons  []string // exportado para logging no Prometheus
}

// normalizeForHash retorna o texto lowercase+trim para uso em content_hash.
func normalizeForHash(text string) string {
	return strings.ToLower(strings.TrimSpace(text))
}

var AgronomicKeywords = []string{
	"plantio", "colheita", "semente", "muda", "enxerto",
	"orgânico", "adubo", "composto", "biofertilizante",
	"praga", "fungo", "nematóide", "defensivo", "calda",
	"rotação", "pousio", "cobertura morta",
	"talhão", "canteiro", "estufa", "irrigação",
	"ibama", "mapa", "certifior", "ifoam", "in77", "normativa",
	"certificação", "rastreabilidade", "caderno de campo",
	"custo", "venda", "nota fiscal", "caixa", "despesa",
}

// reTalhaoNumero detecta padrões como "talhão 3", "talhao4", "talh. 12".
var reTalhaoNumero = regexp.MustCompile(`talh[ãa]o\s*\d+`)

// reDoseAplicacao detecta formatos de dose em português brasileiro.
var reDoseAplicacao = regexp.MustCompile(`(?i)\d+(?:[,.]\d+)?\s*(ml|l|litro|litros|g|grama|gramas|kg|quilo|quilos)\s*(/ha|por\s+ha|por\s+hectare)?\b`)

var reQuantitative = regexp.MustCompile(`\b\d+\b`)

func hasQuantitativeData(text string) bool {
	return reQuantitative.MatchString(text)
}

func mentionsTalhao(text string) bool {
	return strings.Contains(text, "talhão") || strings.Contains(text, "talhao")
}

func mentionsRegulation(text string) bool {
	regs := []string{"ibama", "mapa", "in77", "certifica", "normativa"}
	for _, r := range regs {
		if strings.Contains(text, r) {
			return true
		}
	}
	return false
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func minF(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func EvaluateImportance(text string) ImportanceResult {
	runeLen := utf8.RuneCountInString(strings.TrimSpace(text))
	if runeLen < 10 {
		return ImportanceResult{Score: 0, Category: "noise", Reasons: []string{"too_short"}}
	}

	lower := strings.ToLower(text)
	score := 0.0
	var reasons []string
	category := "general"

	// Regra 1: keywords agronômicas/regulatórias (+0.15 cada, máx 0.60)
	hits := 0
	for _, kw := range AgronomicKeywords {
		if strings.Contains(lower, kw) {
			hits++
			reasons = append(reasons, "keyword:"+kw)
			if hits >= 4 {
				break
			}
		}
	}

	if hits > 0 {
		// Anti-ruído: normaliza por densidade de keywords no texto.
		baseBonus := float64(min(hits, 4)) * 0.15
		ratio := float64(hits*50) / float64(runeLen)
		densityFactor := minF(1.0, 0.5+0.5*ratio) // varia entre [0.5, 1.0]
		score += baseBonus * densityFactor
		category = "agronomy"
	}

	// Regra 2: dados quantitativos (quantidades, datas) → +0.10
	if hasQuantitativeData(lower) {
		score += 0.10
		reasons = append(reasons, "has_quantities")
	}

	// Regra 3: talhão + número explícito → +0.20 (padrão fortemente agronômico)
	if reTalhaoNumero.MatchString(lower) {
		score += 0.20
		reasons = append(reasons, "talhao_numero")
		category = "farm_context"
	} else if mentionsTalhao(lower) {
		score += 0.10
		reasons = append(reasons, "mentions_talhao")
		category = "farm_context"
	}

	// Regra 4: dose de aplicação (insumo + quantidade + unidade) → +0.15
	if reDoseAplicacao.MatchString(lower) && hits > 0 {
		score += 0.15
		reasons = append(reasons, "insumo_dose_unidade")
	}

	// Regra 5: menção regulatória → +0.20
	if mentionsRegulation(lower) {
		score += 0.20
		reasons = append(reasons, "regulatory")
		category = "regulation"
	}

	// Penalidade: texto muito longo e genérico → -0.10
	if runeLen > 500 && hits == 0 {
		score -= 0.10
		reasons = append(reasons, "long_unstructured")
	}

	if score > 1.0 {
		score = 1.0
	}
	if score < 0 {
		score = 0
	}
	return ImportanceResult{Score: score, Category: category, Reasons: reasons}
}
