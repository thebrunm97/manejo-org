package queue

import "github.com/thebrunm97/pmo-bot-go/internal/ports"

// ShouldRespondWithAudio centraliza a decisão de resposta em áudio para o pipeline.
//
// Mantida por compatibilidade: equivale a decidir sem preferência conhecida.
// Chamadas novas devem usar ShouldRespondWithAudioFor, que considera o DT-29.
func (j *Job) ShouldRespondWithAudio() bool {
	return j.ShouldRespondWithAudioFor(ports.PreferenceAuto)
}

// ShouldRespondWithAudioFor decide se a resposta leva áudio, considerando a
// preferência declarada pelo produtor (DT-29).
//
// ORDEM DE PRECEDÊNCIA, do mais forte para o mais fraco:
//
//  1. Modo já resolvido a montante, no job ou no payload.
//  2. Preferência do produtor — escolha declarada, ganha do espelho.
//  3. Campos legados (RespondWithAudio, RespondAudio), para jobs enfileirados
//     antes do DT-29 e ainda na fila durante o deploy.
//  4. Espelhamento da entrada (IsAudio), o default histórico.
//
// A preferência entra ACIMA dos campos legados, e isso é deliberado: um job
// antigo na fila carrega o espelhamento da entrada como se fosse escolha, e
// respeitá-lo faria o produtor que acabou de pedir "modo texto" receber áudio
// mesmo assim, sem entender por quê.
func (j *Job) ShouldRespondWithAudioFor(pref ports.ResponsePreference) bool {
	if j == nil {
		return false
	}

	if j.HasExplicitResponseMode {
		return j.RespondWithAudio
	}

	switch pref {
	case ports.PreferenceText:
		return false
	case ports.PreferenceAudio:
		return true
	}

	if j.RespondWithAudio {
		return true
	}

	if j.RespondAudio {
		return true
	}

	if j.RawPayload.HasExplicitResponseMode {
		return j.RawPayload.RespondWithAudio
	}

	if j.RawPayload.RespondWithAudio {
		return true
	}

	return j.RawPayload.IsAudio
}
