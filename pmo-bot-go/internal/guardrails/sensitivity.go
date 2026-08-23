package guardrails

// sensitivity.go — classificação de sensibilidade do texto que será falado.
//
// POR QUE ISTO EXISTE
//
// O roteador de TTS (internal/tts/router.go) já tem a regra certa: uma
// requisição marcada como sensível NUNCA pode ser roteada para um provedor
// externo — falha antes de vazar, mesmo que a nuvem esteja disponível e o
// Piper não. O problema é que `SynthesisRequest.Sensitive` estava fixo em
// `false` nos dois únicos pontos que constroem a requisição, com um comentário
// admitindo que deveria ser sobrescrito e nenhum handler que o sobrescrevesse.
//
// O mecanismo existia; faltava a entrada. Enquanto ninguém alimentasse esse
// campo, o dia em que um provedor de nuvem fosse plugado no roteador seria o
// dia em que 100% das respostas — balanço financeiro, nome de propriedade e
// talhão, localização — passariam a sair para um terceiro.
//
// COMO CLASSIFICA
//
// Duas camadas, ambas sobre o texto JÁ SANITIZADO para fala:
//
//  1. Identificadores diretos, reaproveitando as regex do PIIScrubber
//     (CPF, CNPJ, telefone, e-mail). Se sobrou identificador no texto que
//     seria falado, é sensível.
//  2. Contexto econômico e territorial do produtor, por vocabulário. Não é
//     PII no sentido estrito, mas é exatamente o que o DT-42 catalogou como
//     dado que não deve sair: valores, vendas, despesas, nomes de talhão e
//     propriedade, coordenadas.
//
// POR QUE VOCABULÁRIO E NÃO LLM
//
// Classificar com LLM colocaria uma chamada de rede no caminho de uma decisão
// de privacidade — se ela falhar ou estourar o prazo, é preciso escolher entre
// travar a entrega e falhar para o lado inseguro. Uma lista de termos é
// grosseira, mas é determinística, custa microssegundos e falha para o lado
// seguro por construção: na dúvida, marca como sensível e o áudio é gerado
// localmente, que é o comportamento de hoje. O custo de um falso positivo é
// uma síntese local a mais; o de um falso negativo é vazamento.

import "strings"

// termosSensiveis são marcadores de conteúdo econômico ou territorial do
// produtor. Minúsculas — a comparação é feita sobre o texto normalizado.
//
// Deliberadamente inclui termos comuns: o erro barato é classificar demais.
var termosSensiveis = []string{
	// Econômico
	"r$", "reais", "faturamento", "receita", "despesa", "custo", "lucro",
	"prejuízo", "prejuizo", "saldo", "balanço", "balanco", "venda", "vendi",
	"vendeu", "comprei", "comprou", "paguei", "pagou", "recebi", "recebeu",
	"preço", "preco", "valor", "nota fiscal", "cota", "dívida", "divida",
	"empréstimo", "emprestimo", "financiamento",

	// Territorial e identificador de propriedade
	"talhão", "talhao", "canteiro", "propriedade", "fazenda", "sítio",
	"sitio", "chácara", "chacara", "matrícula", "matricula", "car ",
	"latitude", "longitude", "coordenada",

	// Documentos e cadastro
	"cpf", "cnpj", "rg ", "inscrição estadual", "inscricao estadual",
	"certificado", "certificadora", "auditoria",
}

// IsSpeechSensitive informa se o texto que será falado contém dado que não
// deve sair para um provedor de TTS de terceiros.
//
// Recebe o texto JÁ sanitizado para fala (utils.SanitizeForSpeech), porque é
// exatamente esse o texto que seria enviado ao provedor — classificar o texto
// original mediria a coisa errada.
func IsSpeechSensitive(spoken string) bool {
	if strings.TrimSpace(spoken) == "" {
		return false
	}

	// Camada 1: identificadores diretos, reaproveitando as regex já existentes.
	if HasPII(spoken) {
		return true
	}

	// Camada 2: vocabulário econômico e territorial.
	lower := strings.ToLower(spoken)
	for _, termo := range termosSensiveis {
		if strings.Contains(lower, termo) {
			return true
		}
	}

	return false
}

// ClassifySpeechSensitivity devolve a decisão e o motivo, para telemetria e
// para depuração de falso positivo.
//
// O motivo importa: sem ele, uma síntese que caiu no Piper por classificação
// é indistinguível de uma que caiu por indisponibilidade da nuvem, e as duas
// pedem ações opostas.
func ClassifySpeechSensitivity(spoken string) (sensitive bool, reason string) {
	if strings.TrimSpace(spoken) == "" {
		return false, "vazio"
	}

	if HasPII(spoken) {
		return true, "identificador_direto"
	}

	lower := strings.ToLower(spoken)
	for _, termo := range termosSensiveis {
		if strings.Contains(lower, termo) {
			return true, "termo:" + strings.TrimSpace(termo)
		}
	}

	return false, "nao_sensivel"
}
