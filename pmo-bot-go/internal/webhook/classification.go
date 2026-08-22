package webhook

import "strings"

// HITLVerdict represents the normalized decision for an incoming producer message.
type HITLVerdict string

const (
	HITLVerdictApprove   HITLVerdict = "APPROVE"
	HITLVerdictReject    HITLVerdict = "REJECT"
	HITLVerdictAmbiguous HITLVerdict = "AMBIGUOUS"
)

// ClassifyHITLResponse performs deterministic keyword normalization on incoming text messages.
func ClassifyHITLResponse(text string) HITLVerdict {
	norm := strings.ToLower(strings.TrimSpace(text))
	norm = strings.Trim(norm, ".!?,;:\r\n\"'")

	switch norm {
	case "1", "sim", "s", "ok", "confirma", "confirmar", "confirmo", "pode salvar", "salva", "salvar", "correto", "gravar", "grava", "pode gravar", "tá certo", "ta certo", "positivo":
		return HITLVerdictApprove
	case "2", "nao", "não", "n", "cancela", "cancelar", "cancelo", "errado", "anular", "descartar", "descarta", "deixa quieto", "não salva", "nao salva", "negativo":
		return HITLVerdictReject
	default:
		return HITLVerdictAmbiguous
	}
}
