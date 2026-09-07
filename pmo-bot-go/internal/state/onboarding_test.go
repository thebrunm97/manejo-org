package state

import "testing"

// Progressive profiling (DT-58, Fatia 2): só o nome é obrigatório para
// create_basic_profile. Propriedade/área/talhão ficam para a complementação
// futura e não bloqueiam o cadastro inicial.
func TestCadastroSoExigeNome(t *testing.T) {
	soNome := DadosCadastro{Nome: "João da Silva"}
	if !soNome.completo() {
		t.Fatalf("cadastro só com nome deveria estar completo, faltantes=%v", soNome.faltantes())
	}

	completo := DadosCadastro{Nome: "João da Silva", PropriedadeNome: "Sítio Boa Vista", AreaHa: 12, TalhaoNome: "Talhão da Frente"}
	if !completo.completo() {
		t.Fatalf("cadastro com todos os campos deveria estar completo, faltantes=%v", completo.faltantes())
	}

	semNome := DadosCadastro{PropriedadeNome: "Sítio", AreaHa: 1, TalhaoNome: "T1"}
	if semNome.completo() {
		t.Error("cadastro sem nome nunca pode estar completo, mesmo com os demais campos")
	}
	if len(semNome.faltantes()) != 1 {
		t.Errorf("deveria faltar exatamente o nome, faltaram %d: %v", len(semNome.faltantes()), semNome.faltantes())
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

	semNome := DadosCadastro{PropriedadeNome: "Sítio"} // falta o único campo obrigatório
	if _, ok := dadosDoContexto(contextoDosDados(semNome)); ok {
		t.Error("dados sem nome no contexto não podem ser tratados como confirmáveis")
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

// ── Novos testes — fast-path e escape hatch (incidente 6/9) ──────────────────

// TestPareceNomeProprio_Aceita cobre os três casos do incidente mais nomes
// comuns de origens diversas. Todos devem passar pelo fast-path sem LLM.
func TestPareceNomeProprio_Aceita(t *testing.T) {
	aceitar := []string{
		// exatamente os três do incidente de produção
		"Ahmed Mesalam",
		"AhmedMesalam",
		"Ahmed ahmed mesalam",
		// outros casos que devem funcionar
		"José da Silva",
		"Maria D'Ávila",
		"Jean-Pierre Dubois",
		"Beatriz",
		"Ana Lúcia",
		"Muhamad Al-Rashid",
	}
	for _, s := range aceitar {
		if !pareceNomeProprio(s) {
			t.Errorf("pareceNomeProprio(%q) = false, queria true", s)
		}
	}
}

// TestPareceNomeProprio_Rejeita garante que saudações, confirmações, negações,
// perguntas, frases com dígitos ou com mais de 5 palavras não viram nomes.
func TestPareceNomeProprio_Rejeita(t *testing.T) {
	rejeitar := []string{
		// saudações
		"oi", "Bom dia", "boa tarde", "hello", "hi",
		// confirmações e negações
		"sim", "não", "nao", "ok",
		// perguntas e outros
		"quanto custa?", "tenho 3 talhões", "Sítio Boa Vista, 12 ha",
		"quero ajuda", "como funciona",
		// string vazia e espaço
		"", "   ",
		// mais de 5 palavras
		"meu nome é João da Silva Pereira Neto",
		// com dígito
		"João 2",
	}
	for _, s := range rejeitar {
		if pareceNomeProprio(s) {
			t.Errorf("pareceNomeProprio(%q) = true, queria false", s)
		}
	}
}

// TestTentativasDoContexto_IdaEVolta garante que o contador sobrevive à
// serialização JSON da FSM (os numbers voltam como float64 do JSON).
func TestTentativasDoContexto_IdaEVolta(t *testing.T) {
	for _, n := range []int{0, 1, 2, 5} {
		ctx := contextoDeTentativas(n)
		got := tentativasDoContexto(ctx)
		if got != n {
			t.Errorf("tentativas=%d, guardou=%d na ida e volta", n, got)
		}
	}
}

// TestTentativasDoContexto_AusenteEhZero: contexto ausente ou nil não pode
// disparar o escape hatch por acidente.
func TestTentativasDoContexto_AusenteEhZero(t *testing.T) {
	if got := tentativasDoContexto(nil); got != 0 {
		t.Errorf("tentativasDoContexto(nil) = %d, queria 0", got)
	}
	if got := tentativasDoContexto(map[string]interface{}{}); got != 0 {
		t.Errorf("tentativasDoContexto({}) = %d, queria 0", got)
	}
}

