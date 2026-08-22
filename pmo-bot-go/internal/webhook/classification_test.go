package webhook_test

import (
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/webhook"
)

func TestClassifyHITLResponse(t *testing.T) {
	approvals := []string{
		"1", "sim", "SIM", "Sim.", "s", "ok", "OK!", "confirma", "confirmar",
		"confirmo", "pode salvar", "salva", "salvar", "correto", "pode gravar",
		"tá certo", "ta certo", "positivo",
	}

	for _, text := range approvals {
		verdict := webhook.ClassifyHITLResponse(text)
		if verdict != webhook.HITLVerdictApprove {
			t.Errorf("Esperava APPROVE para '%s', mas obteve %s", text, verdict)
		}
	}

	rejections := []string{
		"2", "nao", "NAO", "não", "Não!", "n", "cancela", "cancelar",
		"cancelo", "errado", "anular", "descartar", "deixa quieto", "não salva",
	}

	for _, text := range rejections {
		verdict := webhook.ClassifyHITLResponse(text)
		if verdict != webhook.HITLVerdictReject {
			t.Errorf("Esperava REJECT para '%s', mas obteve %s", text, verdict)
		}
	}

	ambiguous := []string{
		"O adubo foi 15 sacos e não 10",
		"Gostaria de saber como está o tempo",
		"Qual é a dosagem de adubo?",
		"10 caixas",
		"sim, mas altera o talhão para o 2",
	}

	for _, text := range ambiguous {
		verdict := webhook.ClassifyHITLResponse(text)
		if verdict != webhook.HITLVerdictAmbiguous {
			t.Errorf("Esperava AMBIGUOUS para '%s', mas obteve %s", text, verdict)
		}
	}
}
