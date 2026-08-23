package selfheal

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/notify"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/telemetry"
)

// Gateway é o que o healer precisa do transporte Evolution.
//
// Deliberadamente NÃO inclui nenhum método de conexão/pareamento: o healer não
// pode chamar o que não sabe nomear. Esta é a primeira das três travas contra
// QR automático do DT-53 — as outras duas estão em classificar() (Entrada.Jid
// vazio vira EstadoDeslogada, nunca uma tentativa) e no corpo do alerta
// correspondente, que nunca sugere reparear sozinho.
type Gateway interface {
	FetchStatus(ctx context.Context) (evolution.InstanceStatus, error)
	FetchInfo(ctx context.Context, instanceID string) (evolution.InstanceInfo, error)
	ForceReconnect(ctx context.Context, instanceID, number string) error
}

// backoffPadrao é var, não const, para o teste poder zerar — mesma decisão do
// DeliveryConfig.Backoff em internal/queue/delivery_test.go.
//
// Grosso de propósito: sessão de WhatsApp não é requisição HTTP. Retentativa
// sub-minuto é como se produz ping-pong de StreamReplaced e, pior, rate limit
// ou ban temporário da Meta (ConnectFailureTempBanned = 402).
var backoffPadrao = []time.Duration{2 * time.Minute, 5 * time.Minute, 15 * time.Minute, 30 * time.Minute}

const (
	intervaloPadrao      = 60 * time.Second
	maxTentativasPadrao  = 4
	cooldownPadrao       = 6 * time.Hour
	tetoDiarioPadrao     = 10
	verificacaoIntervalo = 5 * time.Second
	verificacaoJanela    = 30 * time.Second
	timeoutChamadaPadrao = 10 * time.Second
)

// ErrHealEmAndamento é devolvido quando HealOnce é chamado enquanto uma
// sondagem anterior ainda está em curso.
//
// O laço síncrono de Run já evita reentrância pelo próprio ticker (o canal do
// time.Ticker descarta ticks perdidos), mas isso não basta a partir do
// Estágio 2, quando um webhook de CONNECTION chama HealOnce fora de banda, de
// uma goroutine do Gin.
var ErrHealEmAndamento = errors.New("selfheal: sondagem já em andamento")

// Options configura o Healer. Zero-value é seguro: NewHealer aplica os
// defaults em qualquer campo não-positivo — mesma convenção do
// NewStuckJobReaper (DT-50).
type Options struct {
	Instance       string
	Interval       time.Duration
	DownThreshold  int
	Backoff        []time.Duration
	MaxAttempts    int
	Cooldown       time.Duration
	DailyCap       int
	CallTimeout    time.Duration
	VerifyInterval time.Duration
	VerifyWindow   time.Duration
	// DryRun roda a máquina de estados inteira, emite toda telemetria e todo
	// alerta, mas nunca chama ForceReconnect. É o modo de estreia: todo o
	// valor de detecção contra a sessão real, com risco zero.
	DryRun bool
}

func (o *Options) aplicarDefaults() {
	if o.Interval <= 0 {
		o.Interval = intervaloPadrao
	}
	if o.DownThreshold <= 0 {
		o.DownThreshold = LimiarPadrao
	}
	if len(o.Backoff) == 0 {
		o.Backoff = backoffPadrao
	}
	if o.MaxAttempts <= 0 {
		o.MaxAttempts = maxTentativasPadrao
	}
	if o.Cooldown <= 0 {
		o.Cooldown = cooldownPadrao
	}
	if o.DailyCap <= 0 {
		o.DailyCap = tetoDiarioPadrao
	}
	if o.CallTimeout <= 0 {
		o.CallTimeout = timeoutChamadaPadrao
	}
	if o.VerifyInterval <= 0 {
		o.VerifyInterval = verificacaoIntervalo
	}
	if o.VerifyWindow <= 0 {
		o.VerifyWindow = verificacaoJanela
	}
}

// incidenteEmCurso acumula o estado de UM período contínuo de indisponibilidade.
// É recriado do zero a cada vez que a sondagem volta a reportar SAUDAVEL — uma
// nova queda é sempre um incidente novo, com direito a alertar de novo.
type incidenteEmCurso struct {
	inicio                  time.Time
	consecutivasCaida       int
	tentativas              int
	proximaTentativaEm      time.Time
	esgotadoEm              time.Time
	consecutivasGatewayFora int
	alertouDeslogada        bool
	alertouNaoAutorizada    bool
	alertouGatewayFora      bool
}

