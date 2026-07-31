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

func TestJobShouldRespondWithAudioFallsBackToLegacyAudioInput(t *testing.T) {
	job := &Job{RawPayload: ports.IncomingMessage{IsAudio: true}}

	if !job.ShouldRespondWithAudio() {
		t.Fatalf("expected legacy audio input to preserve audio response preference")
	}
}

func TestJobShouldRespondWithAudioPrefersExplicitFalseOverLegacyAudio(t *testing.T) {
	job := &Job{
		RespondWithAudio:        false,
		HasExplicitResponseMode: true,
		RawPayload: ports.IncomingMessage{
			IsAudio:                 true,
			HasExplicitResponseMode: true,
			RespondWithAudio:        false,
		},
	}

	if job.ShouldRespondWithAudio() {
		t.Fatalf("expected explicit false to override legacy audio fallback")
	}
}
