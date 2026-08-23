package ports

import "strings"

// ResponsePreference é a preferência de formato declarada pelo produtor (DT-29).
//
// O valor vem da coluna `profiles.preferencia_resposta`. String vazia significa
// "nunca escolheu" e é tratada como PreferenceAuto — ver ParseResponsePreference.
type ResponsePreference string

const (
	// PreferenceAuto espelha a entrada: áudio recebido → áudio devolvido.
	// É o default, e é deliberado. Ver a migration 20260823100000 para o
	// porquê de não ser 'texto': espelhar não exige alfabetização para
	// funcionar, e o público-alvo inclui quem manda áudio justamente porque
	// ler e escrever é custoso.
	PreferenceAuto ResponsePreference = "automatico"

	// PreferenceText nunca sintetiza. É o modo que elimina carga do Piper,
	// que é o teto de capacidade da VPS (DT-38).
	PreferenceText ResponsePreference = "texto"

	// PreferenceAudio sintetiza sempre. Significa "texto E áudio", não
	// "só áudio": o texto vai antes em qualquer caso (DT-31), porque a
	// síntese leva 15-40s e pode falhar.
	PreferenceAudio ResponsePreference = "audio"
)

// ParseResponsePreference normaliza o que veio do banco ou do produtor.
//
// Aceita variações de caixa e acento porque este valor também chega por
// comando digitado no WhatsApp, onde "TEXTO", "Áudio" e "audio" são a mesma
// intenção. Qualquer valor desconhecido vira PreferenceAuto: uma preferência
// corrompida no banco não deve derrubar a decisão de entrega.
func ParseResponsePreference(raw string) ResponsePreference {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "texto", "text":
		return PreferenceText
	case "audio", "áudio", "ambos":
		// "ambos" é aceito como sinônimo de áudio: como o texto sempre vai
		// junto, "ambos" e "áudio" descrevem o mesmo comportamento.
		return PreferenceAudio
	default:
		return PreferenceAuto
	}
}

// ResolveResponseMode centraliza a decisão de resposta em áudio para o pipeline.
//
// Mantida por compatibilidade: equivale a resolver sem preferência conhecida.
// Chamadas novas devem preferir ResolveResponseModeFor, que considera o DT-29.
func ResolveResponseMode(msg IncomingMessage) bool {
	return ResolveResponseModeFor(msg, PreferenceAuto)
}

// ResolveResponseModeFor decide se a resposta leva áudio, considerando a
// preferência do produtor (DT-29).
//
// ORDEM DE PRECEDÊNCIA, do mais forte para o mais fraco:
//
//  1. Modo já resolvido a montante (HasExplicitResponseMode). O worker de IA
//     resolve uma vez e marca; reabrir a decisão depois disso faria o mesmo
//     job responder em formatos diferentes conforme o caminho de código.
//  2. Preferência do produtor. É uma escolha declarada e ganha do espelho.
//  3. Espelhamento da entrada (IsAudio), o default histórico.
//
// RespondWithAudio sem flag explícita é tratado no nível 2 por compatibilidade
// com jobs legados enfileirados antes do DT-29.
func ResolveResponseModeFor(msg IncomingMessage, pref ResponsePreference) bool {
	if msg.HasExplicitResponseMode {
		return msg.RespondWithAudio
	}

	switch pref {
	case PreferenceText:
		return false
	case PreferenceAudio:
		return true
	}

	if msg.RespondWithAudio {
		return true
	}

	return msg.IsAudio
}
