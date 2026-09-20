package state

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"math/big"
	"time"
)

// SMSSender é o ponto único de integração com um provedor de SMS real.
//
// POR QUE ISTO É UMA VARIÁVEL E NÃO UMA CHAMADA DE API DIRETA
//
// Nenhum provedor foi escolhido/configurado ainda (ver pesquisa de preços em
// TECHNICAL_DEBT.md — Twilio cobra ~US$0,42/SMS pra Moçambique; Africa's
// Talking, Vonage e MessageBird ainda sem cotação confirmada). Por padrão
// esta função retorna erro explícito em vez de fingir que enviou — falhar
// visivelmente é melhor que deixar o produtor esperando um código que nunca
// chega. Trocar por uma chamada de API real é só reatribuir esta variável na
// inicialização do bot (cmd/server/main.go); nenhum outro código deste
// arquivo muda, independente de qual provedor for escolhido.
var SMSSender func(ctx context.Context, telefone, mensagem string) error = func(ctx context.Context, telefone, mensagem string) error {
	return fmt.Errorf("nenhum provedor de SMS configurado (ver DT-141 em TECHNICAL_DEBT.md)")
}

const (
	otpSMSTTL           = 10 * time.Minute
	otpSMSMaxTentativas = 5
)

// gerarCodigoOTP sorteia um código de 6 dígitos (000000–999999) usando
// crypto/rand — não math/rand, que não é seguro pra nada que precisa ser
// imprevisível (o mesmo padrão já cobrado do DT-89/DT-21 em outros lugares
// do repo pra geração de código).
func gerarCodigoOTP() (string, error) {
	max := big.NewInt(1000000)
	n, err := rand.Int(rand.Reader, max)
	if err != nil {
		return "", fmt.Errorf("gerar OTP: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// hashCodigoOTP guarda só o hash do código no contexto da FSM (memória do
// processo), não o valor cru — defesa em profundidade mesmo sendo estado
// efêmero, pra um dump de memória/log acidental do contexto não vazar o
// código em texto claro.
func hashCodigoOTP(codigo string) string {
	soma := sha256.Sum256([]byte(codigo))
	return hex.EncodeToString(soma[:])
}

// codigoOTPConfere compara em tempo constante — o mesmo cuidado que um
// segredo de sessão mereceria, mesmo sendo um código de 6 dígitos com TTL
// curto e limite de tentativas.
func codigoOTPConfere(hashArmazenado, candidato string) bool {
	return subtle.ConstantTimeCompare([]byte(hashArmazenado), []byte(hashCodigoOTP(candidato))) == 1
}