// Resultado é o que HealOnce devolve — principalmente para o teste conseguir
// asserir sem depender de ler telemetria.
type Resultado struct {
	Estado Estado
	// Resultado é "ok" | "falhou" | "inconclusivo" quando uma tentativa de
	// reconexão foi feita nesta chamada; vazio quando nenhuma ação ocorreu.
	Resultado string
	// Motivo explica por que nenhuma ação foi tomada, no vocabulário do
	// pacote (graca, backoff, cap_diario, cooldown, qr_necessario,
	// gateway_indisponivel, dry_run, handshake, esgotado).
	Motivo string
}

// Healer tenta reconectar a sessão do WhatsApp sozinho, dentro de limites
// rígidos, e alerta um humano quando não consegue ou quando o caso não é
// recuperável.
//
// Tem ticker e sonda PRÓPRIOS, independentes do heartbeat que já existe em
// cmd/server/main.go — decisão deliberada, não descuido: o heartbeat cuida de
// reportar (clock drift, upsert no Supabase, reconfiguração de webhook, todos
// já funcionando), e refatorá-lo para servir aos dois papéis arriscaria essas
// responsabilidades sem necessidade. O custo de uma segunda sonda por minuto é
// desprezível (1-10ms medidos em produção).
type Healer struct {
	gw          Gateway
	notificador ports.Notifier
	opts        Options

	mu             sync.Mutex
	incidente      *incidenteEmCurso
	tentativasHoje []time.Time

	// qrDetectado é o disjuntor: uma vez true, HealOnce nunca mais age nem
	// sonda, até o processo reiniciar. Setado só por NotificarEvento ao
	// receber o webhook "QRCode" — a terceira trava contra QR automático (as
	// outras duas são a ausência de um método Connect no Gateway e o check de
	// Entrada.Jid em classificar()). As duas primeiras previnem o healer de
	// CAUSAR um QR; esta aqui reage a um QR que já aconteceu por fora do
	// healer, evitando martelar forcereconnect contra uma sessão que agora
	// precisa de pareamento manual.
	qrDetectado bool
}

// NewHealer cria o healer. Se notificador for nil, usa notify.Noop{} — nenhum
// call site interno precisa checar nil.
func NewHealer(gw Gateway, notificador ports.Notifier, opts Options) *Healer {
	opts.aplicarDefaults()
	if notificador == nil {
		notificador = notify.Noop{}
	}
	return &Healer{gw: gw, notificador: notificador, opts: opts}
}

// Run bloqueia até ctx ser cancelado. Deve rodar em goroutine própria.
//
// Mesma forma do StuckJobReaper (DT-50): uma passada imediata antes do
// primeiro tick, depois liga o ticker. tick roda SINCRONAMENTE dentro do
// laço — o canal do time.Ticker tem buffer 1 e descarta ticks perdidos, então
// uma sondagem que demora (graça + verificação, até ~30s) estruturalmente não
// pode ser reentrada pelo próprio laço.
func (h *Healer) Run(ctx context.Context) {
	modo := "ativo"
	if h.opts.DryRun {
		modo = "dry-run"
	}
	log.Printf("🩺 [SelfHeal] Iniciado (instancia=%s intervalo=%s modo=%s)", h.opts.Instance, h.opts.Interval, modo)

	h.tick(ctx)

	ticker := time.NewTicker(h.opts.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("🩺 [SelfHeal] Encerrado")
			return
		case <-ticker.C:
			h.tick(ctx)
		}
	}
}

func (h *Healer) tick(ctx context.Context) {
	if _, err := h.HealOnce(ctx, time.Now()); err != nil && !errors.Is(err, ErrHealEmAndamento) {
		log.Printf("⚠️ [SelfHeal] Falha na sondagem: %v", err)
	}
}

