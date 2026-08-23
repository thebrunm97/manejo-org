package notify

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/smtp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

var instante = time.Date(2026, 8, 23, 17, 29, 0, 0, time.UTC)

func alertaCritico() ports.Alerta {
	return ports.Alerta{
		Chave:      ports.ChaveWhatsAppCaiu,
		Severidade: ports.SeveridadeCritico,
		Titulo:     "WhatsApp fora do ar",
		Corpo:      "detalhes",
		Em:         instante,
	}
}

// fake registra o que recebeu e permite programar falha/pânico.
type fake struct {
	nome          string
	mu            sync.Mutex
	recebidos     []ports.Alerta
	err           error
	entraEmPanico bool
}

func (f *fake) Name() string { return f.nome }

func (f *fake) Notify(_ context.Context, a ports.Alerta) error {
	if f.entraEmPanico {
		panic("canal explodiu")
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.recebidos = append(f.recebidos, a)
	return f.err
}

func (f *fake) total() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.recebidos)
}

// ── Cascata ────────────────────────────────────────────────────────────────

// O objetivo não é entregar por todos os caminhos, é garantir que chegue por
// algum. Se o Telegram cai, o e-mail precisa ser tentado — é para isso que a
// segunda via existe.
func TestCascata_CaiParaOProximoCanalQuandoOPrimeiroFalha(t *testing.T) {
	primeiro := &fake{nome: "telegram", err: errors.New("429 too many requests")}
	segundo := &fake{nome: "email"}

	if err := NewCascata(primeiro, segundo).Notify(context.Background(), alertaCritico()); err != nil {
		t.Fatalf("deveria ter sucesso via segundo canal, veio: %v", err)
	}
	if segundo.total() != 1 {
		t.Errorf("segundo canal recebeu %d alertas, queria 1", segundo.total())
	}
}

// Um canal que entra em pânico não pode derrubar o processo nem impedir a
// tentativa pelo outro canal — o Notify roda em goroutine nua, sem
// gin.Recovery() acima.
func TestCascata_SobreviveAPanicoDeUmCanalETentaOProximo(t *testing.T) {
	explosivo := &fake{nome: "telegram", entraEmPanico: true}
	segundo := &fake{nome: "email"}

	err := NewCascata(explosivo, segundo).Notify(context.Background(), alertaCritico())
	if err != nil {
		t.Fatalf("pânico no primeiro canal não deveria falhar a cascata: %v", err)
	}
	if segundo.total() != 1 {
		t.Errorf("segundo canal não foi tentado após o pânico")
	}
}

// Quando tudo falha, o erro precisa dizer o que cada canal respondeu — senão o
// diagnóstico vira adivinhação justamente no pior momento.
func TestCascata_ErroFinalCitaTodasAsFalhas(t *testing.T) {
	a := &fake{nome: "telegram", err: errors.New("sem rede")}
	b := &fake{nome: "email", err: errors.New("auth recusada")}

	err := NewCascata(a, b).Notify(context.Background(), alertaCritico())
	if err == nil {
		t.Fatal("deveria falhar quando todos os canais falham")
	}
	for _, esperado := range []string{"telegram", "sem rede", "email", "auth recusada"} {
		if !strings.Contains(err.Error(), esperado) {
			t.Errorf("erro não cita %q: %v", esperado, err)
		}
	}
}

// ── Cooldown ───────────────────────────────────────────────────────────────

// Repetição é o que faz o operador silenciar as notificações. Dentro da janela,
// a mesma chave só passa uma vez.
func TestCooldown_SuprimeRepeticaoDaMesmaChave(t *testing.T) {
	f := &fake{nome: "fake"}
	c := NewCooldown(f, 30*time.Minute)
	c.agora = func() time.Time { return instante }

	if err := c.Notify(context.Background(), alertaCritico()); err != nil {
		t.Fatalf("primeiro alerta deveria passar: %v", err)
	}
	err := c.Notify(context.Background(), alertaCritico())

	var sup *ErrSuprimido
	if !errors.As(err, &sup) {
		t.Fatalf("segundo alerta deveria vir como ErrSuprimido, veio: %v", err)
	}
	if f.total() != 1 {
		t.Errorf("canal recebeu %d alertas, queria 1", f.total())
	}
}

