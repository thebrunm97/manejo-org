package ports

import (
	"time"
)

// MessageSender define as operações de saída que o sistema pode realizar.
type MessageSender interface {
	SendMessage(to, message string) error
	SendVoice(to, base64Audio string, isPtt bool) error
	SendReply(to, message, replyToMessageID string) error
	DownloadAudio(messageID string, rawPayload []byte) ([]byte, error)
	DownloadImage(messageID string, rawPayload []byte) ([]byte, string, error)
	SetPresence(to string, presence string) error
}

// IncomingMessage representa uma mensagem recebida de forma agnóstica ao provider.
type IncomingMessage struct {
	ID        string    // ID único da mensagem para deduplicação
	From      string    // Identificador do remetente (ex: fone)
	Body      string    // Conteúdo textual
	Type      string    // text, image, ptt, audio
	IsAudio   bool      // Helper para rápido acesso
	IsImage   bool      // Helper para rápido acesso
	IsFromMe  bool      // Para ignorar mensagens do próprio bot
	IsBroadcast bool    // Para ignorar status e canais
	Timestamp   time.Time // Momento exato do recebimento
	RawPayload  []byte    // Payload bruto original para providers que exigem o objeto message (ex: Evolution-Go)
}
