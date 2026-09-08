package api

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

type ChatAdminHandler struct {
	sbClient   *supabase.Client
	waClient   ports.ChannelSender
}

func NewChatAdminHandler(sbClient *supabase.Client, waClient ports.ChannelSender) *ChatAdminHandler {
	return &ChatAdminHandler{
		sbClient: sbClient,
		waClient: waClient,
	}
}

type SendMessageRequest struct {
	Phone   string `json:"phone" binding:"required"`
	Message string `json:"message" binding:"required"`
}

// SendMessage permite que um administrador envie uma mensagem manual.
// Ela envia a mensagem para a Evolution API e insere a mensagem no Supabase.
func (h *ChatAdminHandler) SendMessage(c *gin.Context) {
	var req SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Send message via WhatsApp
	err := h.waClient.Send(context.Background(), ports.OutboundEnvelope{To: req.Phone, Type: ports.OutboundTypeText, Text: req.Message})
	if err != nil {
		log.Printf("Erro ao enviar mensagem manual via WA: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send message via WhatsApp"})
		return
	}

	// Salva na tabela messages (para aparecer no painel imediatamente)
	err = h.sbClient.InsertMessage(context.Background(), supabase.MessageInsert{
		Phone:   req.Phone,
		Content: req.Message,
		Role:    "assistant",
	})
	if err != nil {
		log.Printf("Erro ao salvar mensagem manual no Supabase: %v", err)
		// We still return success since the message was sent via WA
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Mensagem enviada com sucesso"})
}