// Confirmar que voltou é tão urgente quanto avisar que caiu — e precisa LIMPAR
// a chave, senão a próxima queda seria confundida com repetição da anterior e
// morreria em silêncio.
func TestCooldown_RecuperadoFuraOCooldownELimpaAChave(t *testing.T) {
	f := &fake{nome: "fake"}
	c := NewCooldown(f, 30*time.Minute)
	c.agora = func() time.Time { return instante }

	c.Notify(context.Background(), alertaCritico())

	recuperado := alertaCritico()
	recuperado.Severidade = ports.SeveridadeRecuperado
	if err := c.Notify(context.Background(), recuperado); err != nil {
		t.Fatalf("recuperação deveria furar o cooldown: %v", err)
	}

	// Nova queda logo em seguida, ainda dentro da janela de 30min.
	if err := c.Notify(context.Background(), alertaCritico()); err != nil {
		t.Fatalf("nova queda após recuperação deveria alertar de novo: %v", err)
	}
	if f.total() != 3 {
		t.Errorf("canal recebeu %d alertas, queria 3", f.total())
	}
}

// Falha de entrega não pode consumir a janela: senão um 429 transitório do
// Telegram silenciaria o incidente inteiro por 30 minutos, que é o oposto do
// que o cooldown deveria fazer.
func TestCooldown_FalhaDeEntregaNaoConsomeAJanela(t *testing.T) {
	f := &fake{nome: "fake", err: errors.New("timeout")}
	c := NewCooldown(f, 30*time.Minute)
	c.agora = func() time.Time { return instante }

	c.Notify(context.Background(), alertaCritico())

	f.err = nil // rede voltou
	if err := c.Notify(context.Background(), alertaCritico()); err != nil {
		t.Fatalf("retentativa após falha deveria passar, veio: %v", err)
	}
	if f.total() != 2 {
		t.Errorf("canal recebeu %d alertas, queria 2", f.total())
	}
}

// Chaves diferentes são problemas diferentes, com remediações diferentes. Uma
// não pode calar a outra.
func TestCooldown_ChavesDiferentesNaoSeSilenciam(t *testing.T) {
	f := &fake{nome: "fake"}
	c := NewCooldown(f, 30*time.Minute)
	c.agora = func() time.Time { return instante }

	a1 := alertaCritico()
	a2 := alertaCritico()
	a2.Chave = ports.ChaveGatewayFora

	c.Notify(context.Background(), a1)
	if err := c.Notify(context.Background(), a2); err != nil {
		t.Fatalf("chave distinta deveria passar: %v", err)
	}
	if f.total() != 2 {
		t.Errorf("canal recebeu %d alertas, queria 2", f.total())
	}
}

// ── Telegram ───────────────────────────────────────────────────────────────

func TestTelegram_EnviaTextoComTituloECorpo(t *testing.T) {
	var corpoRecebido map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &corpoRecebido)
		w.Write([]byte(`{"ok":true}`))
	}))
	defer srv.Close()

	tg := NewTelegram("token-falso", "123")
	tg.baseURL = srv.URL

	if err := tg.Notify(context.Background(), alertaCritico()); err != nil {
		t.Fatalf("envio falhou: %v", err)
	}

	texto, _ := corpoRecebido["text"].(string)
	if !strings.Contains(texto, "WhatsApp fora do ar") || !strings.Contains(texto, "detalhes") {
		t.Errorf("texto enviado não carrega título e corpo: %q", texto)
	}
	if corpoRecebido["chat_id"] != "123" {
		t.Errorf("chat_id = %v, queria \"123\"", corpoRecebido["chat_id"])
	}
	// parse_mode ausente é deliberado: um "_" solto num nome de container faria
	// o Telegram recusar a mensagem inteira com 400.
	if _, tem := corpoRecebido["parse_mode"]; tem {
		t.Error("parse_mode não deveria ser enviado")
	}
}