// NotificarEvento implementa ports.ConnectionEventNotifier — chamada pelo
// webhook handler quando um evento de CONNECTION chega, mais rápido que
// esperar o próximo tick de 60s.
//
// Nunca bloqueia: quem chama é o handler HTTP do webhook, que precisa
// devolver 200 rápido (a regra de ouro do handler, em
// internal/webhook/handler.go). Por isso HealOnce roda em goroutine própria
// aqui — o push só ACORDA a sondagem mais cedo, não fura a graça: HealOnce
// ainda vai contar consecutivasCaida normalmente e só agir se o limiar já
// tiver sido atingido.
//
// QRCode é tratado à parte, fora do fluxo normal de HealOnce: é o disjuntor.
func (h *Healer) NotificarEvento(evento string) {
	if evento == "QRCode" {
		h.dispararDisjuntorQR()
		return
	}
	go func() {
		if _, err := h.HealOnce(context.Background(), time.Now()); err != nil && !errors.Is(err, ErrHealEmAndamento) {
			log.Printf("⚠️ [SelfHeal] Falha na sondagem disparada por webhook (%s): %v", evento, err)
		}
	}()
}

// dispararDisjuntorQR desliga o healer permanentemente nesta execução e
// alerta uma única vez. O evolution-go só abre fluxo de QR quando não há jid
// persistido ou o device store sumiu (whatsmeow.go:494-538) — se isso
// aconteceu, é porque algo fora do controle do healer decidiu isso (ex.:
// device store perdido), e continuar tentando forcereconnect contra uma
// sessão que agora exige pareamento manual só desperdiça as tentativas
// restantes e atrasa o alerta que realmente importa.
func (h *Healer) dispararDisjuntorQR() {
	h.mu.Lock()
	jaTripado := h.qrDetectado
	h.qrDetectado = true
	h.mu.Unlock()

	if jaTripado {
		return
	}

	log.Printf("🚨 [SelfHeal] QRCode detectado via webhook — self-healing DESLIGADO nesta execução (instancia=%s)", h.opts.Instance)
	telemetry.WhatsAppConnected.Set(0)
	notify.Disparar(context.Background(), h.notificador, ports.Alerta{
		Chave:      ports.ChaveQRDetectado,
		Severidade: ports.SeveridadeCritico,
		Titulo:     fmt.Sprintf("QR code gerado — self-heal desligado (%s)", h.opts.Instance),
		Corpo: "O evolution-go abriu um fluxo de pareamento por QR — algo que o self-heal nunca deveria " +
			"provocar sozinho (ver DT-53). Ele foi desligado nesta execução para não martelar tentativas " +
			"de reconexão contra uma sessão que agora precisa de QR manual.\n\n" +
			"Reinicie o pmo-bot-go depois de reparear a sessão para reativar o self-heal.",
		Em: time.Now(),
	})
}

// HealOnce faz uma sondagem completa e decide (e possivelmente executa) uma
// ação. Recebe `agora` como parâmetro — nunca chama time.Now() internamente
// para decisões — para o teste nunca precisar dormir nem esperar ticker.
//
// Protegida por mutex: só uma sondagem por vez. Necessário porque, a partir do
// Estágio 2, um webhook de CONNECTION pode chamar isto fora do ritmo do
// ticker.
func (h *Healer) HealOnce(ctx context.Context, agora time.Time) (Resultado, error) {
	if !h.mu.TryLock() {
		return Resultado{}, ErrHealEmAndamento
	}
	defer h.mu.Unlock()

	if h.qrDetectado {
		// Disjuntor aberto: nem sonda. Já alertamos uma vez em
		// dispararDisjuntorQR; a partir daqui é decisão humana.
		return Resultado{Motivo: "qr_detectado"}, nil
	}

	entrada := h.sondar(ctx)
	estado := classificar(entrada)
	h.registrarProbe(estado, entrada)

	switch estado {
	case EstadoSaudavel:
		return h.tratarSaudavel(ctx, agora, estado), nil
	case EstadoHandshake:
		// Estado transitório (pareamento em andamento). Não mexe no
		// incidente: nem cria um novo nem encerra um existente.
		return Resultado{Estado: estado, Motivo: "handshake"}, nil
	case EstadoDeslogada:
		return h.tratarNaoRecuperavel(ctx, agora, estado, ports.ChaveWhatsAppDeslogado, "qr_necessario",
			"A sessão está deslogada (sem jid persistido) ou foi encerrada remotamente (logout/ban).\n"+
				"Reparear exige escanear um QR novo — passo manual e supervisionado, nunca automático."), nil
	case EstadoNaoAutorizada:
		return h.tratarNaoRecuperavel(ctx, agora, estado, ports.ChaveNaoAutorizado, "nao_autorizado",
			"O gateway recusou a autenticação (401/403). A chave pode ter sido rotacionada\n"+
				"ou está inválida. Verifique EVOLUTION_API_KEY."), nil
	case EstadoGatewayFora:
		return h.tratarGatewayFora(ctx, agora, entrada), nil
	case EstadoCaida:
		return h.tratarCaida(ctx, agora, entrada)
	}
	return Resultado{Estado: estado}, nil
}

