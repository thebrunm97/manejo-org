package state

// Localização da machamba logo depois do registo, para produtores de
// Moçambique (DDI 258).
//
// O cadastro pelo WhatsApp (onboarding.go) só pede o nome e manda o resto para
// o formulário web. Em Moçambique isso não funciona: o pacote de dados é caro,
// e sem distrito e província o bot não sabe a zona agroecológica — toda
// pergunta de época de sementeira volta com "em que distrito fica a sua
// machamba?" (o mesmo sintoma do DT-130 no Brasil). Aqui a pergunta é feita
// uma vez, logo após o registo, e a resposta já cria a propriedade com
// pais = 'MZ'.
//
// A etapa nunca prende o produtor: DEPOIS pula, uma pergunta de outro assunto
// sai do estado e segue o fluxo normal, e duas respostas não reconhecidas
// encerram a etapa sem gravar nada.

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"

	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/zae"
)

// StateAguardandoMachambaMZ: registo feito, o bot pediu distrito e província.
const StateAguardandoMachambaMZ = "aguardando_machamba_mz"

const msgPedirMachambaMZ = "Para eu indicar as épocas de sementeira da sua zona, diga-me em que *distrito e província* fica a sua machamba. Ex.: *Boane, Maputo*\n\n(Se preferir fazer isto depois, responda *DEPOIS*.)"

// tabelaZAE carrega os CSVs embarcados uma vez só. Erro aqui é bug de build
// (o teste de internal/zae barra), mas a etapa degrada para "pular" em vez de
// derrubar o atendimento.
var tabelaZAE = sync.OnceValues(zae.Carregar)

func ehTelefoneMZ(phone string) bool { return strings.HasPrefix(phone, "258") }

type resultadoMachamba int

const (
	machambaOK resultadoMachamba = iota
	machambaSemProvincia
	machambaNaoReconhecida
	machambaOutroAssunto
)

type localMachamba struct {
	Distrito  string
	Provincia string // código ISO 3166-2:MZ
	Zonas     []zae.ZonaDoDistrito
	// PorProvincia: o distrito não está na lista e a zona veio da linha
	// geral da província — menos precisa.
	PorProvincia bool
}

// interpretarMachambaMZ lê a resposta à pergunta da localização. Aceita
// "Boane, Maputo", "Chókwè - Gaza" e também só "Boane" quando o distrito existe
// numa única província.
func interpretarMachambaMZ(tab *zae.Tabela, texto string) (localMachamba, resultadoMachamba) {
	t := strings.TrimSpace(texto)
	if t == "" {
		return localMachamba{}, machambaNaoReconhecida
	}

	if distrito, prov, ok := zae.SepararDistritoProvincia(t); ok && distrito != "" {
		if zonas, porProv, okZ := tab.ResolverZonas(distrito, prov); okZ {
			return localMachamba{Distrito: distrito, Provincia: prov, Zonas: zonas, PorProvincia: porProv}, machambaOK
		}
		return localMachamba{Distrito: distrito, Provincia: prov}, machambaNaoReconhecida
	}

	// Pergunta ou frase longa: o produtor mudou de assunto. Melhor sair da
	// etapa do que responder "não reconheci o distrito" a uma dúvida real.
	if strings.Contains(t, "?") || len(strings.Fields(t)) > 6 {
		return localMachamba{}, machambaOutroAssunto
	}

	switch provs := tab.ProvinciasDoDistrito(t); len(provs) {
	case 1:
		zonas, porProv, _ := tab.ResolverZonas(t, provs[0])
		return localMachamba{Distrito: t, Provincia: provs[0], Zonas: zonas, PorProvincia: porProv}, machambaOK
	case 0:
		return localMachamba{Distrito: t}, machambaNaoReconhecida
	default:
		return localMachamba{Distrito: t}, machambaSemProvincia
	}
}

// pareceLocalMZSemMachamba: produtor de Moçambique ainda sem propriedade que
// manda algo no formato "distrito, província". Exige a província explícita
// para não capturar uma conversa qualquer.
func pareceLocalMZSemMachamba(phone string, profile *supabase.Profile, body string) bool {
	if !ehTelefoneMZ(phone) || profile == nil || profile.PropriedadeAtivaID != 0 || profile.PmoAtivoID != 0 {
		return false
	}
	if strings.Contains(body, "?") || len(strings.Fields(body)) > 6 {
		return false
	}
	d, _, ok := zae.SepararDistritoProvincia(body)
	return ok && d != ""
}

// semPropriedades confirma no banco que o produtor não tem nenhuma
// propriedade (perfil sem ativa pode ter várias sem seleção).
func semPropriedades(sbClient *supabase.Client, userID string) bool {
	if sbClient == nil {
		return false
	}
	props, err := sbClient.GetPropriedadesDoUsuario(userID)
	return err == nil && len(props) == 0
}

