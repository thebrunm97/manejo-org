package guardrails

import "testing"

func TestIsSpeechSensitive_ConteudoDoProdutor(t *testing.T) {
	sensiveis := []struct {
		nome  string
		texto string
	}{
		{"valor em reais", "Registrei a venda de 50 sacas por R$ 4.500,00."},
		{"vocabulario financeiro", "Seu saldo do mes fechou positivo."},
		{"venda", "Vendi 10 caixas de tomate ontem."},
		{"talhao", "A aplicacao foi feita no talhao 3."},
		{"propriedade", "A propriedade esta com o certificado em dia."},
		{"coordenada", "A latitude cadastrada esta incorreta."},
		{"cpf no texto", "O CPF 123.456.789-00 consta no cadastro."},
		{"telefone no texto", "Pode chamar no 34 99731-7545."},
		{"email no texto", "Enviei para produtor@exemplo.com.br."},
		{"nota fiscal", "A nota fiscal precisa ser anexada."},
	}

	for _, c := range sensiveis {
		t.Run(c.nome, func(t *testing.T) {
			if !IsSpeechSensitive(c.texto) {
				t.Errorf("deveria ser sensivel: %q", c.texto)
			}
		})
	}
}

func TestIsSpeechSensitive_ConteudoGenerico(t *testing.T) {
	genericos := []struct {
		nome  string
		texto string
	}{
		{"saudacao", "Ola! Como posso ajudar hoje?"},
		{"agronomia geral", "A lagarta do cartucho ataca principalmente o milho."},
		{"instrucao", "Voce pode me mandar uma foto da folha?"},
		{"clima", "A previsao indica chuva no fim da semana."},
		{"vazio", ""},
		{"so espaco", "   "},
	}

	for _, c := range genericos {
		t.Run(c.nome, func(t *testing.T) {
			if IsSpeechSensitive(c.texto) {
				t.Errorf("nao deveria ser sensivel: %q", c.texto)
			}
		})
	}
}

// O motivo distingue "caiu no Piper porque o conteudo e sensivel" de "caiu no
// Piper porque a nuvem estava fora" — as duas situacoes pedem acoes opostas.
func TestClassifySpeechSensitivity_Motivo(t *testing.T) {
	casos := []struct {
		texto      string
		querSens   bool
		querMotivo string
	}{
		{"", false, "vazio"},
		{"Ola, tudo bem?", false, "nao_sensivel"},
		{"Meu CPF e 123.456.789-00", true, "identificador_direto"},
		{"Vendi por R$ 200", true, "termo:r$"},
	}

	for _, c := range casos {
		sens, motivo := ClassifySpeechSensitivity(c.texto)
		if sens != c.querSens {
			t.Errorf("ClassifySpeechSensitivity(%q) sensivel = %v, queria %v", c.texto, sens, c.querSens)
		}
		if motivo != c.querMotivo {
			t.Errorf("ClassifySpeechSensitivity(%q) motivo = %q, queria %q", c.texto, motivo, c.querMotivo)
		}
	}
}

// O classificador precisa falhar para o lado seguro: na duvida, sensivel.
// Este teste fixa a direcao do vies para que uma refatoracao futura nao o
// inverta sem que alguem perceba.
func TestIsSpeechSensitive_ViesParaOLadoSeguro(t *testing.T) {
	// Texto ambiguo que menciona valor sem ser um extrato: ainda assim deve
	// ser tratado como sensivel, porque o custo do falso positivo e uma
	// sintese local a mais, e o do falso negativo e vazamento.
	if !IsSpeechSensitive("O valor de referencia da adubacao varia por cultura.") {
		t.Error("texto ambiguo com 'valor' deveria cair para o lado seguro (sensivel)")
	}
}
