package state

import (
	"testing"

	"github.com/thebrunm97/pmo-bot-go/internal/ports"
)

func TestParsePreferenceCommand_Reconhecidos(t *testing.T) {
	casos := []struct {
		entrada string
		quer    ports.ResponsePreference
	}{
		{"modo texto", ports.PreferenceText},
		{"Modo Texto", ports.PreferenceText},
		{"  modo texto  ", ports.PreferenceText},
		{"modo texto!", ports.PreferenceText},
		{"modo    texto", ports.PreferenceText}, // espaços repetidos
		{"sem áudio", ports.PreferenceText},
		{"só texto", ports.PreferenceText},
		{"modo áudio", ports.PreferenceAudio},
		{"modo audio", ports.PreferenceAudio}, // sem acento
		{"quero áudio", ports.PreferenceAudio},
		{"modo automático", ports.PreferenceAuto},
		{"modo automatico", ports.PreferenceAuto},
	}

	for _, c := range casos {
		t.Run(c.entrada, func(t *testing.T) {
			pref, ok := parsePreferenceCommand(c.entrada)
			if !ok {
				t.Fatalf("deveria reconhecer %q como comando", c.entrada)
			}
			if pref != c.quer {
				t.Errorf("= %q, queria %q", pref, c.quer)
			}
		})
	}
}

// Este é o teste que impede o recurso de virar um perigo: reconhecer o comando
// dentro de uma frase maior faria uma pergunta legítima mudar a configuração
// do produtor em silêncio, sem que ele soubesse.
func TestParsePreferenceCommand_NaoDisparaDentroDeFrase(t *testing.T) {
	frases := []string{
		"não quero áudio de outra pessoa no meu talhão",
		"o modo texto do aplicativo está diferente, por quê?",
		"como faço para usar o modo áudio?",
		"me explica o modo automatico do pulverizador",
		"vendi 10 caixas de tomate",
		"",
		"   ",
	}

	for _, f := range frases {
		t.Run(f, func(t *testing.T) {
			if _, ok := parsePreferenceCommand(f); ok {
				t.Errorf("NÃO deveria tratar como comando: %q", f)
			}
		})
	}
}

// Toda preferência precisa ter confirmação, senão o produtor muda o modo e não
// recebe resposta nenhuma — um mapa incompleto produziria string vazia.
func TestConfirmacaoPreferencia_CobreTodosOsModos(t *testing.T) {
	modos := []ports.ResponsePreference{
		ports.PreferenceText,
		ports.PreferenceAudio,
		ports.PreferenceAuto,
	}

	for _, m := range modos {
		msg, ok := confirmacaoPreferencia[m]
		if !ok || msg == "" {
			t.Errorf("falta mensagem de confirmação para o modo %q", m)
		}
	}
}

// Os valores gravados no banco precisam casar com o CHECK constraint da
// migration 20260823100000, senão a escrita falha em produção com 23514 e o
// produtor recebe "não consegui salvar" sem causa aparente.
func TestPreferenciasCasamComOCheckDaMigration(t *testing.T) {
	permitidos := map[string]bool{"texto": true, "audio": true, "automatico": true}

	for entrada, pref := range comandosPreferencia {
		if !permitidos[string(pref)] {
			t.Errorf("comando %q mapeia para %q, que o CHECK da migration rejeita", entrada, pref)
		}
	}
}
