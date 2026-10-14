package state

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// StateAguardandoDetalheCompra: a compra já foi gravada e o bot perguntou o
// tipo do insumo e/ou o peso da embalagem (mcp.resultadoCompra). A próxima
// mensagem completa o registro; se for outro assunto, segue o fluxo normal.
const StateAguardandoDetalheCompra = "aguardando_detalhe_compra"

// IniciarComplementoCompra lê o "complemento" do resultado de
// registrar_compra_insumo, guarda o estado da conversa e devolve a pergunta
// a anexar à resposta ("" quando não falta nada).
func IniciarComplementoCompra(hm *history.Manager, phone string, result interface{}) string {
	m, ok := result.(map[string]interface{})
	if !ok {
		return ""
	}
	c, ok := m["complemento"].(map[string]interface{})
	if !ok {
		return ""
	}
	pergunta, _ := c["pergunta"].(string)
	if pergunta == "" || hm == nil {
		return ""
	}
	hm.SetFSMState(phone, StateAguardandoDetalheCompra, c, nil)
	return pergunta
}

var (
	reKg          = regexp.MustCompile(`(\d+(?:[.,]\d+)?)\s*(?:kg|kgs|quilos?|kilos?|quilogramas?)\b`)
	reNumeroFinal = regexp.MustCompile(`(?:^|[\s,;])(\d+(?:[.,]\d+)?)\s*$`)
	// Palavras de enchimento nas pontas da resposta ("era NPK", "cada saco tem").
	reEnchimento       = regexp.MustCompile(`(?i)^(?:(?:é|e|era|foi|o|a|de|do|da|um|uma|cada|saco|sacos|tem|têm|com|pesa|pesam)\s+)+|(?:\s+(?:e|de|o|a|cada|saco|sacos|tem|têm|com|pesa|pesam))+$`)
	inicioOutroAssunto = []string{"comprei", "vendi", "colhi", "plantei", "semeei", "apliquei", "paguei",
		"quando", "como", "qual", "quanto custa", "onde", "porque", "por que", "registar", "registrar"}
)

type respostaDetalhe struct {
	tipo   string
	pesoKg float64
	pular  bool
	outro  bool
}

// interpretarDetalheCompra separa tipo e peso de respostas como
// "NPK 12-24-12, 50 kg", "ureia 50" ou "50kg".
func interpretarDetalheCompra(body string, faltaTipo, faltaPeso bool) respostaDetalhe {
	t := strings.TrimSpace(body)
	n := utils.Normalize(strings.Trim(t, ".!"))
	switch n {
	case "nao sei", "nao", "pular", "depois", "ignorar", "nao lembro", "sei la", "nenhum":
		return respostaDetalhe{pular: true}
	}
	if strings.Contains(t, "?") || len([]rune(t)) > 80 {
		return respostaDetalhe{outro: true}
	}
	for _, p := range inicioOutroAssunto {
		if strings.HasPrefix(n, p) {
			return respostaDetalhe{outro: true}
		}
	}

	var r respostaDetalhe
	resto := t
	if faltaPeso {
		if m := reKg.FindStringSubmatchIndex(strings.ToLower(resto)); m != nil {
			r.pesoKg = numero(resto[m[2]:m[3]])
			resto = resto[:m[0]] + resto[m[1]:]
		} else if m := reNumeroFinal.FindStringSubmatchIndex(resto); m != nil {
			r.pesoKg = numero(resto[m[2]:m[3]])
			resto = resto[:m[2]]
		}
	}
	if faltaTipo {
		tipo := strings.Trim(resto, " ,;.-")
		tipo = strings.TrimSpace(reEnchimento.ReplaceAllString(tipo, ""))
		tipo = strings.Trim(tipo, " ,;.-")
		if tipo != "" && !soNumero(tipo) {
			r.tipo = tipo
		}
	}
	if r.tipo == "" && r.pesoKg <= 0 {
		r.outro = true
	}
	return r
}

func numero(s string) float64 {
	f, _ := strconv.ParseFloat(strings.Replace(s, ",", ".", 1), 64)
	return f
}

func soNumero(s string) bool {
	_, err := strconv.ParseFloat(strings.Replace(s, ",", ".", 1), 64)
	return err == nil
}

