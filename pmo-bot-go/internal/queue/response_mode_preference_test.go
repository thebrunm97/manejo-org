package queue

import (
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

func TestShouldRespondWithAudioFor_Precedencia(t *testing.T) {
	casos := []struct {
		nome string
		job  *Job
		pref ports.ResponsePreference
		quer bool
	}{
		{
			nome: "preferencia texto silencia entrada de audio",
			job:  &Job{RawPayload: ports.IncomingMessage{IsAudio: true}},
			pref: ports.PreferenceText,
			quer: false,
		},
		{
			nome: "preferencia audio ativa audio em entrada de texto",
			job:  &Job{RawPayload: ports.IncomingMessage{IsAudio: false}},
			pref: ports.PreferenceAudio,
			quer: true,
		},
		{
			nome: "modo ja resolvido a montante vence a preferencia",
			job:  &Job{HasExplicitResponseMode: true, RespondWithAudio: false},
			pref: ports.PreferenceAudio,
			quer: false,
		},
		{
			nome: "sem preferencia, espelha a entrada",
			job:  &Job{RawPayload: ports.IncomingMessage{IsAudio: true}},
			pref: ports.PreferenceAuto,
			quer: true,
		},
		{
			nome: "job nil nao entra em panico",
			job:  nil,
			pref: ports.PreferenceAudio,
			quer: false,
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := c.job.ShouldRespondWithAudioFor(c.pref); got != c.quer {
				t.Errorf("= %v, queria %v", got, c.quer)
			}
		})
	}
}

// Um job legado, enfileirado ANTES do DT-29 e ainda na fila durante o deploy,
// carrega o espelhamento da entrada nos campos RespondAudio/RespondWithAudio.
// A preferência precisa vencer esses campos: caso contrário o produtor que
// acabou de mandar "modo texto" receberia áudio na mensagem seguinte, sem
// entender por quê, e concluiria que o comando não funciona.
func TestShouldRespondWithAudioFor_PreferenciaVenceJobLegado(t *testing.T) {
	legado := &Job{
		RespondAudio:     true, // campo legado
		RespondWithAudio: true, // campo legado
		RawPayload:       ports.IncomingMessage{IsAudio: true},
	}

	if legado.ShouldRespondWithAudioFor(ports.PreferenceText) {
		t.Error("preferencia texto deveria vencer os campos legados do job")
	}
}

// A função antiga precisa decidir exatamente como antes do DT-29.
func TestShouldRespondWithAudio_CompatibilidadePreservada(t *testing.T) {
	casos := []struct {
		nome string
		job  *Job
		quer bool
	}{
		{"explicito true", &Job{HasExplicitResponseMode: true, RespondWithAudio: true}, true},
		{"explicito false", &Job{HasExplicitResponseMode: true, RespondWithAudio: false}, false},
		{"legado RespondAudio", &Job{RespondAudio: true}, true},
		{"payload de audio", &Job{RawPayload: ports.IncomingMessage{IsAudio: true}}, true},
		{"texto puro", &Job{}, false},
		{"nil", nil, false},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := c.job.ShouldRespondWithAudio(); got != c.quer {
				t.Errorf("= %v, queria %v", got, c.quer)
			}
		})
	}
}

// A métrica precisa espelhar a mesma precedência da decisão. Se as duas
// divergirem, o painel atribui a decisão à causa errada em silêncio — e a
// adoção do DT-29 é justamente o número que falta para dimensionar a VPS.
func TestResponseModeSource_EspelhaAPrecedencia(t *testing.T) {
	casos := []struct {
		nome string
		msg  ports.IncomingMessage
		pref ports.ResponsePreference
		quer string
	}{
		{"explicito", ports.IncomingMessage{HasExplicitResponseMode: true}, ports.PreferenceAudio, "explicit"},
		{"preferencia texto", ports.IncomingMessage{IsAudio: true}, ports.PreferenceText, "preference_text"},
		{"preferencia audio", ports.IncomingMessage{}, ports.PreferenceAudio, "preference_audio"},
		{"payload legado", ports.IncomingMessage{RespondWithAudio: true}, ports.PreferenceAuto, "legacy_payload"},
		{"audio legado", ports.IncomingMessage{IsAudio: true}, ports.PreferenceAuto, "legacy_audio"},
		{"default", ports.IncomingMessage{}, ports.PreferenceAuto, "default"},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := responseModeSource(c.msg, c.pref); got != c.quer {
				t.Errorf("= %q, queria %q", got, c.quer)
			}
		})
	}
}
