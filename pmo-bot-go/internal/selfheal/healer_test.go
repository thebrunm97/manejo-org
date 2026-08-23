package selfheal

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/adapter/evolution"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// ── Fakes ──────────────────────────────────────────────────────────────────

type respStatus struct {
	status evolution.InstanceStatus
	err    error
}

// fakeGateway consome respStatus em fila; o último item repete indefinidamente
// — útil para simular "continua caído" sem ter que prever quantas vezes
// verificar() vai sondar.
type fakeGateway struct {
	mu           sync.Mutex
	status       []respStatus
	chamadasStat int

	info    evolution.InstanceInfo
	infoErr error

	reconnectErr   error
	reconnectCalls []struct{ instanceID, numero string }
}

func (f *fakeGateway) FetchStatus(context.Context) (evolution.InstanceStatus, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.chamadasStat++
	if len(f.status) == 0 {
		return evolution.InstanceStatus{}, nil
	}
	r := f.status[0]
	if len(f.status) > 1 {
		f.status = f.status[1:]
	}
	return r.status, r.err
}

func (f *fakeGateway) chamadasStatus() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.chamadasStat
}

func (f *fakeGateway) FetchInfo(context.Context, string) (evolution.InstanceInfo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.info, f.infoErr
}

func (f *fakeGateway) ForceReconnect(_ context.Context, instanceID, numero string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.reconnectCalls = append(f.reconnectCalls, struct{ instanceID, numero string }{instanceID, numero})
	return f.reconnectErr
}

func (f *fakeGateway) totalReconnects() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.reconnectCalls)
}

// gatewayBloqueia envolve um fakeGateway e faz a PRIMEIRA chamada a
// FetchStatus bloquear até `liberar` ser fechado — usado só para testar que
// duas sondagens concorrentes não se sobrepõem.
type gatewayBloqueia struct {
	*fakeGateway
	pronto  chan struct{}
	liberar chan struct{}
	once    sync.Once
}

func (g *gatewayBloqueia) FetchStatus(ctx context.Context) (evolution.InstanceStatus, error) {
	g.once.Do(func() { close(g.pronto) })
	<-g.liberar
	return g.fakeGateway.FetchStatus(ctx)
}

// fakeNotifier registra os alertas recebidos. notify.Disparar entrega em
// goroutine própria (por desenho: o chamador nunca pode bloquear esperando um
// canal de alerta), então os testes não podem checar o total logo após
// HealOnce retornar — precisam esperar pelo sinal, com aguardar().
type fakeNotifier struct {
	mu        sync.Mutex
	recebidos []ports.Alerta
	sinal     chan struct{}
}

func novoFakeNotifier() *fakeNotifier {
	return &fakeNotifier{sinal: make(chan struct{}, 64)}
}

func (f *fakeNotifier) Name() string { return "fake" }
func (f *fakeNotifier) Notify(_ context.Context, a ports.Alerta) error {
	f.mu.Lock()
	f.recebidos = append(f.recebidos, a)
	f.mu.Unlock()
	select {
	case f.sinal <- struct{}{}:
	default:
	}
	return nil
}
func (f *fakeNotifier) porChave(chave string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, a := range f.recebidos {
		if a.Chave == chave {
			n++
		}
	}
	return n
}
func (f *fakeNotifier) total() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.recebidos)
}

// aguardar bloqueia até o notifier ter recebido pelo menos `esperado` alertas,
// ou falha o teste após 2s. Determinístico: espera o SINAL, não um sleep fixo.
func (f *fakeNotifier) aguardar(t *testing.T, esperado int) {
	t.Helper()
	prazo := time.After(2 * time.Second)
	for {
		if f.total() >= esperado {
			return
		}
		select {
		case <-f.sinal:
		case <-prazo:
			t.Fatalf("timeout esperando %d alerta(s), recebeu %d", esperado, f.total())
		}
	}
}

type notifierPanico struct{}

func (notifierPanico) Name() string                               { return "panico" }
func (notifierPanico) Notify(context.Context, ports.Alerta) error { panic("canal explodiu") }

// opts monta Options rápidas o suficiente para o teste não esperar tempo real:
// backoff e cooldown zerados, janela de verificação minúscula.
func opts(over func(*Options)) Options {
	o := Options{
		Instance:       "manejo-org",
		DownThreshold:  2,
		Backoff:        []time.Duration{0},
		MaxAttempts:    4,
		Cooldown:       50 * time.Millisecond,
		DailyCap:       10,
		CallTimeout:    time.Second,
		VerifyInterval: time.Millisecond,
		VerifyWindow:   10 * time.Millisecond,
	}
	if over != nil {
		over(&o)
	}
	return o
}

