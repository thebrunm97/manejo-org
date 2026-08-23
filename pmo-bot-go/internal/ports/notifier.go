package ports

import (
	"context"
	"time"
)

// Severidades de um Alerta. Vocabulário fechado de propósito: é o que decide se
// o alerta fura o cooldown (ver internal/notify/cooldown.go) e é emitido como
// label do Prometheus, onde cardinalidade aberta é um problema.
const (
	// SeveridadeCritico indica que algo exige atenção humana agora.
	SeveridadeCritico = "critico"
	// SeveridadeRecuperado fecha um incidente aberto. Fura o cooldown da própria
	// chave, porque a confirmação de que voltou é tão urgente quanto o aviso de
	// que caiu — e sem ela o operador fica sem saber se ainda precisa agir.
	SeveridadeRecuperado = "recuperado"
)

// Chaves de deduplicação. Um alerta só é silenciado por repetição dentro da
// mesma chave, então elas precisam separar problemas que exigem ações
// diferentes.
const (
	ChaveWhatsAppCaiu      = "whatsapp_caiu"
	ChaveWhatsAppDeslogado = "whatsapp_deslogado"
	ChaveGatewayFora       = "gateway_fora"
	ChaveNaoAutorizado     = "nao_autorizado"
	ChaveQRDetectado       = "qr_detectado"
	ChaveTeste             = "teste"
)

// Alerta é uma notificação destinada a um humano, por um canal que não seja o
// WhatsApp — o canal do WhatsApp não serve para avisar que o WhatsApp caiu.
type Alerta struct {
	// Chave agrupa alertas do mesmo problema para fins de deduplicação.
	Chave string
	// Severidade é SeveridadeCritico ou SeveridadeRecuperado.
	Severidade string
	// Titulo é a primeira linha, o que aparece na notificação do celular.
	Titulo string
	// Corpo deve ser acionável sem laptop: o que houve, há quanto tempo, e qual
	// o comando manual de remediação.
	Corpo string
	// Em é o instante do evento, não o do envio — o envio pode atrasar ou ser
	// retentado, e o que interessa para o operador é quando o problema começou.
	Em time.Time
}

// Notifier entrega Alertas fora de banda.
//
// Contrato: implementações NÃO devem entrar em pânico e NÃO devem bloquear além
// do prazo do contexto recebido. O chamador trata qualquer erro como não-fatal —
// falha ao alertar nunca pode derrubar nem travar quem estava alertando.
type Notifier interface {
	Notify(ctx context.Context, a Alerta) error
	Name() string
}
