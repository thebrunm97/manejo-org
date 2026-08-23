package tts

import (
	"context"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// LegacyTTSAdapter embrulha a interface TTSProvider original
// (que converte texto -> []byte) e a promove para a nova interface Synthesizer.
type LegacyTTSAdapter struct {
	provider ports.TTSProvider
}

// NewLegacyTTSAdapter cria um adaptador de TTSProvider para Synthesizer.
func NewLegacyTTSAdapter(provider ports.TTSProvider) *LegacyTTSAdapter {
	return &LegacyTTSAdapter{
		provider: provider,
	}
}

// Synthesize faz o parsing do SynthesisRequest para a chamada antiga
// GenerateSpeech e mapeia os retornos para o AudioArtifact.
func (a *LegacyTTSAdapter) Synthesize(ctx context.Context, req ports.SynthesisRequest) (ports.AudioArtifact, error) {
	data, mime, err := a.provider.GenerateSpeech(ctx, req.Text)
	if err != nil {
		return ports.AudioArtifact{}, err
	}

	return ports.AudioArtifact{
		Data:   data,
		Format: mime,
		Source: a.provider.Name(),
	}, nil
}