// textoZonas descreve a(s) zona(s) para o produtor.
func textoZonas(l localMachamba) string {
	nomes := make([]string, 0, len(l.Zonas))
	for _, z := range l.Zonas {
		nomes = append(nomes, z.Zona)
	}
	switch {
	case len(nomes) == 1 && !l.PorProvincia:
		return "zona agroecológica " + nomes[0]
	case len(nomes) == 1:
		return "provavelmente zona agroecológica " + nomes[0]
	default:
		return "zonas agroecológicas " + strings.Join(nomes, ", ") + " (depende de onde fica a machamba no distrito)"
	}
}

// HandleMachambaMZ trata a resposta à pergunta da localização. tratado=false
// devolve a mensagem ao fluxo normal (o estado já foi limpo).
func HandleMachambaMZ(
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
	responder := func(texto string) {
		sendFeedback(sbClient, wpClient, ttsClient, msg.ConversationID, msg.From, texto, respondWithAudio)
	}

	switch strings.ToUpper(strings.TrimSpace(body)) {
	case "DEPOIS", "PULAR", "CANCELAR", "AGORA NAO", "AGORA NÃO":
		historyManager.ClearFSMState(phone)
		responder("Combinado! Quando quiser, é só dizer o distrito e a província da machamba. Já pode usar o assistente.")
		return ProcessResult{Success: true, Reason: "machamba_mz_adiada"}, true
	}

	tab, err := tabelaZAE()
	if err != nil {
		log.Printf("⚠️ [Onboarding MZ] Tabela ZAE indisponível: %v", err)
		historyManager.ClearFSMState(phone)
		return ProcessResult{}, false
	}

	local, res := interpretarMachambaMZ(tab, body)
	switch res {
	case machambaOutroAssunto:
		historyManager.ClearFSMState(phone)
		return ProcessResult{}, false

	case machambaSemProvincia, machambaNaoReconhecida:
		tentativas := tentativasDoContexto(ctxFSM) + 1
		if tentativas >= 2 {
			historyManager.ClearFSMState(phone)
			responder("Não consegui reconhecer o local, sem problema — fazemos isto depois. Já pode usar o assistente.")
			return ProcessResult{Success: false, Reason: "machamba_mz_desistiu"}, true
		}
		historyManager.SetFSMState(phone, StateAguardandoMachambaMZ, contextoDeTentativas(tentativas), nil)
		if res == machambaSemProvincia {
			responder(fmt.Sprintf("*%s* existe em mais de uma província. Em qual província fica a machamba? Ex.: *%s, Gaza*", local.Distrito, local.Distrito))
		} else {
			responder("Não reconheci esse local. Escreva o *distrito e a província*, separados por vírgula. Ex.: *Chókwè, Gaza*")
		}
		return ProcessResult{Success: false, Reason: "machamba_mz_nao_reconhecida"}, true
	}

	nome := "Machamba"
	if p := primeiroNome(profile.Nome); p != "" {
		nome = "Machamba de " + p
	}
	propID, pmoID, err := sbClient.CriarPropriedadeComPMO(ctx, profile.ID, nome, 0, local.Distrito, local.Provincia, "Organico")
	if err != nil {
		log.Printf("❌ [Onboarding MZ] Falha ao criar machamba de %s: %v", phone, err)
		historyManager.ClearFSMState(phone)
		responder("Tive um problema para guardar a machamba. Pode mandar o distrito e a província mais tarde?")
		return ProcessResult{Success: false, Reason: "machamba_mz_falhou"}, true
	}
	if err := sbClient.DefinirPaisPropriedade(ctx, propID, "MZ"); err != nil {
		// Não é fatal: com DDI 258 e província moçambicana em uf, o país é
		// inferido nas consultas (paisDoTenant / localizacaoParaZarc).
		log.Printf("⚠️ [Onboarding MZ] Machamba %d criada, mas falhou ao marcar país MZ: %v", propID, err)
	}
	profile.PropriedadeAtivaID = propID
	profile.PmoAtivoID = pmoID
	historyManager.ClearFSMState(phone)

	responder(fmt.Sprintf(
		"📍 Machamba registada em *%s* (%s) — %s.\n\nJá pode perguntar, por exemplo: *quando semear milho?*",
		local.Distrito, zae.Provincias[local.Provincia], textoZonas(local)))
	log.Printf("🌍 [Onboarding MZ] Machamba criada: phone=%s prop=%d %s/%s", phone, propID, local.Distrito, local.Provincia)
	return ProcessResult{Success: true, Reason: "machamba_mz_registada"}, true
}
