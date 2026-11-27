// Package comandos recebe comandos do operador pelo Telegram.
//
// Hoje só existe /reconectar: pede um código de pareamento do WhatsApp para a
// instância, para o operador reconectar o bot sem acesso ao terminal da VPS.
package comandos

import (
	"context"
	"crypto/subtle"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Reconexao é o que o comando precisa da Evolution. Interface local para o
// handler não depender do adapter concreto.
type Reconexao interface {
	Conectar(ctx context.Context) error
	PedirCodigoPareamento(ctx context.Context, telefone string) (string, error)
}

// Responder devolve texto ao chat do operador.
type Responder interface {
	EnviarTexto(ctx context.Context, texto string) error
}

// ReconectarHandler atende POST /telegram/webhook.
type ReconectarHandler struct {
	segredoWebhook string
	chatPermitido  string
	reconexao      Reconexao
	responder      Responder

	// pausaAposConectar dá tempo para o Evolution sair do estado "desconectado"
	// antes de pedir o código. Exposta só para os testes do pacote.
	pausaAposConectar time.Duration

	// emExecucao impede dois pareamentos ao mesmo tempo.
	emExecucao sync.Mutex
}

// NewReconectarHandler monta o handler. segredo é o valor de
// TELEGRAM_WEBHOOK_SECRET (o mesmo registrado no setWebhook do Telegram) e
// chatPermitido é o TELEGRAM_CHAT_ID: só esse chat pode disparar o comando.
func NewReconectarHandler(segredo, chatPermitido string, r Reconexao, resp Responder) *ReconectarHandler {
	return &ReconectarHandler{
		segredoWebhook:    segredo,
		chatPermitido:     chatPermitido,
		reconexao:         r,
		responder:         resp,
		pausaAposConectar: 3 * time.Second,
	}
}

// regexTelefone aceita DDI+DDD+número, só dígitos (ex.: 5534997202727).
var regexTelefone = regexp.MustCompile(`^\d{10,15}$`)

type updateTelegram struct {
	Message *struct {
		Text string `json:"text"`
		Chat struct {
			ID int64 `json:"id"`
		} `json:"chat"`
	} `json:"message"`
}

// Handle valida o webhook, filtra o chat e dispara o pareamento em background.
//
// Responde 200 para qualquer update já autenticado: se devolvesse erro, o
// Telegram reenviaria o mesmo comando em loop.
func (h *ReconectarHandler) Handle(c *gin.Context) {
	// 1) Autenticação: o Telegram envia o segredo no header que você registrou.
	recebido := c.GetHeader("X-Telegram-Bot-Api-Secret-Token")
	if h.segredoWebhook == "" || subtle.ConstantTimeCompare([]byte(recebido), []byte(h.segredoWebhook)) != 1 {
		c.Status(http.StatusUnauthorized)
		return
	}

	var upd updateTelegram
	if err := c.ShouldBindJSON(&upd); err != nil || upd.Message == nil {
		c.Status(http.StatusOK)
		return
	}

	// 2) Só o chat do operador pode disparar.
	if strconv.FormatInt(upd.Message.Chat.ID, 10) != h.chatPermitido {
		c.Status(http.StatusOK)
		return
	}

	texto := strings.TrimSpace(upd.Message.Text)
	if !strings.HasPrefix(texto, "/reconectar") {
		c.Status(http.StatusOK)
		return
	}

	partes := strings.Fields(texto)
	if len(partes) != 2 || !regexTelefone.MatchString(partes[1]) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
		defer cancel()
		h.enviar(ctx, "Uso: /reconectar 5534997202727 (DDI, DDD e número, só dígitos).")
		c.Status(http.StatusOK)
		return
	}

	c.Status(http.StatusOK)
	go h.reconectar(partes[1])
}

// reconectar roda o fluxo completo: conectar, esperar, pedir o código e
// devolvê-lo ao chat. O código nunca vai para o log.
func (h *ReconectarHandler) reconectar(telefone string) {
	if !h.emExecucao.TryLock() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		h.enviar(ctx, "Já há um pareamento em andamento. Aguarde o código atual expirar.")
		return
	}
	defer h.emExecucao.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	// Loga só os 4 últimos dígitos do número.
	log.Printf("[Telegram] /reconectar acionado (número final %s)", telefone[len(telefone)-4:])

	if err := h.reconexao.Conectar(ctx); err != nil {
		log.Printf("[Telegram] /reconectar: falha ao conectar: %v", err)
		h.enviar(ctx, "Falha ao conectar a instância. Veja os logs do Evolution.")
		return
	}

	select {
	case <-ctx.Done():
		return
	case <-time.After(h.pausaAposConectar):
	}

	codigo, err := h.reconexao.PedirCodigoPareamento(ctx, telefone)
	if err != nil {
		log.Printf("[Telegram] /reconectar: pareamento falhou: %v", err)
		h.enviar(ctx, "Não consegui gerar o código de pareamento. Tente de novo em um minuto.")
		return
	}

	h.enviar(ctx, fmt.Sprintf(
		"Código de pareamento: %s\n\nNo WhatsApp do bot: Aparelhos conectados → Conectar com número de telefone. O código expira em cerca de um minuto.",
		codigo,
	))
}

func (h *ReconectarHandler) enviar(ctx context.Context, texto string) {
	if err := h.responder.EnviarTexto(ctx, texto); err != nil {
		log.Printf("[Telegram] /reconectar: falha ao responder: %v", err)
	}
}
