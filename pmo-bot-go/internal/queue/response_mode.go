package queue

// ShouldRespondWithAudio centraliza a decisão de resposta em áudio para o pipeline.
// A intenção explícita do job tem prioridade; em seguida, mantemos compatibilidade
// com jobs legados que ainda dependem de `respond_audio` ou de uma entrada de áudio.
func (j *Job) ShouldRespondWithAudio() bool {
	if j == nil {
		return false
	}

	if j.HasExplicitResponseMode {
		return j.RespondWithAudio
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
