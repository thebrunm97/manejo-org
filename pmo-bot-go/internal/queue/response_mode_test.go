package queue

import (
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

func TestJobShouldRespondWithAudioUsesExplicitFlag(t *testing.T) {
	job := &Job{RespondWithAudio: true}

	if !job.ShouldRespondWithAudio() {
		t.Fatalf("expected explicit respond-with-audio flag to be honored")
	}
}

// Desde 2026-10-08 a entrada em áudio, sozinha, não gera mais resposta em
// áudio (custo de dados do produtor) — só com "modo áudio" ou modo gravado.
func TestJobShouldRespondWithAudioNaoEspelhaEntradaEmAudio(t *testing.T) {
	job := &Job{RawPayload: ports.IncomingEnvelope{IsAudio: true}}

	if job.ShouldRespondWithAudio() {
		t.Fatalf("áudio recebido sem preferência deveria responder só em texto")
	}
}

func TestJobShouldRespondWithAudioPrefersExplicitFalseOverLegacyAudio(t *testing.T) {
	job := &Job{
		RespondWithAudio:        false,
		HasExplicitResponseMode: true,
		RawPayload: ports.IncomingEnvelope{
			IsAudio:                 true,
			HasExplicitResponseMode: true,
			RespondWithAudio:        false,
		},
	}

	if job.ShouldRespondWithAudio() {
		t.Fatalf("expected explicit false to override legacy audio fallback")
	}
}