// O token vai na URL. Ele não pode vazar para a mensagem de erro, que acaba em
// log — a chave de produção já é exposta demais (DT-45).
func TestTelegram_ErroNaoVazaOToken(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"ok":false,"description":"Unauthorized"}`))
	}))
	defer srv.Close()

	tg := NewTelegram("token-secreto-nao-vaze", "123")
	tg.baseURL = srv.URL

	err := tg.Notify(context.Background(), alertaCritico())
	if err == nil {
		t.Fatal("status 401 deveria virar erro")
	}
	if strings.Contains(err.Error(), "token-secreto-nao-vaze") {
		t.Errorf("o token vazou na mensagem de erro: %v", err)
	}
}

// ── E-mail ─────────────────────────────────────────────────────────────────

func TestEmail_MontaCabecalhosEAssuntoPorSeveridade(t *testing.T) {
	var msgRecebida string
	var paraRecebido []string

	e := NewEmail("smtp.exemplo.com", "587", "user", "senha", "bot@exemplo.com", "ops@exemplo.com, dev@exemplo.com")
	e.enviar = func(_ string, _ smtp.Auth, _ string, to []string, msg []byte) error {
		paraRecebido = to
		msgRecebida = string(msg)
		return nil
	}

	if err := e.Notify(context.Background(), alertaCritico()); err != nil {
		t.Fatalf("envio falhou: %v", err)
	}

	if len(paraRecebido) != 2 {
		t.Errorf("destinatários = %v, queria 2 (lista separada por vírgula)", paraRecebido)
	}
	if !strings.Contains(msgRecebida, "Subject: [CRITICO] WhatsApp fora do ar") {
		t.Errorf("assunto sem marcador de severidade:\n%s", msgRecebida)
	}
	if !strings.Contains(msgRecebida, "charset=UTF-8") {
		t.Errorf("sem charset UTF-8, os acentos e emoji chegariam quebrados:\n%s", msgRecebida)
	}
}

func TestEmail_SemDestinatarioFalhaExplicitamente(t *testing.T) {
	e := NewEmail("smtp.exemplo.com", "587", "", "", "bot@exemplo.com", "  ")
	if err := e.Notify(context.Background(), alertaCritico()); err == nil {
		t.Fatal("sem destinatário deveria falhar em vez de fingir sucesso")
	}
}

// ── Fábrica ────────────────────────────────────────────────────────────────

// Sem configuração o sistema não pode quebrar nem exigir nil-check em cada call
// site: devolve o objeto nulo e sinaliza que a operação está surda.
func TestNewFromEnv_SemConfiguracaoDevolveNoop(t *testing.T) {
	for _, k := range []string{"TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "ALERT_SMTP_HOST", "ALERT_EMAIL_FROM", "ALERT_EMAIL_TO"} {
		t.Setenv(k, "")
	}

	n, temCanal := NewFromEnv()
	if temCanal {
		t.Error("não deveria reportar canal ativo")
	}
	if n == nil {
		t.Fatal("nunca pode devolver nil — o call site não checa")
	}
	if err := n.Notify(context.Background(), alertaCritico()); err != nil {
		t.Errorf("Noop deveria engolir silenciosamente: %v", err)
	}
}

// Telegram meio configurado é quase certamente engano de quem editou o .env.
// Aceitar pela metade faria o alerta falhar só no dia do incidente.
func TestNewFromEnv_IgnoraTelegramPelaMetade(t *testing.T) {
	t.Setenv("TELEGRAM_BOT_TOKEN", "so-o-token")
	t.Setenv("TELEGRAM_CHAT_ID", "")
	for _, k := range []string{"ALERT_SMTP_HOST", "ALERT_EMAIL_FROM", "ALERT_EMAIL_TO"} {
		t.Setenv(k, "")
	}

	if _, temCanal := NewFromEnv(); temCanal {
		t.Error("configuração pela metade não deveria contar como canal ativo")
	}
}

func TestNewFromEnv_MontaCascataQuandoConfigurado(t *testing.T) {
	t.Setenv("TELEGRAM_BOT_TOKEN", "token")
	t.Setenv("TELEGRAM_CHAT_ID", "123")
	t.Setenv("ALERT_SMTP_HOST", "smtp.exemplo.com")
	t.Setenv("ALERT_EMAIL_FROM", "bot@exemplo.com")
	t.Setenv("ALERT_EMAIL_TO", "ops@exemplo.com")

	n, temCanal := NewFromEnv()
	if !temCanal {
		t.Fatal("deveria reportar canal ativo")
	}
	if !strings.Contains(n.Name(), "cooldown") {
		t.Errorf("a cadeia deveria estar envolvida pelo cooldown, veio %q", n.Name())
	}
}
