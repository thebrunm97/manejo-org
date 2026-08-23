package domain

import "testing"

// O caso que motivou o arquivo. Se este teste falhar, os 26 registros perdidos
// em produção voltam a se perder.
func TestNormalizeTipoOperacao_CasoRealDaProducao(t *testing.T) {
	got, ok := NormalizeTipoOperacao("aplicação de composto orgânico")
	if !ok {
		t.Fatal("nao reconheceu 'aplicação de composto orgânico' — foi exatamente esta string que a RPC recusou 26 vezes")
	}
	if got != TipoManejo {
		t.Errorf("= %q, queria %q: aplicar composto no talhao e Manejo, nao Compostagem", got, TipoManejo)
	}
}

// A ambiguidade central: compostar e Compostagem, aplicar composto e Manejo.
// Um prefixo "compost" casaria com os dois e erraria metade.
func TestNormalizeTipoOperacao_CompostarVersusAplicarComposto(t *testing.T) {
	casos := []struct {
		texto string
		quer  TipoOperacao
	}{
		{"montei uma pilha de compostagem", TipoCompostagem},
		{"revolvi a leira hoje", TipoCompostagem},
		{"compostagem", TipoCompostagem},
		{"apliquei composto na horta", TipoManejo},
		{"aplicação de composto orgânico", TipoManejo},
		{"adubei com esterco curtido", TipoManejo},
	}

	for _, c := range casos {
		t.Run(c.texto, func(t *testing.T) {
			got, ok := NormalizeTipoOperacao(c.texto)
			if !ok {
				t.Fatalf("nao reconheceu %q", c.texto)
			}
			if got != c.quer {
				t.Errorf("= %q, queria %q", got, c.quer)
			}
		})
	}
}

func TestNormalizeTipoOperacao_VocabularioDoProdutor(t *testing.T) {
	casos := []struct {
		texto string
		quer  TipoOperacao
	}{
		{"colhi 20 caixas de tomate", TipoColheita},
		{"colheita", TipoColheita},
		{"vendi 10 caixas na feira", TipoVenda},
		{"venda para o mercado", TipoVenda},
		{"plantei alface no canteiro 3", TipoPlantio},
		{"transplantei as mudas", TipoPlantio},
		{"produzi mudas no viveiro", TipoPropagacao},
		{"limpeza das bandejas", TipoLimpeza},
		{"lavei as caixas de colheita", TipoLimpeza},
		{"pulverizei calda bordalesa", TipoManejo},
		{"fiz capina no talhao 2", TipoManejo},
		{"irriguei a area", TipoManejo},
	}

	for _, c := range casos {
		t.Run(c.texto, func(t *testing.T) {
			got, ok := NormalizeTipoOperacao(c.texto)
			if !ok {
				t.Fatalf("nao reconheceu %q", c.texto)
			}
			if got != c.quer {
				t.Errorf("= %q, queria %q", got, c.quer)
			}
		})
	}
}

// Os 14 call sites que ja passam literal valido precisam continuar passando
// incolumes — a normalizacao nao pode alterar o que ja estava certo.
func TestNormalizeTipoOperacao_LiteraisValidosSaoIdempotentes(t *testing.T) {
	for _, tipo := range TiposValidos {
		got, ok := NormalizeTipoOperacao(string(tipo))
		if !ok || got != tipo {
			t.Errorf("NormalizeTipoOperacao(%q) = (%q, %v), queria (%q, true)", tipo, got, ok, tipo)
		}
	}

	// E com acento e caixa diferente, como o LLM pode devolver.
	for _, variacao := range []struct {
		texto string
		quer  TipoOperacao
	}{
		{"PROPAGAÇÃO", TipoPropagacao},
		{"propagação", TipoPropagacao},
		{"  Manejo  ", TipoManejo},
		{"COLHEITA", TipoColheita},
	} {
		got, ok := NormalizeTipoOperacao(variacao.texto)
		if !ok || got != variacao.quer {
			t.Errorf("NormalizeTipoOperacao(%q) = (%q, %v), queria (%q, true)", variacao.texto, got, ok, variacao.quer)
		}
	}
}

// Nao reconhecer precisa ser explicito, nunca um chute. Arquivar uma venda como
// manejo corromperia registro de conformidade — pedir esclarecimento e melhor.
func TestNormalizeTipoOperacao_DesconhecidoNaoChuta(t *testing.T) {
	desconhecidos := []string{
		"",
		"   ",
		"xpto",
		"conversa sobre o tempo",
	}

	for _, d := range desconhecidos {
		t.Run(d, func(t *testing.T) {
			got, ok := NormalizeTipoOperacao(d)
			if ok {
				t.Errorf("deveria recusar %q, mas devolveu %q", d, got)
			}
			if got != "" {
				t.Errorf("valor devolvido em caso de falha deveria ser vazio, veio %q", got)
			}
		})
	}
}

// Todo tipo produzido pela normalizacao precisa estar no vocabulario que a RPC
// aceita. Se alguem adicionar uma regra apontando para um tipo novo sem alterar
// o CASE da RPC, este teste pega antes da producao — que e exatamente o modo de
// falha que custou os 26 registros.
func TestRegras_SoProduzemTiposQueARPCAceita(t *testing.T) {
	valido := make(map[TipoOperacao]bool, len(TiposValidos))
	for _, t := range TiposValidos {
		valido[t] = true
	}

	for _, r := range regras {
		if !valido[r.tipo] {
			t.Errorf("regra produz %q, que nao esta em TiposValidos (e portanto a RPC recusaria)", r.tipo)
		}
		if len(r.verbos) == 0 && len(r.substantivos) == 0 {
			t.Errorf("regra para %q nao tem verbo nem substantivo", r.tipo)
		}
	}
}
