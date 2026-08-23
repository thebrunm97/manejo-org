package selfheal

import (
	"strings"
	"testing"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

// base é um instante fixo. O Rastreador recebe o relógio como parâmetro
// justamente para nenhum teste precisar dormir — mesma decisão do ReapOnce do
// StuckJobReaper (DT-50).
var base = time.Date(2026, 8, 23, 17, 29, 0, 0, time.UTC)

func caiu(detalhe string) Observacao { return Observacao{Detalhe: detalhe} }
func conectou() Observacao           { return Observacao{Conectado: true, Detalhe: "open"} }
func falhou(erro string) Observacao  { return Observacao{Erro: erro} }

// Uma única sondagem falha não pode acordar ninguém: o evolution-go tem
// auto-restart próprio que resolve em ~20s, e alertar antes dele terminar
// geraria alarme falso em toda queda transitória.
func TestRastreador_NaoAlertaNaPrimeiraQueda(t *testing.T) {
	r := NewRastreador("manejo-org", 2)

	if a := r.Observar(base, caiu("close")); a != nil {
		t.Fatalf("alertou cedo demais na 1a sondagem: %+v", a)
	}
}

// Atingido o limiar, alerta uma vez — e o corpo precisa ser acionável sem
// laptop, com o comando de remediação literal.
func TestRastreador_AlertaAoAtingirLimiar(t *testing.T) {
	r := NewRastreador("manejo-org", 2)

	r.Observar(base, caiu("close"))
	a := r.Observar(base.Add(time.Minute), caiu("close"))

	if a == nil {
		t.Fatal("deveria ter alertado ao atingir o limiar")
	}
	if a.Severidade != ports.SeveridadeCritico {
		t.Errorf("severidade = %q, queria %q", a.Severidade, ports.SeveridadeCritico)
	}
	if a.Chave != ports.ChaveWhatsAppCaiu {
		t.Errorf("chave = %q, queria %q", a.Chave, ports.ChaveWhatsAppCaiu)
	}
	if !strings.Contains(a.Corpo, "docker restart pmo-prod-stack-evolution-go-1") {
		t.Errorf("corpo sem o comando de remediação, inútil para quem está no celular:\n%s", a.Corpo)
	}
	if !strings.Contains(a.Corpo, "1min00s") {
		t.Errorf("corpo sem o tempo fora do ar:\n%s", a.Corpo)
	}
}

// A repetição é o que treina o operador a ignorar a notificação. Um incidente,
// um alerta — a supressão do notify.Cooldown é a segunda linha, não a primeira.
func TestRastreador_NaoRepeteAlertaDoMesmoIncidente(t *testing.T) {
	r := NewRastreador("manejo-org", 2)

	r.Observar(base, caiu("close"))
	if a := r.Observar(base.Add(time.Minute), caiu("close")); a == nil {
		t.Fatal("deveria ter alertado")
	}

	for i := 2; i < 40; i++ {
		if a := r.Observar(base.Add(time.Duration(i)*time.Minute), caiu("close")); a != nil {
			t.Fatalf("alertou de novo na sondagem %d do mesmo incidente: %+v", i, a)
		}
	}
}

// Sem a confirmação de volta, o operador fica sem saber se ainda precisa agir.
// É metade do valor do alerta e foi exatamente o que faltou nos dois incidentes
// de 2026-08-23.
func TestRastreador_ConfirmaRecuperacaoComTempoForaDoAr(t *testing.T) {
	r := NewRastreador("manejo-org", 2)

	r.Observar(base, caiu("close"))
	r.Observar(base.Add(time.Minute), caiu("close"))

	a := r.Observar(base.Add(36*time.Minute+35*time.Second), conectou())
	if a == nil {
		t.Fatal("deveria confirmar a recuperação")
	}
	if a.Severidade != ports.SeveridadeRecuperado {
		t.Errorf("severidade = %q, queria %q", a.Severidade, ports.SeveridadeRecuperado)
	}
	// A duração é medida desde a PRIMEIRA sondagem falha, não desde o alerta.
	if !strings.Contains(a.Corpo, "36min35s") {
		t.Errorf("corpo sem a duração real do incidente:\n%s", a.Corpo)
	}
}

// Recuperar de algo que nunca foi anunciado produziria um "voltou!" sobre uma
// queda que o operador não soube que houve — ruído puro.
func TestRastreador_NaoConfirmaRecuperacaoSemAlertaPrevio(t *testing.T) {
	r := NewRastreador("manejo-org", 2)

	r.Observar(base, caiu("close")) // 1 sondagem só: abaixo do limiar

	if a := r.Observar(base.Add(time.Minute), conectou()); a != nil {
		t.Fatalf("confirmou recuperação de incidente que nunca foi alertado: %+v", a)
	}
}

// Depois de recuperar, o estado precisa zerar de verdade: uma nova queda é um
// incidente novo e tem que alertar de novo. Sem isso, a segunda queda da noite
// passaria em silêncio.
func TestRastreador_NovaQuedaDepoisDeRecuperarAlertaDeNovo(t *testing.T) {
	r := NewRastreador("manejo-org", 2)

	r.Observar(base, caiu("close"))
	r.Observar(base.Add(1*time.Minute), caiu("close"))
	r.Observar(base.Add(2*time.Minute), conectou())

	r.Observar(base.Add(3*time.Minute), caiu("close"))
	a := r.Observar(base.Add(4*time.Minute), caiu("close"))

	if a == nil {
		t.Fatal("segunda queda deveria alertar de novo")
	}
	// E a duração precisa contar a partir da nova queda, não da primeira.
	if !strings.Contains(a.Corpo, "1min00s") {
		t.Errorf("duração vazou do incidente anterior:\n%s", a.Corpo)
	}
}

// Falha ao FALAR com o gateway é problema diferente de o gateway dizer que a
// sessão caiu: a remediação não é a mesma, então a chave de deduplicação
// também não pode ser.
func TestRastreador_DistingueGatewayForaDeSessaoCaida(t *testing.T) {
	r := NewRastreador("manejo-org", 2)

	r.Observar(base, falhou("connection refused"))
	a := r.Observar(base.Add(time.Minute), falhou("connection refused"))

	if a == nil {
		t.Fatal("deveria ter alertado")
	}
	if a.Chave != ports.ChaveGatewayFora {
		t.Errorf("chave = %q, queria %q", a.Chave, ports.ChaveGatewayFora)
	}
	if !strings.Contains(a.Corpo, "connection refused") {
		t.Errorf("corpo deveria citar o erro de transporte:\n%s", a.Corpo)
	}
}

// Limiar inválido não pode desligar a proteção silenciosamente — mesma
// convenção de NewStuckJobReaper, que clampa argumento não-positivo.
func TestRastreador_LimiarInvalidoCaiNoPadrao(t *testing.T) {
	r := NewRastreador("manejo-org", 0)

	if a := r.Observar(base, caiu("close")); a != nil {
		t.Fatalf("limiar 0 não deveria alertar de imediato: %+v", a)
	}
	if a := r.Observar(base.Add(time.Minute), caiu("close")); a == nil {
		t.Fatalf("limiar 0 deveria ter caído no padrão de %d", LimiarPadrao)
	}
}
