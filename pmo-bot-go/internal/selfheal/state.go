package selfheal

import (
	"net/http"
	"regexp"
)

// Estado é o resultado de classificar uma única sondagem.
type Estado string

const (
	EstadoSaudavel      Estado = "saudavel"
	EstadoHandshake     Estado = "handshake"
	EstadoCaida         Estado = "caida"
	EstadoDeslogada     Estado = "deslogada"
	EstadoGatewayFora   Estado = "gateway_fora"
	EstadoNaoAutorizada Estado = "nao_autorizada"
)

// vetoLogout casa disconnect_reason que indica sessão deslogada ou banida.
//
// Casamento pelo PREFIXO NUMÉRICO do código, nunca pelo texto em inglês da
// mensagem — a lib pode mudar o texto entre versões, o código é o contrato
// estável. 401/403/406 são IsLoggedOut() no whatsmeow; 402 é ban temporário.
var vetoLogout = regexp.MustCompile(`^(401|402|403|406):`)

// Entrada agrega tudo que classificar precisa para decidir, sem tocar rede nem
// relógio — é o que torna a máquina de estados inteiramente testável por
// tabela, sem fake HTTP nem mock de tempo.
//
// Deliberadamente NÃO inclui contadores de tentativa, backoff nem tempo: isso
// é responsabilidade do Healer, não desta função. classificar decide só a
// partir de uma sondagem isolada.
type Entrada struct {
	// StatusErro é o erro de FetchStatus, se houver. Vazio quando a sondagem
	// respondeu (ainda que reportando queda).
	StatusErro       string
	StatusCodigoHTTP int

	Connected bool
	LoggedIn  bool

	// Campos de FetchInfo — só fazem sentido quando !Connected, e mesmo assim
	// só foram consultados se InfoErro estiver vazio.
	InfoErro         string
	InfoCodigoHTTP   int
	Jid              string
	DisconnectReason string
}

// classificar decide o estado a partir de uma sondagem isolada.
//
// A ordem dos checks importa: erro de transporte no /instance/status vem
// primeiro porque, sem conseguir nem consultar o estado, nenhuma das outras
// perguntas tem resposta confiável.
func classificar(in Entrada) Estado {
	if in.StatusErro != "" {
		if in.StatusCodigoHTTP == http.StatusUnauthorized {
			return EstadoNaoAutorizada
		}
		return EstadoGatewayFora
	}

	if in.Connected && in.LoggedIn {
		return EstadoSaudavel
	}
	if in.Connected && !in.LoggedIn {
		return EstadoHandshake
	}

	// !Connected a partir daqui. Antes de decidir qualquer ação, precisamos
	// saber se há um jid persistido — é o predicado que StartClient usa no
	// evolution-go para escolher entre retomar sessão e abrir fluxo de QR
	// (whatsmeow.go:494-538), verificado aqui uma camada antes.
	if in.InfoErro != "" {
		if in.InfoCodigoHTTP == http.StatusUnauthorized || in.InfoCodigoHTTP == http.StatusForbidden {
			// A chave do bot não alcança a rota admin de /instance/info nesta
			// instalação. Sem conseguir confirmar o jid, agir seria arriscar QR
			// às cegas — mesmo tratamento de "precisa de decisão humana" que
			// DESLOGADA recebe, mas com um motivo diferente no alerta.
			return EstadoNaoAutorizada
		}
		return EstadoGatewayFora
	}

	if in.Jid == "" || vetoLogout.MatchString(in.DisconnectReason) {
		return EstadoDeslogada
	}
	return EstadoCaida
}
