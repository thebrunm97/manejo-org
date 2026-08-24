package state

import "testing"

// Os quatro campos são obrigatórios porque a RPC setup_initial_profile grava
// os quatro. Deixar um vazio passar criaria propriedade sem nome ou talhão
// fantasma — e este é o cadastro OFICIAL do produtor, não um rascunho.
func TestCadastroSoEstaCompletoComOsQuatroCampos(t *testing.T) {
	completo := DadosCadastro{Nome: "João da Silva", PropriedadeNome: "Sítio Boa Vista", AreaHa: 12, TalhaoNome: "Talhão da Frente"}
	if !completo.completo() {
		t.Fatalf("cadastro com os 4 campos deveria estar completo, faltantes=%v", completo.faltantes())
	}

	casos := map[string]DadosCadastro{
		"sem nome":        {PropriedadeNome: "Sítio", AreaHa: 1, TalhaoNome: "T1"},
		"sem propriedade": {Nome: "João", AreaHa: 1, TalhaoNome: "T1"},
		"sem área":        {Nome: "João", PropriedadeNome: "Sítio", TalhaoNome: "T1"},
		"sem talhão":      {Nome: "João", PropriedadeNome: "Sítio", AreaHa: 1},
	}
	for nome, d := range casos {
		t.Run(nome, func(t *testing.T) {
			if d.completo() {
				t.Error("deveria estar incompleto")
			}
			if len(d.faltantes()) != 1 {
				t.Errorf("deveria faltar exatamente 1 campo, faltaram %d: %v", len(d.faltantes()), d.faltantes())
			}
		})
	}
}

// Área zero ou negativa não é "informada": é ausência. Um cadastro com 0 ha
// passaria pela RPC e criaria propriedade sem tamanho.
func TestAreaZeroOuNegativaContaComoAusente(t *testing.T) {
	for _, area := range []float64{0, -5} {
		d := DadosCadastro{Nome: "João", PropriedadeNome: "Sítio", AreaHa: area, TalhaoNome: "T1"}
		if d.completo() {
			t.Errorf("área %g não deveria contar como informada", area)
		}
	}
}

// Confirmação só vale com a mensagem inteira. Aceitar por substring faria
// "não, o sim que eu disse foi errado" cadastrar em silêncio — mesma lição
// que o DT-29 já registrou para o comando de preferência de resposta.
func TestConfirmacaoNaoDisparaPorSubstring(t *testing.T) {
	if !ehConfirmacao("SIM") || !ehConfirmacao("sim") || !ehConfirmacao("  ok  ") {
		t.Error("confirmações diretas deveriam ser reconhecidas")
	}
	if ehConfirmacao("não é bem assim") {
		t.Error("frase contendo 'sim' dentro de outra palavra não pode confirmar")
	}
	if ehConfirmacao("simplesmente não") {
		t.Error("'simplesmente' não pode ser lido como 'sim'")
	}
}

func TestNegacaoReconhecidaComEsemAcento(t *testing.T) {
	for _, s := range []string{"não", "nao", "N", " errado "} {
		if !ehNegacao(s) {
			t.Errorf("%q deveria ser negação", s)
		}
	}
	if ehNegacao("sim") {
		t.Error("'sim' não é negação")
	}
}

// A ida e volta pelo contexto da FSM precisa preservar os dados: é o que o
// "SIM" vai ler para gravar. Se perder um campo aqui, o cadastro sai torto.
func TestDadosSobrevivemAoContextoDaFSM(t *testing.T) {
	original := DadosCadastro{Nome: "Maria Souza", PropriedadeNome: "Chácara Recanto", AreaHa: 3.5, TalhaoNome: "Horta Velha"}

	volta, ok := dadosDoContexto(contextoDosDados(original))
	if !ok {
		t.Fatal("dados completos deveriam voltar do contexto")
	}
	if volta != original {
		t.Errorf("dados mudaram na ida e volta: %+v != %+v", volta, original)
	}
}

// Estado perdido (restart no meio do cadastro) não pode virar gravação de
// dados que ninguém conferiu.
func TestContextoAusenteOuIncompletoNaoConfirma(t *testing.T) {
	if _, ok := dadosDoContexto(nil); ok {
		t.Error("contexto nil não pode devolver dados válidos")
	}
	if _, ok := dadosDoContexto(map[string]interface{}{}); ok {
		t.Error("contexto sem a chave 'cadastro' não pode devolver dados válidos")
	}

	parcial := DadosCadastro{Nome: "João"} // faltam 3 campos
	if _, ok := dadosDoContexto(contextoDosDados(parcial)); ok {
		t.Error("dados incompletos no contexto não podem ser tratados como confirmáveis")
	}
}

// A heurística existe para não gastar chamada de LLM com "oi". Erra de
// propósito para o lado de tentar extrair.
func TestHeuristicaDeDadosIgnoraSaudacoes(t *testing.T) {
	saudacoes := []string{"oi", "bom dia", "olá", "e aí", "tudo bem?"}
	for _, s := range saudacoes {
		if pareceConterDados(s) {
			t.Errorf("%q não deveria disparar extração", s)
		}
	}

	comDados := []string{
		"João da Silva, Sítio Boa Vista, 12 hectares, Talhão da Frente",
		"me chamo Maria e tenho a Chacara Recanto com 3 ha no lote velho",
	}
	for _, s := range comDados {
		if !pareceConterDados(s) {
			t.Errorf("%q deveria disparar extração", s)
		}
	}
}

func TestPrimeiroNome(t *testing.T) {
	if got := primeiroNome("João da Silva"); got != "João" {
		t.Errorf("primeiroNome = %q, queria \"João\"", got)
	}
	if got := primeiroNome("  Maria  "); got != "Maria" {
		t.Errorf("primeiroNome = %q, queria \"Maria\"", got)
	}
}