func caido() respStatus { return respStatus{status: evolution.InstanceStatus{}} }
func saudavel() respStatus {
	return respStatus{status: evolution.InstanceStatus{Connected: true, LoggedIn: true}}
}
func gatewayErr(msg string) respStatus { return respStatus{err: errors.New(msg)} }

// ── Testes ─────────────────────────────────────────────────────────────────

// O teste mais importante da suíte: sem jid, o healer NUNCA pode chamar
// ForceReconnect — é o predicado que StartClient usa no evolution-go para
// decidir entre retomar sessão e abrir fluxo de QR.
func TestHealer_JidVazio_NuncaChamaForceReconnect(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{caido()}, info: evolution.InstanceInfo{Jid: ""}}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 1 }))

	res, err := h.HealOnce(context.Background(), base)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.Estado != EstadoDeslogada {
		t.Errorf("estado = %s, queria %s", res.Estado, EstadoDeslogada)
	}
	if gw.totalReconnects() != 0 {
		t.Fatalf("chamou ForceReconnect %d vezes com jid vazio — isso arrisca QR", gw.totalReconnects())
	}
	n.aguardar(t, 1)
	if n.porChave(ports.ChaveWhatsAppDeslogado) != 1 {
		t.Errorf("deveria ter alertado 1 vez com a chave de deslogado, alertou %d", n.porChave(ports.ChaveWhatsAppDeslogado))
	}
}

func TestHealer_Saudavel_NenhumaAcaoNemAlerta(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{saudavel()}}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(nil))

	res, err := h.HealOnce(context.Background(), base)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.Estado != EstadoSaudavel {
		t.Errorf("estado = %s, queria %s", res.Estado, EstadoSaudavel)
	}
	if gw.totalReconnects() != 0 || n.total() != 0 {
		t.Errorf("nao deveria agir nem alertar quando ja esta saudavel")
	}
}

// A graça dá margem para o auto-restart do próprio evolution-go resolver
// sozinho (~20s no melhor caso) antes do healer agir.
func TestHealer_Graca_SoAgeAposAtingirOLimiar(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido(), caido()},
		info:   evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net", DisconnectReason: "Reconnecting"},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 2 }))

	res1, _ := h.HealOnce(context.Background(), base)
	if res1.Motivo != "graca" {
		t.Errorf("1a sondagem: motivo = %q, queria \"graca\"", res1.Motivo)
	}
	if gw.totalReconnects() != 0 {
		t.Fatalf("agiu antes de atingir o limiar de graça")
	}

	h.HealOnce(context.Background(), base.Add(time.Minute))
	if gw.totalReconnects() != 1 {
		t.Errorf("deveria ter tentado reconectar na 2a sondagem, tentativas=%d", gw.totalReconnects())
	}
}

// forcereconnect dorme 2s e responde 500 mesmo quando a reconexão real vai
// funcionar em ~10s — o falso negativo mais fácil de errar no desenho todo.
// Quem decide é a re-sondagem, nunca o status HTTP do POST.
func TestHealer_FalsoNegativoDoForceReconnect_AindaContaComoSucesso(t *testing.T) {
	gw := &fakeGateway{
		status:       []respStatus{caido(), caido(), saudavel()},
		info:         evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"},
		reconnectErr: errors.New("failed to connect"), // o falso negativo
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 2 }))

	h.HealOnce(context.Background(), base)
	res, err := h.HealOnce(context.Background(), base.Add(time.Minute))
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.Resultado != "ok" {
		t.Errorf("resultado = %q, queria \"ok\" — o 500 do forcereconnect nao deveria contar", res.Resultado)
	}
	n.aguardar(t, 1)
	if n.porChave(ports.ChaveWhatsAppCaiu) != 1 {
		t.Errorf("deveria ter confirmado recuperacao, alertas com a chave=%d", n.porChave(ports.ChaveWhatsAppCaiu))
	}
}

func TestHealer_ReconectaMasContinuaCaido_ResultadoFalhou(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido(), caido()}, // nunca fica saudável
		info:   evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 2 }))

	h.HealOnce(context.Background(), base)
	res, _ := h.HealOnce(context.Background(), base.Add(time.Minute))

	if res.Resultado != "falhou" {
		t.Errorf("resultado = %q, queria \"falhou\"", res.Resultado)
	}
	if gw.totalReconnects() != 1 {
		t.Errorf("deveria ter tentado exatamente 1 vez, tentou %d", gw.totalReconnects())
	}
}

