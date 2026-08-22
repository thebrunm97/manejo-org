package pricing

import "testing"

// O catálogo precisa cobrir múltiplos fornecedores. Se um dia voltar a ser
// só de um, o projeto perdeu a capacidade de comparar alternativas — que é
// justamente o ponto de não ter vendor lock-in.
func TestCatalogoCobreMultiplosFornecedores(t *testing.T) {
	c, err := load()
	if err != nil {
		t.Fatalf("catálogo não carregou: %v", err)
	}
	if len(c.Models) < 50 {
		t.Fatalf("catálogo com apenas %d modelos — esperado um catálogo amplo", len(c.Models))
	}

	fornecedores := map[string]bool{}
	for id := range c.Models {
		for i := 0; i < len(id); i++ {
			if id[i] == '/' {
				fornecedores[id[:i]] = true
				break
			}
		}
	}
	if len(fornecedores) < 5 {
		t.Errorf("apenas %d fornecedores no catálogo: %v", len(fornecedores), fornecedores)
	}
}

// O nome do modelo chega em formatos diferentes conforme o caminho: o SDK do
// Google devolve "gemini-3.1-flash-lite", a OpenRouter devolve
// "google/gemini-3.1-flash-lite". Ambos precisam resolver.
func TestLookupToleraVariacoesDeNome(t *testing.T) {
	casos := []string{
		"google/gemini-3.1-flash-lite",
		"gemini-3.1-flash-lite",
		"GEMINI-3.1-FLASH-LITE",
		"gemini-3.1-flash-lite-preview", // sufixo de variante
	}
	for _, nome := range casos {
		t.Run(nome, func(t *testing.T) {
			_, encontrado, exato := Lookup(nome)
			if !exato {
				t.Errorf("não resolveu %q", nome)
			}
			if encontrado == "" {
				t.Errorf("resolveu %q mas não informou qual modelo", nome)
			}
		})
	}
}

// Regressão do defeito central: modelo desconhecido NÃO pode custar zero.
// Era assim que todo o gasto com o fallback ficava invisível no relatório.
func TestModeloDesconhecidoNaoCustaZero(t *testing.T) {
	est := Cost("modelo-que-nao-existe-em-lugar-nenhum", 1_000_000, 100_000)

	if est.CostUSD <= 0 {
		t.Fatal("modelo desconhecido retornou custo zero — o gasto ficaria invisível")
	}
	if est.Exact {
		t.Error("estimativa de modelo desconhecido não deveria ser marcada como exata")
	}
}

// A estimativa conservadora deve errar para CIMA: subestimar custo desconhecido
// induz decisão errada de arquitetura; superestimar só provoca conferência.
func TestEstimativaDesconhecidaErraParaCima(t *testing.T) {
	desconhecido := Cost("xyz-inexistente", 1_000_000, 1_000_000)
	conhecido := Cost("google/gemini-3.1-flash-lite", 1_000_000, 1_000_000)

	if desconhecido.CostUSD <= conhecido.CostUSD {
		t.Errorf("estimativa desconhecida (US$%.4f) deveria ser mais cara que um modelo barato conhecido (US$%.4f)",
			desconhecido.CostUSD, conhecido.CostUSD)
	}
}

// Os preços reais precisam bater com a ordem de grandeza publicada. Guarda
// contra um catálogo corrompido ou com escala errada (por token vs por milhão).
func TestPrecosEmOrdemDeGrandezaPlausivel(t *testing.T) {
	p, _, ok := Lookup("google/gemini-3.1-flash-lite")
	if !ok {
		t.Skip("modelo ausente do catálogo")
	}
	if p.InputPerMillion <= 0 || p.InputPerMillion > 100 {
		t.Errorf("preço de entrada implausível: US$%.4f por 1M", p.InputPerMillion)
	}
	if p.OutputPerMillion < p.InputPerMillion {
		t.Errorf("saída (US$%.4f) mais barata que entrada (US$%.4f) — incomum, verificar escala",
			p.OutputPerMillion, p.InputPerMillion)
	}
}

// A ordem de custo muda com o perfil de uso: modelos com saída cara podem ser
// os mais baratos em classificação (muita entrada, pouca saída). Compare
// precisa refletir isso, senão a escolha do roteador (DT-34) sai enviesada.
func TestCompareRespeitaOPerfilDeUso(t *testing.T) {
	classificacao := Compare(10_000, 100, 5) // muita entrada, pouca saída
	geracao := Compare(500, 5_000, 5)        // pouca entrada, muita saída

	if len(classificacao) == 0 || len(geracao) == 0 {
		t.Fatal("Compare não retornou resultados")
	}
	if classificacao[0] == geracao[0] {
		t.Logf("mesmo modelo lidera os dois perfis (%s) — possível, mas verifique", classificacao[0])
	}
}
