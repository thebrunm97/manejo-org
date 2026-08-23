package evolution

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// Este pacote não tinha nenhum teste antes do DT-53. As respostas usadas aqui
// são as reais, capturadas via curl durante o incidente de 2026-08-23 às
// 17:29-18:05 (36min35s fora do ar) — não são um formato imaginado.

func servidorFalso(t *testing.T, handler http.HandlerFunc) *EvolutionAdapter {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return NewEvolutionAdapter(srv.URL, "manejo-org", "chave-de-teste")
}

func TestFetchStatus_DecodificaConectadoELogado(t *testing.T) {
	a := servidorFalso(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/instance/status" {
			t.Errorf("path = %q, queria /instance/status", r.URL.Path)
		}
		if r.Header.Get("apikey") != "chave-de-teste" {
			t.Errorf("apikey ausente ou errada: %q", r.Header.Get("apikey"))
		}
		w.Write([]byte(`{"data":{"Connected":true,"LoggedIn":true,"Name":"Bruno"},"message":"success"}`))
	})

	status, err := a.FetchStatus(context.Background())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !status.Connected || !status.LoggedIn {
		t.Errorf("status = %+v, queria Connected=true LoggedIn=true", status)
	}
}

// Fixture real do incidente de 2026-08-23: os dois booleanos vêm false, mas
// isso sozinho não distingue "sessão caiu" de "precisa de QR" — é para isso
// que FetchInfo existe.
func TestFetchStatus_DecodificaEstadoCaido(t *testing.T) {
	a := servidorFalso(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":{"Connected":false,"LoggedIn":false,"Name":""},"message":"success"}`))
	})

	status, err := a.FetchStatus(context.Background())
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if status.Connected || status.LoggedIn {
		t.Errorf("status = %+v, queria os dois false", status)
	}
}

func TestFetchStatus_401VemComoStatusError(t *testing.T) {
	a := servidorFalso(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"error":"not authorized"}`))
	})

	_, err := a.FetchStatus(context.Background())
	var statusErr *StatusError
	if !errors.As(err, &statusErr) {
		t.Fatalf("erro deveria ser *StatusError, veio %T: %v", err, err)
	}
	if statusErr.Code != http.StatusUnauthorized {
		t.Errorf("Code = %d, queria 401", statusErr.Code)
	}
}

// Fixture real, capturada durante o incidente: disconnect_reason lia
// "Reconnecting" enquanto a causa verdadeira era falha de DNS — prova viva de
// que o campo só serve como lista de veto, nunca como prova de saúde.
func TestFetchInfo_DecodificaJidEDisconnectReason(t *testing.T) {
	a := servidorFalso(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/instance/info/manejo-org" {
			t.Errorf("path = %q, queria /instance/info/manejo-org", r.URL.Path)
		}
		w.Write([]byte(`{"data":{"jid":"553497202727:77@s.whatsapp.net","connected":false,` +
			`"disconnect_reason":"Reconnecting","events":"MESSAGE,SEND_MESSAGE,CONNECTION"},"message":"success"}`))
	})

	info, err := a.FetchInfo(context.Background(), "manejo-org")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if info.Jid == "" {
		t.Error("Jid não deveria vir vazio")
	}
	if info.DisconnectReason != "Reconnecting" {
		t.Errorf("DisconnectReason = %q, queria %q", info.DisconnectReason, "Reconnecting")
	}
	if info.Events != "MESSAGE,SEND_MESSAGE,CONNECTION" {
		t.Errorf("Events = %q — se vier só MESSAGE, o detector de CONNECTION do Estágio 2 quebra", info.Events)
	}
}

// Jid vazio é o predicado central da primeira trava contra QR: sem ele,
// StartClient no evolution-go abre fluxo de QR. O adapter precisa devolver
// essa informação intacta, sem normalizar "" para nenhum outro valor.
func TestFetchInfo_JidVazioPermanceVazio(t *testing.T) {
	a := servidorFalso(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":{"jid":"","connected":false,"disconnect_reason":"","events":""},"message":"success"}`))
	})

	info, err := a.FetchInfo(context.Background(), "manejo-org")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if info.Jid != "" {
		t.Errorf("Jid = %q, queria vazio", info.Jid)
	}
}

func TestForceReconnect_EnviaNumeroNoCorpoENaoDecideProStatusHTTP(t *testing.T) {
	var corpoRecebido map[string]interface{}
	a := servidorFalso(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("método = %s, queria POST", r.Method)
		}
		if r.URL.Path != "/instance/forcereconnect/manejo-org" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&corpoRecebido); err != nil {
			t.Fatalf("falha ao decodificar corpo da requisição: %v", err)
		}
		// Fixture real: o serviço dorme 2s e devolve 500 mesmo quando a
		// reconexão real vai ter sucesso em ~10s. ForceReconnect não deve tratar
		// isso como decisão — só propagar o erro para quem sabe reconsultar
		// FetchStatus depois.
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"error":"failed to connect"}`))
	})

	err := a.ForceReconnect(context.Background(), "manejo-org", "553497202727")
	if err == nil {
		t.Fatal("deveria propagar o 500 — quem decide se foi sucesso é o chamador, via FetchStatus")
	}
	if corpoRecebido["number"] != "553497202727" {
		t.Errorf("corpo enviado = %v, queria number=553497202727", corpoRecebido)
	}
}

// ── ExtractEventType (DT-53, Estágio 2) ─────────────────────────────────────

func TestExtractEventType_ReconheceEventosDeConexao(t *testing.T) {
	for _, evento := range []string{"Disconnected", "ConnectFailure", "LoggedOut", "Connected", "QRCode"} {
		body := []byte(`{"event":"` + evento + `","data":{}}`)
		if got := ExtractEventType(body); got != evento {
			t.Errorf("ExtractEventType(%q) = %q, queria %q", evento, got, evento)
		}
	}
}

// Mensagens (o caminho de verdade do handler) não podem disparar o self-heal —
// só eventos de CONNECTION interessam a ele.
func TestExtractEventType_IgnoraEventosDeMensagem(t *testing.T) {
	for _, evento := range []string{"Message", "messages.upsert", "ButtonClick", "HistorySync", ""} {
		body := []byte(`{"event":"` + evento + `","data":{}}`)
		if got := ExtractEventType(body); got != "" {
			t.Errorf("ExtractEventType(%q) = %q, queria vazio", evento, got)
		}
	}
}

func TestExtractEventType_JSONInvalidoDevolveVazio(t *testing.T) {
	if got := ExtractEventType([]byte("isto não é json")); got != "" {
		t.Errorf("ExtractEventType(json inválido) = %q, queria vazio (nunca deveria propagar erro pro webhook)", got)
	}
}