// sondar consulta /instance/status e, só quando ele reporta queda,
// /instance/info — uma chamada a mais por minuto no caso saudável é ruído que
// não compensa.
func (h *Healer) sondar(ctx context.Context) Entrada {
	var entrada Entrada

	statusCtx, cancel := context.WithTimeout(ctx, h.opts.CallTimeout)
	status, errStatus := h.gw.FetchStatus(statusCtx)
	cancel()

	if errStatus != nil {
		entrada.StatusErro = errStatus.Error()
		var se *evolution.StatusError
		if errors.As(errStatus, &se) {
			entrada.StatusCodigoHTTP = se.Code
		}
		return entrada
	}

	entrada.Connected = status.Connected
	entrada.LoggedIn = status.LoggedIn
	if status.Connected {
		return entrada
	}

	infoCtx, cancelInfo := context.WithTimeout(ctx, h.opts.CallTimeout)
	info, errInfo := h.gw.FetchInfo(infoCtx, h.opts.Instance)
	cancelInfo()

	if errInfo != nil {
		entrada.InfoErro = errInfo.Error()
		var se *evolution.StatusError
		if errors.As(errInfo, &se) {
			entrada.InfoCodigoHTTP = se.Code
		}
		return entrada
	}

	entrada.Jid = info.Jid
	entrada.DisconnectReason = info.DisconnectReason
	return entrada
}

func (h *Healer) registrarProbe(estado Estado, entrada Entrada) {
	consecutivas := 0
	if h.incidente != nil {
		consecutivas = h.incidente.consecutivasCaida
	}
	log.Printf("telemetry event=self_heal_probe estado=%s connected=%t logged_in=%t consecutivas=%d instancia=%s",
		estado, entrada.Connected, entrada.LoggedIn, consecutivas, h.opts.Instance)
}

// tratarSaudavel fecha um incidente em curso, se houver, e confirma a
// recuperação — mas só quando o healer de fato tentou algo neste incidente. Um
// drop de uma única sondagem que nunca chegou a acionar nada não deveria gerar
// um "recuperei!" sobre uma queda que ninguém tentou curar.
func (h *Healer) tratarSaudavel(ctx context.Context, agora time.Time, estado Estado) Resultado {
	inc := h.incidente
	h.incidente = nil
	telemetry.WhatsAppConnected.Set(1)

	if inc != nil && inc.tentativas > 0 {
		fora := agora.Sub(inc.inicio)
		notify.Disparar(ctx, h.notificador, ports.Alerta{
			Chave:      ports.ChaveWhatsAppCaiu,
			Severidade: ports.SeveridadeRecuperado,
			Titulo:     fmt.Sprintf("WhatsApp reconectado automaticamente (%s)", h.opts.Instance),
			Corpo: fmt.Sprintf("O self-heal recuperou a sessão sozinho.\n\nTentativas: %d\nTempo fora do ar: %s",
				inc.tentativas, formatarDuracao(fora)),
			Em: agora,
		})
	}
	return Resultado{Estado: estado, Resultado: "ok"}
}