// Falha ao simplesmente CONSULTAR o gateway é problema diferente de o gateway
// dizer que a sessão caiu — remediação diferente, alerta só depois de 3
// sondagens seguidas para não acordar ninguém por um soluço isolado de rede.
func TestHealer_GatewayFora_AlertaSoApos3Consecutivas(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{
		gatewayErr("connection refused"),
		gatewayErr("connection refused"),
		gatewayErr("connection refused"),
	}}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(nil))

	h.HealOnce(context.Background(), base)
	if n.total() != 0 {
		t.Fatalf("alertou cedo demais: %d alertas após 1 falha", n.total())
	}
	h.HealOnce(context.Background(), base.Add(time.Minute))
	if n.total() != 0 {
		t.Fatalf("alertou cedo demais: %d alertas após 2 falhas", n.total())
	}
	h.HealOnce(context.Background(), base.Add(2*time.Minute))
	n.aguardar(t, 1)
	if n.porChave(ports.ChaveGatewayFora) != 1 {
		t.Errorf("deveria alertar na 3a falha seguida, alertas=%d", n.porChave(ports.ChaveGatewayFora))
	}
	if gw.totalReconnects() != 0 {
		t.Error("gateway fora nunca deveria tentar forcereconnect")
	}
}

func TestHealer_401_AlertaImediatoSemEsperarGraca(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{{err: &evolution.StatusError{Code: 401, Body: "not authorized"}}}}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 5 })) // limiar alto: nao deveria importar

	res, _ := h.HealOnce(context.Background(), base)
	if res.Estado != EstadoNaoAutorizada {
		t.Errorf("estado = %s, queria %s", res.Estado, EstadoNaoAutorizada)
	}
	n.aguardar(t, 1)
	if n.porChave(ports.ChaveNaoAutorizado) != 1 {
		t.Errorf("deveria alertar imediatamente, sem esperar o limiar de graça")
	}
	if gw.totalReconnects() != 0 {
		t.Error("401 nunca deveria tentar forcereconnect")
	}
}

// disconnect_reason no formato de logout/ban vence a presença do jid: a lista
// de veto é checada mesmo quando o jid está preenchido.
func TestHealer_ReasonDeLogout_VencJidPreenchido(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido()},
		info: evolution.InstanceInfo{
			Jid:              "553497202727:77@s.whatsapp.net",
			DisconnectReason: "401: logged out from another device",
		},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 1 }))

	res, _ := h.HealOnce(context.Background(), base)
	if res.Estado != EstadoDeslogada {
		t.Errorf("estado = %s, queria %s (o veto deveria vencer o jid presente)", res.Estado, EstadoDeslogada)
	}
	if gw.totalReconnects() != 0 {
		t.Error("nao deveria tentar reconectar com reason de logout, mesmo com jid presente")
	}
}

// Teste anti-tempestade: esgotadas as tentativas, alerta exatamente uma vez;
// enquanto o cooldown não passa, fica em silêncio sem tentar de novo.
func TestHealer_Esgotamento_UmAlertaSoENenhumaTentativaAMaisAteOCooldown(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido()}, // continua caído para sempre
		info:   evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) {
		o.DownThreshold = 1
		o.MaxAttempts = 1
		o.Cooldown = time.Hour // bem maior que o teste
	}))

	h.HealOnce(context.Background(), base)                    // tenta 1x (esgota)
	h.HealOnce(context.Background(), base.Add(1*time.Minute)) // deveria alertar o esgotamento
	h.HealOnce(context.Background(), base.Add(2*time.Minute)) // deveria ficar em silêncio (cooldown)
	h.HealOnce(context.Background(), base.Add(3*time.Minute)) // idem

	if gw.totalReconnects() != 1 {
		t.Errorf("tentou reconectar %d vezes, queria exatamente 1 (o teto)", gw.totalReconnects())
	}
	n.aguardar(t, 1)
	if n.porChave(ports.ChaveWhatsAppCaiu) != 1 {
		t.Errorf("alertou o esgotamento %d vezes, queria exatamente 1", n.porChave(ports.ChaveWhatsAppCaiu))
	}
}

