package memory

import (
	"strings"
	"testing"
)

func TestEvaluateImportance(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		minScore float64
		maxScore float64
		category string
	}{
		{
			name:     "Ruído muito curto",
			text:     "ok",
			minScore: 0,
			maxScore: 0.1, // Esperado 0
			category: "noise",
		},
		{
			name:     "Texto longo e genérico",
			text:     "Bom dia pessoal, queria saber se amanhã vai chover muito forte na região porque a previsão do tempo no jornal falou que talvez tenhamos uma frente fria vindo do sul e eu estou preocupado com a estrada.",
			minScore: 0,
			maxScore: 0.39, // Esperado < 0.4
			category: "general",
		},
		{
			name:     "Altamente agronômico com dose",
			text:     "apliquei calda bordalesa 2L/ha no talhão 3 hoje cedo",
			minScore: 0.65,
			maxScore: 1.0,
			category: "farm_context", // Talhão eleva para farm_context, mas também tem score alto (0.15 + 0.15 + 0.20 + 0.10)
		},
		{
			name:     "Altamente regulatório denso",
			text:     "normativa ibama certificação orgânica IN77 talhão milho",
			minScore: 0.85,
			maxScore: 1.0,
			category: "regulation",
		},
		{
			name:     "Texto longo e esparso com 1 hit",
			text:     "Estou testando uma coisa muito comprida aqui só para encher caracteres. Vamos lá, escrevendo muitas palavras, talvez um pouco de poesia sobre a vida no campo e a alegria de ver o sol nascer. Enfim, preciso perguntar sobre a colheita da minha propriedade.",
			minScore: 0.05,
			maxScore: 0.15, // Atenuado pelo densityFactor. 1 keyword = 0.15.
			category: "agronomy", // Acertou 1 keyword agronômica
		},
		{
			name:     "Texto curto denso com 1 hit",
			text:     "sobre a colheita",
			minScore: 0.14,
			maxScore: 0.16, // Fator 1.0 -> mantem 0.15 pleno
			category: "agronomy",
		},
		{
			name:     "Dados quantitativos puros",
			text:     "hoje pegamos 50 itens de tomate",
			minScore: 0.10,
			maxScore: 0.10,
			category: "general",
		},
		{
			name:     "Texto extremamente longo e vazio de palavras-chave",
			text:     "Este é um teste para garantir que a penalidade de textos muito longos e genéricos realmente é aplicada. " + strings.Repeat("Muitas palavras sem sentido agronômico preenchendo o corpo da mensagem. ", 10),
			minScore: 0,
			maxScore: 0, // Como não tem keywords (score base 0), -0.10 joga pra negativo, e o clamp < 0 joga pra 0.
			category: "general",
		},
		{
			name:     "Saturação de Score (clamp > 1.0)",
			text:     "apliquei 2L/ha de calda e adubo no talhão 3. ibama mapa in77 certificação e venda de semente",
			minScore: 1.0,
			maxScore: 1.0, // A soma teórica passa de 1.0, deve ser travada em 1.0
			category: "regulation", // Tem keywords regulatórias explícitas que disparam a regra 5
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := EvaluateImportance(tt.text)
			
			if result.Score < tt.minScore || result.Score > tt.maxScore {
				t.Errorf("Score = %v, esperado entre [%v, %v]", result.Score, tt.minScore, tt.maxScore)
			}
			
			if result.Category != tt.category {
				t.Errorf("Categoria = %v, esperado %v", result.Category, tt.category)
			}
		})
	}
}
