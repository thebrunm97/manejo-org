package ports

import (
	"context"
)

// MessageSender define as operações de saída que o sistema pode realizar.
type MessageSender interface {
	SendMessage(to, message string) error
	SendVoice(to, base64Audio string, isPtt bool) error
	SendReply(to, message, replyToMessageID string) error
	// DownloadAudio returns the decoded audio bytes and the detected mimeType (e.g., "audio/ogg").
	DownloadAudio(messageID string, rawPayload []byte) ([]byte, string, error)
	DownloadImage(messageID string, rawPayload []byte) ([]byte, string, error)
	SetPresence(to string, presence string) error
	SendPresence(ctx context.Context, to string, state string) error
	SendButton(to string, title, description, footer string, buttons []map[string]string) error
}