// HandleDetalheCompra trata a resposta à pergunta de complemento. tratado=false
// quando a mensagem é outro assunto: o estado é limpo e o fluxo segue normal.
func HandleDetalheCompra(
	ctx context.Context,
	msg ports.IncomingEnvelope,
	phone string,
	body string,
	profile *supabase.Profile,
	ctxFSM map[string]interface{},
	respondWithAudio bool,
	sbClient *supabase.Client,
	wpClient ports.ChannelSender,
	ttsClient ports.Synthesizer,
	historyManager *history.Manager,
) (ProcessResult, bool) {
	faltaTipo, _ := ctxFSM["falta_tipo"].(bool)
	faltaPeso, _ := ctxFSM["falta_peso"].(bool)
	compraID, _ := ctxFSM["compra_id"].(string)
	produto, _ := ctxFSM["produto"].(string)
	unidade, _ := ctxFSM["unidade"].(string)
	quantidade, _ := ctxFSM["quantidade"].(float64)

	r := interpretarDetalheCompra(body, faltaTipo, faltaPeso)
	if r.outro || compraID == "" {
		historyManager.ClearFSMState(phone)
		return ProcessResult{}, false
	}
	historyManager.ClearFSMState(phone)

	responder := func(texto string) {
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, texto, respondWithAudio)
	}
	if r.pular {
		responder(porPais(phone, "Tudo bem, a compra fica registrada assim.", "Tudo bem, a compra fica registada assim."))
		return ProcessResult{Success: true, Reason: "complemento_compra_pulado"}, true
	}

	if err := sbClient.ComplementarCompraInsumo(ctx, compraID, profile.ID, r.tipo, r.pesoKg); err != nil {
		log.Printf("❌ [Compra] Complemento falhou para %s: %v", compraID, err)
		responder(porPais(phone, "❌ Não consegui guardar esse detalhe. A compra continua registrada.",
			"❌ Não consegui guardar esse detalhe. A compra continua registada."))
		return ProcessResult{Success: false, Reason: "complemento_compra_erro"}, true
	}

	responder(textoComplementoGravado(phone, profile, sbClient, produto, unidade, quantidade, r))
	return ProcessResult{Success: true, Reason: "complemento_compra"}, true
}

// textoComplementoGravado confirma o que foi anotado e, só em área orgânica
// ou em transição, avisa quando o insumo está na lista de proibidos. Em
// produção convencional ureia/NPK são normais: nada de alerta.
func textoComplementoGravado(phone string, profile *supabase.Profile, sbClient *supabase.Client, produto, unidade string, quantidade float64, r respostaDetalhe) string {
	var partes []string
	if r.tipo != "" {
		partes = append(partes, fmt.Sprintf("%s: %s", produto, r.tipo))
	}
	if r.pesoKg > 0 {
		unid := strings.TrimSuffix(unidade, "s")
		p := fmt.Sprintf("%s de %s kg", unid, formatarNumeroBR(r.pesoKg))
		if quantidade > 0 {
			p += fmt.Sprintf(" (%s kg no total)", formatarNumeroBR(r.pesoKg*quantidade))
		}
		partes = append(partes, p)
	}
	texto := "✅ Anotado — " + strings.Join(partes, ", ") + "."

	modalidade := ""
	if profile != nil {
		modalidade = strings.ToUpper(profile.ModalidadePredominante)
	}
	if r.tipo != "" && (modalidade == "ORGANICO" || modalidade == "TRANSICAO") && sbClient != nil && sbClient.IsProhibitedCheck(r.tipo) {
		texto += porPais(phone,
			fmt.Sprintf("\n\n⚠️ %s não é permitido na produção orgânica. A compra fica registrada, mas aplicar numa área orgânica compromete a certificação.", r.tipo),
			fmt.Sprintf("\n\n⚠️ %s não é permitido na produção orgânica. A compra fica registada, mas aplicar numa machamba orgânica compromete a certificação.", r.tipo))
	}
	return texto
}

func formatarNumeroBR(f float64) string {
	if f == float64(int64(f)) {
		return strconv.FormatInt(int64(f), 10)
	}
	return strings.Replace(strconv.FormatFloat(f, 'f', -1, 64), ".", ",", 1)
}
