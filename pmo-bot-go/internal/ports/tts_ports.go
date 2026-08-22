// Package ports define os contratos (interfaces) que desacoplam a lógica de
// negócio das implementações concretas de infraestrutura.
//
// Este arquivo define a fronteira de Text-to-Speech, seguindo a mesma estratégia
// já aplicada em LLMProvider (ver ai_ports.go): o domínio depende do contrato,
// nunca do fornecedor. Trocar Piper por Google Cloud TTS, ElevenLabs ou qualquer
// outro serviço deve ser uma troca de "cabo" na composição (cmd/server/main.go),
// sem tocar em nenhuma regra de negócio.
package ports

import "context"

// TTSProvider é a interface para serviços de síntese de voz (Text-to-Speech).
//
// Implementações atuais em internal/tts:
//   - PiperProvider          (auto-hospedado, OpenAI-compatible, padrão)
//   - OpenAICompatProvider   (Groq PlayAI, OpenRouter — mesmo protocolo)
//   - GoogleTranslateProvider (endpoint não-oficial, legado/fallback)
//
// CONTRATO de falha: implementações DEVEM propagar context.Canceled e
// context.DeadlineExceeded sem envolvê-los (para que errors.Is funcione no
// chamador), e DEVEM retornar ErrTTSQuotaExceeded em caso de HTTP 429. O
// chamador usa essa distinção para decidir entre reenfileirar e cair para texto.
//
// CONTRATO de nulidade: um TTSProvider nil é válido e significa "TTS desativado".
// Os chamadores já tratam esse caso enviando apenas texto — implementações não
// precisam se preocupar com isso.
type TTSProvider interface {
	// GenerateSpeech converte texto em áudio falado.
	//
	// Retorna os bytes do áudio e o MIME type correspondente (ex: "audio/mpeg",
	// "audio/wav"). O MIME é informativo para telemetria e logs: o evolution-go
	// detecta o formato por conta própria e converte para Opus antes de enviar
	// ao WhatsApp, então o chamador não precisa agir sobre ele.
	//
	// CONTRATO do texto: o chamador DEVE passar o texto já limpo para fala
	// (utils.SanitizeForSpeech). Implementações não removem markdown nem emoji —
	// se receberem a mensagem crua do WhatsApp, o motor lerá "asterisco
	// asterisco" e o nome de cada emoji em voz alta.
	GenerateSpeech(ctx context.Context, text string) (audio []byte, mimeType string, err error)

	// Name identifica o provedor efetivamente usado, para logs e telemetria.
	// Segue o mesmo espírito do `modelUsed` retornado por LLMProvider: quando a
	// implementação tem fallback interno entre modelos/vozes, Name DEVE refletir
	// o que de fato produziu o áudio, nunca apenas o configurado.
	Name() string
}