// tratarNaoRecuperavel cobre DESLOGADA e NAO_AUTORIZADA: estados em que agir
// sozinho é errado (arriscaria QR ou já está sem credencial válida). Alerta
// uma única vez por incidente — a chave decide qual booleano de "já alertei"
// checar.
func (h *Healer) tratarNaoRecuperavel(ctx context.Context, agora time.Time, estado Estado, chave, motivo, explicacao string) Resultado {
	if h.incidente == nil {
		h.incidente = &incidenteEmCurso{inicio: agora}
	}
	inc := h.incidente

	jaAlertado := true
	switch chave {
	case ports.ChaveWhatsAppDeslogado:
		jaAlertado = inc.alertouDeslogada
		inc.alertouDeslogada = true
	case ports.ChaveNaoAutorizado:
		jaAlertado = inc.alertouNaoAutorizada
		inc.alertouNaoAutorizada = true
	}

	if !jaAlertado {
		telemetry.WhatsAppConnected.Set(0)
		notify.Disparar(ctx, h.notificador, ports.Alerta{
			Chave:      chave,
			Severidade: ports.SeveridadeCritico,
			Titulo:     fmt.Sprintf("WhatsApp precisa de ação manual (%s)", h.opts.Instance),
			Corpo:      explicacao + "\n\nNenhuma reconexão automática será tentada.",
			Em:         agora,
		})
	}
	return Resultado{Estado: estado, Motivo: motivo}
}

// tratarGatewayFora cobre falha ao simplesmente CONSULTAR o gateway — problema
// diferente de o gateway responder que a sessão caiu, com remediação
// diferente, por isso chave de deduplicação separada.
func (h *Healer) tratarGatewayFora(ctx context.Context, agora time.Time, entrada Entrada) Resultado {
	if h.incidente == nil {
		h.incidente = &incidenteEmCurso{inicio: agora}
	}
	inc := h.incidente
	inc.consecutivasGatewayFora++
	telemetry.WhatsAppConnected.Set(0)

	// Só alerta após 3 sondagens seguidas: uma falha isolada de rede entre
	// contêineres do mesmo bridge é comum o bastante para não merecer
	// acordar ninguém sozinha.
	if inc.consecutivasGatewayFora >= 3 && !inc.alertouGatewayFora {
		inc.alertouGatewayFora = true
		causa := entrada.StatusErro
		if causa == "" {
			causa = entrada.InfoErro
		}
		notify.Disparar(ctx, h.notificador, ports.Alerta{
			Chave:      ports.ChaveGatewayFora,
			Severidade: ports.SeveridadeCritico,
			Titulo:     fmt.Sprintf("Gateway do WhatsApp inalcançável (%s)", h.opts.Instance),
			Corpo: fmt.Sprintf("Falha ao consultar o evolution-go %d sondagens seguidas.\nErro: %s",
				inc.consecutivasGatewayFora, causa),
			Em: agora,
		})
	}
	return Resultado{Estado: EstadoGatewayFora, Motivo: "gateway_indisponivel"}
}

// tratarCaida é o caminho de ação de verdade: sessão caída, jid confirmado,
// nada na lista de veto. Aplica graça, backoff, teto de tentativas e teto
// diário antes de agir.
func (h *Healer) tratarCaida(ctx context.Context, agora time.Time, entrada Entrada) (Resultado, error) {
	if h.incidente == nil {
		h.incidente = &incidenteEmCurso{inicio: agora}
	}
	inc := h.incidente
	inc.consecutivasCaida++
	telemetry.WhatsAppConnected.Set(0)

	// Graça: dá margem para o auto-restart do próprio evolution-go, que no
	// melhor caso resolve sozinho em ~20s. Agir antes dele terminar produziria
	// alarme (e reconexão) falso em toda queda transitória.
	if inc.consecutivasCaida < h.opts.DownThreshold {
		return Resultado{Estado: EstadoCaida, Motivo: "graca"}, nil
	}

	if inc.tentativas >= h.opts.MaxAttempts {
		if res, terminal := h.tratarEsgotamento(ctx, agora, inc, entrada); terminal {
			return res, nil
		}
		// Cooldown expirou: tratarEsgotamento já resetou tentativas e
		// esgotadoEm. Cai para o fluxo normal abaixo em vez de retornar, senão
		// o healer nunca chegaria a tentar de novo — só reabriria o lote e
		// ficaria parado até o próximo tick, adiando a tentativa em até um
		// intervalo inteiro à toa.
	}

	if !inc.proximaTentativaEm.IsZero() && agora.Before(inc.proximaTentativaEm) {
		return Resultado{Estado: EstadoCaida, Motivo: "backoff"}, nil
	}

	h.tentativasHoje = podarJanela24h(h.tentativasHoje, agora)
	if len(h.tentativasHoje) >= h.opts.DailyCap {
		return Resultado{Estado: EstadoCaida, Motivo: "cap_diario"}, nil
	}

	if h.opts.DryRun {
		log.Printf("🩺 [SelfHeal] (dry-run) tentaria forcereconnect agora (tentativa %d/%d)",
			inc.tentativas+1, h.opts.MaxAttempts)
		return Resultado{Estado: EstadoCaida, Motivo: "dry_run"}, nil
	}

	return h.tentarReconectar(ctx, agora, inc, entrada)
}