// Depois do cooldown, um novo lote de tentativas é liberado — uma
// instabilidade que dura a madrugada inteira eventualmente é tentada de novo,
// em vez de ficar morta para sempre.
func TestHealer_AposCooldown_TentaDeNovo(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido()},
		info:   evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) {
		o.DownThreshold = 1
		o.MaxAttempts = 1
		o.Cooldown = time.Minute
	}))

	h.HealOnce(context.Background(), base)                     // esgota (tentativa 1)
	h.HealOnce(context.Background(), base.Add(30*time.Second)) // ainda em cooldown
	h.HealOnce(context.Background(), base.Add(2*time.Minute))  // cooldown passou: reabre o lote

	if gw.totalReconnects() != 2 {
		t.Errorf("deveria ter tentado de novo após o cooldown, total=%d", gw.totalReconnects())
	}
}

// Confirma que o estado zera de verdade: uma nova queda depois de recuperar é
// um incidente novo e tem que alertar de novo, não ficar mudo achando que já
// avisou sobre isto antes.
func TestHealer_NovaQuedaAposRecuperarAlertaDeNovo(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{caido()}, info: evolution.InstanceInfo{Jid: ""}}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 1 }))

	h.HealOnce(context.Background(), base) // deslogada, alerta 1

	gw.mu.Lock()
	gw.status = []respStatus{saudavel()}
	gw.mu.Unlock()
	h.HealOnce(context.Background(), base.Add(time.Minute)) // recupera (sem alerta, pois nunca tentou nada)

	gw.mu.Lock()
	gw.status = []respStatus{caido()}
	gw.mu.Unlock()
	h.HealOnce(context.Background(), base.Add(2*time.Minute)) // cai de novo: incidente novo, deveria alertar de novo

	n.aguardar(t, 2)
	if n.porChave(ports.ChaveWhatsAppDeslogado) != 2 {
		t.Errorf("deveria ter alertado 2 vezes (uma por incidente), alertou %d", n.porChave(ports.ChaveWhatsAppDeslogado))
	}
}

func TestHealer_TetoDiario_ImpedeNovaTentativa(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido()},
		info:   evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) {
		o.DownThreshold = 1
		o.DailyCap = 1
		o.MaxAttempts = 10 // alto, para não confundir com esgotamento
	}))

	h.HealOnce(context.Background(), base) // consome o teto diário (1a tentativa)
	res, _ := h.HealOnce(context.Background(), base.Add(time.Minute))

	if res.Motivo != "cap_diario" {
		t.Errorf("motivo = %q, queria \"cap_diario\"", res.Motivo)
	}
	if gw.totalReconnects() != 1 {
		t.Errorf("deveria ter ficado em 1 tentativa (teto diário), fez %d", gw.totalReconnects())
	}
}

// Duas sondagens concorrentes não podem se sobrepor: a segunda tem que
// desistir na hora, não esperar a primeira terminar. Necessário porque, a
// partir do Estágio 2, um webhook pode chamar HealOnce fora do ritmo do
// ticker.
func TestHealer_ChamadasConcorrentes_SegundaDevolveErrEmAndamento(t *testing.T) {
	base := &fakeGateway{status: []respStatus{saudavel()}}
	gw := &gatewayBloqueia{fakeGateway: base, pronto: make(chan struct{}), liberar: make(chan struct{})}
	h := NewHealer(gw, novoFakeNotifier(), opts(nil))

	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		h.HealOnce(context.Background(), time.Now())
	}()

	<-gw.pronto // a primeira sondagem garantidamente já detém o mutex

	if _, err := h.HealOnce(context.Background(), time.Now()); !errors.Is(err, ErrHealEmAndamento) {
		t.Fatalf("esperava ErrHealEmAndamento, veio: %v", err)
	}

	close(gw.liberar)
	wg.Wait()
}

// Um notifier que entra em pânico não pode derrubar o healer nem impedir a
// chamada de devolver normalmente — Disparar roda o envio em goroutine
// própria, isolada por recover.
func TestHealer_NotifierComPanico_NaoDerrubaOHealer(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{caido()}, info: evolution.InstanceInfo{Jid: ""}}
	h := NewHealer(gw, notifierPanico{}, opts(func(o *Options) { o.DownThreshold = 1 }))

	_, err := h.HealOnce(context.Background(), base)
	if err != nil {
		t.Fatalf("HealOnce nao deveria falhar so porque o notifier explode: %v", err)
	}

	// Dá tempo para a goroutine assíncrona do Disparar rodar e o recover
	// interno absorver o pânico, sem derrubar o processo de teste.
	time.Sleep(20 * time.Millisecond)
}

