package ports

import "testing"

func TestParseResponsePreference(t *testing.T) {
	casos := []struct {
		entrada string
		quer    ResponsePreference
	}{
		{"texto", PreferenceText},
		{"TEXTO", PreferenceText},
		{"  texto  ", PreferenceText},
		{"audio", PreferenceAudio},
		{"áudio", PreferenceAudio},
		{"Áudio", PreferenceAudio},
		{"ambos", PreferenceAudio}, // sinônimo: o texto sempre vai junto
		{"automatico", PreferenceAuto},
		{"", PreferenceAuto},              // nunca escolheu
		{"lixo_no_banco", PreferenceAuto}, // valor corrompido não derruba a entrega
	}

	for _, c := range casos {
		if got := ParseResponsePreference(c.entrada); got != c.quer {
			t.Errorf("ParseResponsePreference(%q) = %q, queria %q", c.entrada, got, c.quer)
		}
	}
}

func TestResolveResponseModeFor_PrecedenciaDaPreferencia(t *testing.T) {
	casos := []struct {
		nome string
		msg  IncomingEnvelope
		pref ResponsePreference
		quer bool
	}{
		{
			nome: "preferencia texto vence o espelhamento de audio",
			msg:  IncomingEnvelope{IsAudio: true},
			pref: PreferenceText,
			quer: false,
		},
		{
			nome: "preferencia audio vence entrada de texto",
			msg:  IncomingEnvelope{IsAudio: false},
			pref: PreferenceAudio,
			quer: true,
		},
		{
			nome: "preferencia texto vence campo legado RespondWithAudio",
			msg:  IncomingEnvelope{RespondWithAudio: true},
			pref: PreferenceText,
			quer: false,
		},
		{
			nome: "modo ja resolvido a montante vence ate a preferencia",
			msg:  IncomingEnvelope{HasExplicitResponseMode: true, RespondWithAudio: false},
			pref: PreferenceAudio,
			quer: false,
		},
		{
			// Desde 2026-10-08: áudio de entrada não gera mais áudio de
			// resposta sem pedido explícito (custo de dados do produtor).
			nome: "sem preferencia, audio recebido responde so em texto",
			msg:  IncomingEnvelope{IsAudio: true},
			pref: PreferenceAuto,
			quer: false,
		},
		{
			nome: "preferencia audio, audio recebido responde em audio",
			msg:  IncomingEnvelope{IsAudio: true},
			pref: PreferenceAudio,
			quer: true,
		},
		{
			nome: "sem preferencia, texto recebido responde em texto",
			msg:  IncomingEnvelope{IsAudio: false},
			pref: PreferenceAuto,
			quer: false,
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := ResolveResponseModeFor(c.msg, c.pref); got != c.quer {
				t.Errorf("= %v, queria %v", got, c.quer)
			}
		})
	}
}

// A função antiga (sem preferência conhecida) segue a mesma regra de
// ResolveResponseModeFor com PreferenceAuto: só texto, salvo modo já gravado.
func TestResolveResponseMode_CompatibilidadePreservada(t *testing.T) {
	casos := []struct {
		msg  IncomingEnvelope
		quer bool
	}{
		{IncomingEnvelope{HasExplicitResponseMode: true, RespondWithAudio: true}, true},
		{IncomingEnvelope{HasExplicitResponseMode: true, RespondWithAudio: false}, false},
		{IncomingEnvelope{RespondWithAudio: true}, true},
		{IncomingEnvelope{IsAudio: true}, false},
		{IncomingEnvelope{}, false},
	}

	for _, c := range casos {
		if got := ResolveResponseMode(c.msg); got != c.quer {
			t.Errorf("ResolveResponseMode(%+v) = %v, queria %v", c.msg, got, c.quer)
		}
	}
}
