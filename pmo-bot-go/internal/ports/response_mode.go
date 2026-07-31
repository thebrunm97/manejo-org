package ports

// ResolveResponseMode centraliza a decisão de resposta em áudio para o pipeline.
// A preferência explícita do webhook tem prioridade; em seguida, mantemos compatibilidade
// com mensagens legadas que eram percebidas apenas pelo tipo de entrada.
func ResolveResponseMode(msg IncomingMessage) bool {
	if msg.HasExplicitResponseMode {
		return msg.RespondWithAudio
	}

	if msg.RespondWithAudio {
		return true
	}

	if msg.IsAudio {
		return true
	}

	return false
}
