// Package selfheal contém a lógica de detecção e recuperação automática da
// sessão do WhatsApp (DT-53).
//
// No Estágio 0 apenas detecta e alerta; a ação corretiva vem no Estágio 1. A
// separação é deliberada: a maior parte do valor está em o operador descobrir a
// queda em dois minutos em vez de trinta e seis, e isso não exige encostar na
// sessão.
package selfheal

import (
	"fmt"
	"sync"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// LimiarPadrao é quantas sondagens consecutivas de falha são necessárias antes
// de acordar um humano.
//
// Com o heartbeat de 60s isso dá ~2 minutos. Não é zero de propósito: o
// evolution-go tem um auto-restart próprio no evento Disconnected que resolve
// sozinho em ~20s no melhor caso, e alertar antes dele terminar produziria
// alarme falso em toda queda transitória. Contra a linha de base real (24min no
// DT-52, 36min em 2026-08-23), gastar dois minutos para evitar ruído é troca
// óbvia.
const LimiarPadrao = 2

// Observacao é o resultado de uma sondagem do heartbeat.
type Observacao struct {
	// Conectado indica sessão de pé.
	Conectado bool
	// Erro descreve falha de transporte ao consultar o gateway (vazio quando a
	// consulta funcionou, ainda que reportando queda).
	Erro string
	// Detalhe carrega o estado bruto reportado pelo gateway, para o alerta poder
	// dizer algo mais útil que "caiu".
	Detalhe string
}

// Rastreador acompanha quedas consecutivas e decide quando alertar.
//
// Guarda estado entre sondagens (é o que distingue "caiu agora" de "continua
// caído há meia hora") e por isso precisa sobreviver entre ticks — mantenha uma
// única instância por processo.
type Rastreador struct {
	limiar   int
	instance string

	mu           sync.Mutex
	consecutivas int
	inicioQueda  time.Time
	alertado     bool
}

// NewRastreador cria o rastreador. Limiar não-positivo cai no padrão, seguindo
// a convenção de NewStuckJobReaper (DT-50).
func NewRastreador(instance string, limiar int) *Rastreador {
	if limiar <= 0 {
		limiar = LimiarPadrao
	}
	return &Rastreador{limiar: limiar, instance: instance}
}

// Observar registra uma sondagem e devolve o alerta a disparar, ou nil.
//
// Recebe `agora` como parâmetro em vez de chamar time.Now() internamente —
// mesma decisão do ReapOnce do StuckJobReaper, e é o que permite testar tempo
// de indisponibilidade sem nenhum sleep.
//
// Alerta no máximo uma vez por incidente: a supressão de repetição do
// notify.Cooldown é a segunda linha de defesa, não a primeira.
func (r *Rastreador) Observar(agora time.Time, obs Observacao) *ports.Alerta {
	r.mu.Lock()
	defer r.mu.Unlock()

	if obs.Conectado {
		return r.recuperar(agora)
	}

	r.consecutivas++
	if r.inicioQueda.IsZero() {
		r.inicioQueda = agora
	}

	// Já avisamos sobre este incidente; continuar avisando a cada minuto só
	// treinaria o operador a ignorar a notificação.
	if r.alertado || r.consecutivas < r.limiar {
		return nil
	}

	r.alertado = true
	return &ports.Alerta{
		Chave:      r.chave(obs),
		Severidade: ports.SeveridadeCritico,
		Titulo:     fmt.Sprintf("WhatsApp fora do ar (%s)", r.instance),
		Corpo:      r.corpoQueda(agora, obs),
		Em:         agora,
	}
}

// recuperar fecha o incidente aberto, se houver.
func (r *Rastreador) recuperar(agora time.Time) *ports.Alerta {
	precisaAvisar := r.alertado
	fora := r.duracao(agora)

	r.consecutivas = 0
	r.inicioQueda = time.Time{}
	r.alertado = false

	// Só confirma recuperação se chegamos a alertar sobre a queda. Sem isso, um
	// soluço de uma única sondagem geraria um "voltou!" sobre algo que o
	// operador nunca soube ter caído.
	if !precisaAvisar {
		return nil
	}

	return &ports.Alerta{
		Chave:      ports.ChaveWhatsAppCaiu,
		Severidade: ports.SeveridadeRecuperado,
		Titulo:     fmt.Sprintf("WhatsApp voltou (%s)", r.instance),
		Corpo:      fmt.Sprintf("A sessão voltou a responder.\n\nTempo fora do ar: %s", formatarDuracao(fora)),
		Em:         agora,
	}
}

func (r *Rastreador) chave(obs Observacao) string {
	if obs.Erro != "" {
		return ports.ChaveGatewayFora
	}
	return ports.ChaveWhatsAppCaiu
}

func (r *Rastreador) corpoQueda(agora time.Time, obs Observacao) string {
	causa := fmt.Sprintf("estado reportado: %s", obs.Detalhe)
	if obs.Erro != "" {
		causa = fmt.Sprintf("falha ao consultar o gateway: %s", obs.Erro)
	}

	return fmt.Sprintf(
		"A sessão do WhatsApp não responde há %s (%d sondagens seguidas).\n"+
			"Instância: %s\n"+
			"Causa aparente: %s\n\n"+
			"Nenhuma recuperação automática foi tentada.\n"+
			"Remediação manual:\n"+
			"  docker restart pmo-prod-stack-evolution-go-1\n\n"+
			"Se após o restart o log mostrar 'Found 0 connected instances', a instância\n"+
			"não religa sozinha e precisa de um POST em /instance/reconnect.",
		formatarDuracao(r.duracao(agora)), r.consecutivas, r.instance, causa,
	)
}

func (r *Rastreador) duracao(agora time.Time) time.Duration {
	if r.inicioQueda.IsZero() {
		return 0
	}
	return agora.Sub(r.inicioQueda)
}

func formatarDuracao(d time.Duration) string {
	d = d.Round(time.Second)
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	return fmt.Sprintf("%dmin%02ds", int(d.Minutes()), int(d.Seconds())%60)
}
