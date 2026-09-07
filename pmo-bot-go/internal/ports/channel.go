package ports

import (
	"context"
	"time"
)

// ChannelType define os canais suportados pelo sistema.
type ChannelType string

const (
	ChannelWhatsApp ChannelType = "whatsapp"
	ChannelTelegram ChannelType = "telegram"
	ChannelWeb      ChannelType = "web"
)

// ChannelSender substitui a antiga interface MessageSender.
// Agora, os métodos operam com um OutboundEnvelope que especifica
// o canal de destino.
type ChannelSender interface {
	Send(ctx context.Context, env OutboundEnvelope) error
	SendTyping(ctx context.Context, channel ChannelType, to string) error
	// Helper methods that adapters implement natively
	DownloadMedia(ctx context.Context, mediaID string, rawPayload []byte) ([]byte, string, error)
}

// OutboundEnvelope consolida todos os tipos de mensagens que podem sair do núcleo.
type OutboundEnvelope struct {
	ID             string      // ID local (Idempotency Key)
	ConversationID string      // Destino agnóstico de canal
	Channel        ChannelType // Opcional: Se preenchido, força o canal. Se vazio, funil deduz pelo ConversationID (futuro)
	To             string      // Identificador legadp do canal (ex: phone, chat_id). Preenchido pelo funil se vazio.

	Type OutboundType

	// Campos para envio de Texto
	Text string

	// Campos para envio de Áudio
	Base64Audio string
	IsVoiceNote bool

	// Campos para botões (ex: Onboarding)
	Title       string
	Description string
	Footer      string
	Buttons     []map[string]string // Ex: {"id": "1", "title": "Sim"}

	// Campos para responder a uma mensagem específica
	ReplyToMessageID string
}

type OutboundType string

const (
	OutboundTypeText    OutboundType = "text"
	OutboundTypeAudio   OutboundType = "audio"
	OutboundTypeButtons OutboundType = "buttons"
	OutboundTypeImage   OutboundType = "image"
)

// IncomingEnvelope (anteriormente IncomingEnvelope) representa uma mensagem recebida de forma agnóstica ao canal.
type IncomingEnvelope struct {
	ID                      string      // ID único local para a mensagem
	ChannelMsgID            string      // ID real gerado pelo canal (ex: msgID do WA)
	Channel                 ChannelType // Canal de origem
	From                    string      // Identificador original do canal (ex: phone)
	UserID                  string      // Identidade unificada do produtor (UUID)
	ConversationID          string      // ID unificado da conversa
	Body                    string
	Type                    string
	IsAudio                 bool
	IsImage                 bool
	RespondWithAudio        bool
	HasExplicitResponseMode bool
	Timestamp               time.Time
	RawPayload              []byte
	RawPayloadID            string
}
