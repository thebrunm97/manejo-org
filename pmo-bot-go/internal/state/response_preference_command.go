package state

// response_preference_command.go — comando de preferência de formato (DT-29).
//
// O DT-29 prevê três caminhos para o produtor escolher o formato: comando no
// WhatsApp, seletor no painel web e botões interativos no primeiro contato
// (esse último casa com o DT-13). Este arquivo cobre o primeiro, que é o único
// que não exige nem que o produtor acesse o painel nem que a Evolution suporte
// botões — ou seja, o único que funciona para todo mundo hoje.

import (
	"log"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// comandosPreferencia mapeia o que o produtor digita para a preferência.
//
// A lista é generosa de propósito. Este comando é justamente o caminho de quem
// não vai abrir o painel web, e exigir a frase exata transformaria o recurso em
// pegadinha. Variações sem acento estão inclusas porque teclado de celular com
// autocorreção em português nem sempre acentua.
var comandosPreferencia = map[string]ports.ResponsePreference{
	"modo texto":      ports.PreferenceText,
	"so texto":        ports.PreferenceText,
	"só texto":        ports.PreferenceText,
	"somente texto":   ports.PreferenceText,
	"apenas texto":    ports.PreferenceText,
	"sem audio":       ports.PreferenceText,
	"sem áudio":       ports.PreferenceText,
	"parar audio":     ports.PreferenceText,
	"parar áudio":     ports.PreferenceText,
	"nao quero audio": ports.PreferenceText,
	"não quero áudio": ports.PreferenceText,

	"modo audio":            ports.PreferenceAudio,
	"modo áudio":            ports.PreferenceAudio,
	"quero audio":           ports.PreferenceAudio,
	"quero áudio":           ports.PreferenceAudio,
	"com audio":             ports.PreferenceAudio,
	"com áudio":             ports.PreferenceAudio,
	"me responde por audio": ports.PreferenceAudio,
	"me responde por áudio": ports.PreferenceAudio,

	"modo automatico": ports.PreferenceAuto,
	"modo automático": ports.PreferenceAuto,
	"modo padrao":     ports.PreferenceAuto,
	"modo padrão":     ports.PreferenceAuto,
	"automatico":      ports.PreferenceAuto,
	"automático":      ports.PreferenceAuto,
}

// confirmacaoPreferencia é o texto de volta para cada modo.
//
// Cada confirmação diz o que MUDA na prática e como voltar atrás. Um "ok,
// alterado" deixaria o produtor sem saber que existe caminho de volta, e o
// comando de retorno é a informação mais útil no momento em que ele acabou de
// descobrir que comandos existem.
var confirmacaoPreferencia = map[ports.ResponsePreference]string{
	ports.PreferenceText: "Pronto! A partir de agora respondo só por escrito. " +
		"Se quiser voltar a receber áudio, é só mandar *modo áudio*.",
	ports.PreferenceAudio: "Pronto! A partir de agora mando o texto e o áudio junto. " +
		"O texto chega primeiro e o áudio logo depois. " +
		"Se quiser parar o áudio, é só mandar *modo texto*.",
	ports.PreferenceAuto: "Pronto! Voltei ao normal: se você mandar áudio, respondo com áudio; " +
		"se mandar escrito, respondo escrito. " +
		"Pode fixar com *modo texto* ou *modo áudio* quando quiser.",
}

// parsePreferenceCommand reconhece um comando de preferência de formato.
//
// Só reconhece a mensagem INTEIRA como comando, nunca um trecho dela. Aceitar
// substring faria "não quero áudio de outra pessoa no meu talhão" mudar a
// configuração do produtor silenciosamente, no meio de uma pergunta legítima.
func parsePreferenceCommand(body string) (ports.ResponsePreference, bool) {
	limpo := strings.ToLower(strings.TrimSpace(body))
	limpo = strings.Trim(limpo, ".!?")
	limpo = strings.Join(strings.Fields(limpo), " ") // colapsa espaços repetidos

	pref, ok := comandosPreferencia[limpo]
	return pref, ok
}

// handlePreferenceCommand grava a preferência e confirma para o produtor.
//
// Devolve true quando a mensagem era um comando e já foi tratada — nesse caso
// o FSM deve encerrar sem chamar o LLM. Não faz sentido gastar uma chamada de
// modelo (e uma cota) para interpretar "modo texto".
func handlePreferenceCommand(
	body string,
	from string,
	phone string,
	sbClient *supabase.Client,
	wpClient ports.MessageSender,
	ttsClient ports.Synthesizer,
) (ProcessResult, bool) {
	pref, ok := parsePreferenceCommand(body)
	if !ok {
		return ProcessResult{}, false
	}

	log.Printf("⚙️ [FSM] Comando de preferência de formato: %q → %s", body, pref)

	if sbClient == nil || phone == "" {
		// Sem perfil não há onde gravar. Dizer isso é melhor que confirmar uma
		// mudança que não aconteceu — o produtor perceberia a discrepância na
		// mensagem seguinte, e aí sem nenhuma pista do motivo.
		_ = wpClient.SendMessage(from,
			"Ainda não consegui identificar seu cadastro para guardar essa preferência. "+
				"Assim que seu cadastro estiver ativo, o comando funciona.")
		return ProcessResult{Success: true, Reason: "preference_command_no_profile"}, true
	}

	if err := sbClient.SetResponsePreference(phone, string(pref)); err != nil {
		log.Printf("⚠️ [FSM] Falha ao gravar preferência de formato: %v", err)
		_ = wpClient.SendMessage(from,
			"Não consegui salvar essa preferência agora. Pode tentar de novo em instantes?")
		return ProcessResult{Success: false, Reason: "preference_command_persist_failed"}, true
	}

	// A confirmação já sai NO formato escolhido: quem pediu áudio recebe áudio
	// e comprova na hora que funciona; quem pediu texto não é obrigado a ouvir
	// mais um áudio justamente para saber que não vai receber mais áudios.
	confirmarComAudio := pref == ports.PreferenceAudio
	if err := sendFeedback(sbClient, wpClient, ttsClient, from, confirmacaoPreferencia[pref], confirmarComAudio); err != nil {
		log.Printf("⚠️ [FSM] Preferência gravada, mas a confirmação falhou: %v", err)
	}

	return ProcessResult{Success: true, Reason: "preference_command_" + string(pref)}, true
}
