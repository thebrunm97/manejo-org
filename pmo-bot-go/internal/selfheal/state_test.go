package selfheal

import (
	"net/http"
	"testing"
)

func TestClassificar(t *testing.T) {
	casos := []struct {
		nome string
		in   Entrada
		quer Estado
	}{
		{
			nome: "conectado e logado é saudável",
			in:   Entrada{Connected: true, LoggedIn: true},
			quer: EstadoSaudavel,
		},
		{
			nome: "conectado sem login é handshake",
			in:   Entrada{Connected: true, LoggedIn: false},
			quer: EstadoHandshake,
		},
		{
			nome: "erro de transporte no status é gateway fora",
			in:   Entrada{StatusErro: "connection refused"},
			quer: EstadoGatewayFora,
		},
		{
			nome: "401 no status é nao autorizada, nao gateway fora",
			in:   Entrada{StatusErro: "unauthorized", StatusCodigoHTTP: http.StatusUnauthorized},
			quer: EstadoNaoAutorizada,
		},
		{
			// O teste mais importante do pacote: sem jid, StartClient no
			// evolution-go abre fluxo de QR. Sem essa confirmação, o healer
			// jamais pode tentar reconectar.
			nome: "jid vazio é deslogada, nunca caida",
			in:   Entrada{Connected: false, Jid: ""},
			quer: EstadoDeslogada,
		},
		{
			nome: "jid presente e sem veto é caida (recuperavel)",
			in:   Entrada{Connected: false, Jid: "553497202727:77@s.whatsapp.net", DisconnectReason: "Reconnecting"},
			quer: EstadoCaida,
		},
		{
			// Fixture real do incidente de 2026-08-23: disconnect_reason lia
			// "Reconnecting" enquanto a causa real era DNS. Prova que o campo é
			// só lista de veto, nunca prova de saúde.
			nome: "reason 'Reconnecting' nao esta na lista de veto",
			in:   Entrada{Jid: "553497202727:77@s.whatsapp.net", DisconnectReason: "Reconnecting"},
			quer: EstadoCaida,
		},
		{
			nome: "reason 401 com jid presente ainda e deslogada — veto vence o jid",
			in:   Entrada{Jid: "553497202727:77@s.whatsapp.net", DisconnectReason: "401: logged out from another device"},
			quer: EstadoDeslogada,
		},
		{
			nome: "reason 402 (ban temporario) e deslogada",
			in:   Entrada{Jid: "553497202727:77@s.whatsapp.net", DisconnectReason: "402: temp banned"},
			quer: EstadoDeslogada,
		},
		{
			nome: "reason que so CONTEM 401 no meio do texto nao casa o veto",
			in:   Entrada{Jid: "553497202727:77@s.whatsapp.net", DisconnectReason: "erro código 401: nada a ver"},
			quer: EstadoCaida,
		},
		{
			nome: "info indisponivel por 401 e nao autorizada, nao caida",
			in:   Entrada{Connected: false, InfoErro: "unauthorized", InfoCodigoHTTP: http.StatusUnauthorized},
			quer: EstadoNaoAutorizada,
		},
		{
			nome: "info indisponivel por erro de rede e gateway fora",
			in:   Entrada{Connected: false, InfoErro: "timeout"},
			quer: EstadoGatewayFora,
		},
	}

	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			if got := classificar(c.in); got != c.quer {
				t.Errorf("classificar(%+v) = %s, queria %s", c.in, got, c.quer)
			}
		})
	}
}