// tratarEsgotamento cobre o teto de tentativas dentro de UM incidente.
//
// Na primeira vez que o teto é atingido, alerta e agenda um cooldown longo. Se
// o cooldown já passou, reabre um novo lote de tentativas — para uma
// instabilidade que dura a madrugada inteira eventualmente ser tentada de
// novo, em vez de ficar morta para sempre até um humano intervir.
//
// O segundo retorno é `terminal`: true quando o chamador deve devolver o
// Resultado na hora (acabou de alertar, ou ainda está no cooldown); false
// quando o cooldown expirou e o estado foi resetado — nesse caso o chamador
// (tratarCaida) precisa CONTINUAR o fluxo normal de tentativa no mesmo
// HealOnce, e não só reabrir o lote e ficar parado até o próximo tick.
func (h *Healer) tratarEsgotamento(ctx context.Context, agora time.Time, inc *incidenteEmCurso, entrada Entrada) (Resultado, bool) {
	if inc.esgotadoEm.IsZero() {
		inc.esgotadoEm = agora
		fora := agora.Sub(inc.inicio)
		causa := entrada.DisconnectReason
		if causa == "" {
			causa = "não informada"
		}
		log.Printf("telemetry event=self_heal_exhausted tentativas=%d downtime_s=%d ultimo_motivo=%s instancia=%s",
			inc.tentativas, int(fora.Seconds()), semEspacos(causa), h.opts.Instance)
		telemetry.SelfHealExhaustedTotal.Inc()

		notify.Disparar(ctx, h.notificador, ports.Alerta{
			Chave:      ports.ChaveWhatsAppCaiu,
			Severidade: ports.SeveridadeCritico,
			Titulo:     fmt.Sprintf("Self-heal desistiu — WhatsApp continua fora do ar (%s)", h.opts.Instance),
			Corpo: fmt.Sprintf(
				"%d tentativas automáticas de reconexão falharam ao longo de %s.\n"+
					"Causa aparente: %s\n\n"+
					"Remediação manual:\n  docker restart pmo-prod-stack-evolution-go-1\n\n"+
					"Se isso não resolver, verifique se a instância religa sozinha no boot —\n"+
					"'Found 0 connected instances' no log indica que não, e precisa de um\n"+
					"POST manual em /instance/reconnect.\n\n"+
					"O self-heal tentará de novo em %s caso ainda esteja fora do ar.",
				inc.tentativas, formatarDuracao(fora), causa, h.opts.Cooldown),
			Em: agora,
		})
		return Resultado{Estado: EstadoCaida, Motivo: "esgotado", Resultado: "falhou"}, true
	}

	if agora.Sub(inc.esgotadoEm) < h.opts.Cooldown {
		return Resultado{Estado: EstadoCaida, Motivo: "cooldown"}, true
	}

	inc.tentativas = 0
	inc.esgotadoEm = time.Time{}
	inc.proximaTentativaEm = time.Time{}
	return Resultado{}, false
}

