package domain

// tipo_operacao.go — vocabulário fechado de tipos de operação de campo.
//
// POR QUE ISTO EXISTE
//
// A RPC `rpc_registrar_operacao_campo` valida `tipo_arg` contra um CASE de sete
// valores e, em qualquer outro, faz `RAISE EXCEPTION 'Tipo de operação inválido'`.
// Quatorze dos quinze pontos que chamam essa RPC passam um literal válido,
// escrito à mão no código. Um passava o texto livre que o LLM extraiu.
//
// Custo real medido em produção (2026-08-23): 26 registros perdidos, todos com
// a mesma causa — o LLM devolveu "aplicação de composto orgânico" como
// atividade, a RPC recusou, e o produtor recebeu
// "❌ Erro no Registro: Tipo de operação inválido". Um assistente de produção
// ORGÂNICA recusando aplicação de composto orgânico, que é das operações mais
// básicas do manejo orgânico.
//
// A tradução é determinística de propósito, seguindo o mesmo padrão de
// `ClassifyHITLResponse` (DT-11): normalizar por palavra-chave antes de chamar
// o modelo, em vez de pedir ao LLM que acerte um enum. Um modelo instruído a
// devolver "Manejo" vai devolver "manejo de composto", "Aplicação", "Adubação"
// — variação é o comportamento esperado dele, não um defeito a corrigir com
// mais prompt.
//
// NADA SE PERDE NA TRADUÇÃO: o texto original do produtor continua indo para o
// payload em `metodo_aplicacao`, que é campo livre. O enum recebe o valor que a
// RPC entende; o registro preserva a palavra de quem escreveu.

import (
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// TipoOperacao é o vocabulário aceito por rpc_registrar_operacao_campo.
// Alterar esta lista exige alterar o CASE da RPC junto — os dois formam um
// contrato só, e foi a divergência entre eles que causou as 26 perdas.
type TipoOperacao string

const (
	TipoLimpeza     TipoOperacao = "Limpeza"
	TipoPropagacao  TipoOperacao = "Propagacao"
	TipoPlantio     TipoOperacao = "Plantio"
	TipoManejo      TipoOperacao = "Manejo"
	TipoCompostagem TipoOperacao = "Compostagem"
	TipoColheita    TipoOperacao = "Colheita"
	TipoVenda       TipoOperacao = "Venda"
)

// TiposValidos lista o vocabulário completo, para mensagens de erro e testes.
var TiposValidos = []TipoOperacao{
	TipoLimpeza, TipoPropagacao, TipoPlantio,
	TipoManejo, TipoCompostagem, TipoColheita, TipoVenda,
}

// regraTipo separa VERBOS de SUBSTANTIVOS, e a separacao e o cerne do acerto.
//
// Descoberto por teste: "lavei as caixas de colheita" caia em Colheita, porque
// a palavra "colheita" esta la — descrevendo as CAIXAS, nao a atividade. Quem
// diz o que foi feito e o verbo; o substantivo pode ser contexto incidental.
//
// Por isso a avaliacao tem duas passadas: primeiro TODOS os verbos de todas as
// regras, depois todos os substantivos. Uma lista unica achatada, por mais bem
// ordenada que fosse, nao resolveria — o problema nao e a ordem entre tipos, e
// a diferenca de forca entre classes de palavra.
type regraTipo struct {
	tipo         TipoOperacao
	verbos       []string
	substantivos []string
}

// regras sao avaliadas em ordem DENTRO de cada passada.
//
// A ambiguidade que motivou a separacao Compostagem/Manejo continua valendo:
// "compostagem" (produzir composto) e Compostagem, "aplicacao de composto"
// (usar o composto no talhao) e Manejo. Por isso Compostagem nunca usa o
// prefixo "compost", que casaria com os dois.
var regras = []regraTipo{
	{
		tipo:         TipoCompostagem,
		verbos:       []string{"revolvi", "montei a pilha", "montei uma pilha", "montei pilha"},
		substantivos: []string{"compostagem", "pilha", "leira", "composteira", "revolvimento"},
	},
	{
		tipo:         TipoColheita,
		verbos:       []string{"colhi", "colheu", "colhendo", "colher"},
		substantivos: []string{"colheita"},
	},
	{
		tipo:         TipoVenda,
		verbos:       []string{"vendi", "vendeu", "vendendo", "vender", "comercializei"},
		substantivos: []string{"venda", "comercializac"},
	},
	{
		tipo:         TipoLimpeza,
		verbos:       []string{"lavei", "lavou", "limpei", "higienizei", "sanitizei", "desinfetei"},
		substantivos: []string{"limpeza", "higienizac", "sanitizac", "lavagem", "desinfec", "assepsia"},
	},
	{
		tipo:         TipoPlantio,
		verbos:       []string{"plantei", "plantou", "plantando", "plantar", "semeei", "semear", "transplantei", "transplantar"},
		substantivos: []string{"plantio", "semeadura", "transplante"},
	},
	{
		tipo:         TipoPropagacao,
		verbos:       []string{"enxertei", "estaquei"},
		substantivos: []string{"propagac", "muda", "viveiro", "germinac", "enxert", "estaquia"},
	},
	{
		tipo:   TipoManejo,
		verbos: []string{"apliquei", "aplicac", "aplicar", "aplicando", "adubei", "adubar", "pulverizei", "podei", "capinei", "irriguei"},
		substantivos: []string{
			"manejo", "adubac", "composto", "esterco", "biofertilizante",
			"calcario", "calagem", "insumo", "pulverizac", "poda",
			"capina", "rocada", "irrigac", "controle de praga", "tratamento",
		},
	},
}

// NormalizeTipoOperacao traduz a atividade descrita em texto livre para o
// vocabulário da RPC.
//
// Devolve ok=false quando não reconhece. O chamador NÃO deve chutar um valor
// nesse caso: registro de caderno de campo é prova perante certificadora, e
// arquivar uma venda como manejo é pior do que pedir ao produtor que esclareça.
// Errar em silêncio num registro de conformidade é o modo de falha caro.
func NormalizeTipoOperacao(atividade string) (TipoOperacao, bool) {
	norm := utils.Normalize(atividade)
	if norm == "" {
		return "", false
	}

	// 1. O valor já pode vir correto (os 14 call sites que passam literal).
	//    Comparação normalizada para aceitar "propagação" com acento e
	//    variações de caixa.
	for _, t := range TiposValidos {
		if norm == utils.Normalize(string(t)) {
			return t, true
		}
	}

	// 2. Primeira passada: VERBOS. O que o produtor diz ter feito pesa mais
	//    que os substantivos que ele usa para descrever o objeto da acao.
	for _, r := range regras {
		for _, v := range r.verbos {
			if containsNorm(norm, v) {
				return r.tipo, true
			}
		}
	}

	// 3. Segunda passada: SUBSTANTIVOS, para frases sem verbo explicito
	//    ("limpeza das bandejas", "colheita").
	for _, r := range regras {
		for _, sub := range r.substantivos {
			if containsNorm(norm, sub) {
				return r.tipo, true
			}
		}
	}

	return "", false
}

// containsNorm compara marcador já normalizado contra texto já normalizado.
// O marcador é normalizado aqui para que a lista acima possa ser escrita com
// acento onde for natural ler ("roçada"), sem quebrar a comparação.
func containsNorm(textoNorm, marcador string) bool {
	return marcador != "" && strings.Contains(textoNorm, utils.Normalize(marcador))
}