// DryRun percorre a máquina de estados inteira mas nunca chama
// ForceReconnect — é o modo de estreia do DT-53, com risco zero à sessão real.
func TestHealer_DryRun_NuncaChamaForceReconnect(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido(), caido()},
		info:   evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) {
		o.DownThreshold = 2
		o.DryRun = true
	}))

	h.HealOnce(context.Background(), base)
	res, _ := h.HealOnce(context.Background(), base.Add(time.Minute))

	if res.Motivo != "dry_run" {
		t.Errorf("motivo = %q, queria \"dry_run\"", res.Motivo)
	}
	if gw.totalReconnects() != 0 {
		t.Fatalf("dry-run chamou ForceReconnect %d vezes — deveria ser sempre 0", gw.totalReconnects())
	}
}

// ── NotificarEvento (DT-53, Estágio 2) ──────────────────────────────────────

// Evento normal (não-QR) só ACORDA a sondagem mais cedo — não pode furar a
// graça nem chamar ForceReconnect direto. Confirmamos que ele de fato
// consultou o gateway (efeito indireto observável) sem tentar reconectar
// nesta primeira sondagem, já que a graça padrão exige 2 quedas seguidas.
func TestHealer_NotificarEvento_Disconnected_AcordaSondagemSemFurarGraca(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{caido(), caido()}, info: evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"}}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 2 }))

	h.NotificarEvento("Disconnected")

	// NotificarEvento dispara em goroutine própria — espera de forma
	// determinística até o gateway registrar a consulta, sem sleep arbitrário.
	prazo := time.Now().Add(time.Second)
	for gw.chamadasStatus() == 0 && time.Now().Before(prazo) {
		time.Sleep(time.Millisecond)
	}

	if gw.chamadasStatus() == 0 {
		t.Fatal("NotificarEvento deveria ter disparado uma sondagem")
	}
	if gw.totalReconnects() != 0 {
		t.Errorf("uma única sondagem via webhook nao deveria furar a graca (limiar=2), reconectou %d vezes", gw.totalReconnects())
	}
}

// O teste de segurança mais importante do Estágio 2: um QRCode detectado via
// webhook tem que desligar o healer PERMANENTEMENTE nesta execução — nunca
// mais chamar ForceReconnect, mesmo que os ticks continuem chegando.
func TestHealer_NotificarEvento_QRCode_DesligaPermanentemente(t *testing.T) {
	gw := &fakeGateway{
		status: []respStatus{caido()},
		info:   evolution.InstanceInfo{Jid: "553497202727:77@s.whatsapp.net"},
	}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(func(o *Options) { o.DownThreshold = 1 }))

	h.NotificarEvento("QRCode")
	n.aguardar(t, 1)

	if n.porChave(ports.ChaveQRDetectado) != 1 {
		t.Fatalf("deveria ter alertado 1 vez com a chave de QR detectado, alertou %d", n.porChave(ports.ChaveQRDetectado))
	}

	// Depois do disjuntor, NENHUM tick subsequente pode agir — nem sondar.
	for i := 0; i < 5; i++ {
		res, err := h.HealOnce(context.Background(), base.Add(time.Duration(i)*time.Minute))
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if res.Motivo != "qr_detectado" {
			t.Errorf("tick %d: motivo = %q, queria \"qr_detectado\"", i, res.Motivo)
		}
	}
	if gw.totalReconnects() != 0 {
		t.Fatalf("disjuntor de QR não deveria permitir NENHUM forcereconnect, chamou %d vezes", gw.totalReconnects())
	}
	if gw.chamadasStatus() != 0 {
		t.Errorf("disjuntor deveria evitar até a sondagem, chamou FetchStatus %d vezes", gw.chamadasStatus())
	}
}

// QRCode repetido não pode gerar um segundo alerta — o disjuntor já abriu, o
// operador já sabe.
func TestHealer_NotificarEvento_QRCodeRepetido_AlertaUmaSoVez(t *testing.T) {
	gw := &fakeGateway{status: []respStatus{caido()}}
	n := novoFakeNotifier()
	h := NewHealer(gw, n, opts(nil))

	h.NotificarEvento("QRCode")
	h.NotificarEvento("QRCode")
	h.NotificarEvento("QRCode")

	n.aguardar(t, 1)
	time.Sleep(20 * time.Millisecond) // margem para um eventual (indevido) segundo envio chegar
	if n.porChave(ports.ChaveQRDetectado) != 1 {
		t.Errorf("alertou %d vezes, queria exatamente 1", n.porChave(ports.ChaveQRDetectado))
	}
}