// tentarReconectar executa a única ação corretiva que este pacote conhece:
// POST /instance/forcereconnect, seguido de verificação.
func (h *Healer) tentarReconectar(ctx context.Context, agora time.Time, inc *incidenteEmCurso, entrada Entrada) (Resultado, error) {
	numero := numeroDoJid(entrada.Jid)

	inc.tentativas++
	h.tentativasHoje = append(h.tentativasHoje, agora)
	espera := backoffPara(h.opts.Backoff, inc.tentativas)
	inc.proximaTentativaEm = agora.Add(espera)

	log.Printf("telemetry event=self_heal_attempt estado=%s tentativa=%d/%d metodo=forcereconnect backoff_ms=%d instancia=%s",
		EstadoCaida, inc.tentativas, h.opts.MaxAttempts, espera.Milliseconds(), h.opts.Instance)

	inicio := time.Now()

	reconnCtx, cancel := context.WithTimeout(ctx, h.opts.CallTimeout)
	if err := h.gw.ForceReconnect(reconnCtx, h.opts.Instance, numero); err != nil {
		// NÃO decide nada a partir daqui — é o falso negativo conhecido do
		// endpoint (dorme 2s, a conexão real leva ~10s). Quem decide é a
		// verificação abaixo, re-sondando /instance/status.
		log.Printf("⚠️ [SelfHeal] forcereconnect devolveu erro (pode ser falso negativo, decisão real vem da verificação): %v", err)
	}
	cancel()

	resultado, sucesso := h.verificar(ctx)
	latencia := time.Since(inicio).Milliseconds()
	downtimeS := int(agora.Sub(inc.inicio).Seconds())

	log.Printf("telemetry event=self_heal_result resultado=%s tentativa=%d latency_ms=%d downtime_s=%d instancia=%s",
		resultado, inc.tentativas, latencia, downtimeS, h.opts.Instance)
	telemetry.SelfHealAttemptsTotal.WithLabelValues("forcereconnect", resultado).Inc()

	if sucesso {
		return h.tratarSaudavel(ctx, agora, EstadoCaida), nil
	}
	return Resultado{Estado: EstadoCaida, Resultado: resultado}, nil
}

// verificar repete FetchStatus até a janela de verificação esgotar ou a
// sessão voltar. Roda DENTRO da mesma chamada de HealOnce — é o que torna a
// decisão sucesso/falha atômica e testável sem nenhum time.Sleep no teste (o
// teste zera VerifyInterval/VerifyWindow via Options).
func (h *Healer) verificar(ctx context.Context) (resultado string, sucesso bool) {
	prazo := time.Now().Add(h.opts.VerifyWindow)

	for {
		select {
		case <-ctx.Done():
			// Abandona a espera, mas não descarta o que já sabemos: a
			// telemetria da tentativa em si já foi emitida por quem chamou.
			return "inconclusivo", false
		case <-time.After(h.opts.VerifyInterval):
		}

		probeCtx, cancel := context.WithTimeout(ctx, h.opts.CallTimeout)
		status, err := h.gw.FetchStatus(probeCtx)
		cancel()

		if err == nil && status.Connected && status.LoggedIn {
			return "ok", true
		}
		if !time.Now().Before(prazo) {
			return "falhou", false
		}
	}
}

func backoffPara(schedule []time.Duration, tentativa int) time.Duration {
	idx := tentativa - 1
	if idx < 0 {
		idx = 0
	}
	if idx >= len(schedule) {
		idx = len(schedule) - 1
	}
	return schedule[idx]
}

func podarJanela24h(tentativas []time.Time, agora time.Time) []time.Time {
	corte := agora.Add(-24 * time.Hour)
	restantes := tentativas[:0]
	for _, t := range tentativas {
		if t.After(corte) {
			restantes = append(restantes, t)
		}
	}
	return restantes
}

// numeroDoJid extrai o telefone de um jid como
// "553497202727:77@s.whatsapp.net". A API exige o campo, mas ele é
// inofensivo: ForceUpdateJid no evolution-go só reescreve o jid quando a
// instância NÃO tem um, e este método só é chamado depois de classificar
// confirmar (via EstadoCaida) que o Jid já está preenchido.
func numeroDoJid(jid string) string {
	if idx := strings.IndexAny(jid, ":@"); idx != -1 {
		return jid[:idx]
	}
	return jid
}

// semEspacos evita que uma mensagem de erro com espaço quebre o parser
// grep-friendly de scripts/analisar_telemetria.sh, que espera um token sem
// espaço logo após `ultimo_motivo=`.
func semEspacos(s string) string {
	return strings.Join(strings.Fields(s), "_")
}

// Garantia de compilação: Healer satisfaz a interface que webhook.Handler
// espera para o disparo por push (Estágio 2 do DT-53).
var _ ports.ConnectionEventNotifier = (*Healer)(nil)
