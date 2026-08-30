# Plano de Implementação: Roteamento Híbrido Resiliente (Opção A+)

> **Status:** Fase de Planeamento (Plan)
> **Autor:** Arquiteto de Software Sênior & SRE
> **Objetivo:** Estabelecer uma arquitetura multi-agente resiliente em 3 camadas defensivas para o PMO Bot, focando em tolerância a falhas, intents mistas e latência ultrabaixa.

---

## 1. Contrato do LLM Fast Router

A segunda camada de defesa (após o Pré-Router) é o **LLM Fast Router**. Ele utiliza um modelo de inferência rápida (ex: Gemini Flash) com output JSON estrito, focado exclusivamente na classificação probabilística da intenção do produtor rural.

### System Prompt (Velocidade & Precisão)

```markdown
Você é um Roteador de Intenções de ultra-alta velocidade para um bot agrícola.
Seu ÚNICO objetivo é classificar a mensagem do usuário e extrair os metadados de roteamento.

Regras de Classificação:
- AGRONOMY: Dúvidas técnicas sobre agricultura orgânica, pragas, adubação (IN 46).
- DATABASE: Operações de registro, inserção ou leitura de dados da fazenda (talhões, colheitas).
- CHAT: Conversa genérica, saudações ou assuntos fora de escopo.
- CLARIFICATION: Se a mensagem for ininteligível ou ambígua.

Responda EXCLUSIVAMENTE em um JSON estrito seguindo este schema:
{
  "primary_intent": "AGRONOMY|DATABASE|CHAT|CLARIFICATION",
  "secondary_intent": "AGRONOMY|DATABASE|CHAT|CLARIFICATION|null",
  "confidence": 0.0 a 1.0,
  "needs_write": true/false (true se o usuário quer SALVAR, REGISTRAR ou CRIAR algo),
  "is_mixed": true/false (true se a mensagem contiver múltiplas intenções distintas)
}
```

### Schema Estrito em Go

```go
package gemini

// Intent representa as intenções suportadas pelo sistema.
type Intent string

const (
	IntentAgronomy      Intent = "AGRONOMY"
	IntentDatabase      Intent = "DATABASE"
	IntentChat          Intent = "CHAT"
	IntentClarification Intent = "CLARIFICATION"
)

// RouterResult mapeia estritamente o retorno JSON do LLM Fast Router.
type RouterResult struct {
	PrimaryIntent   Intent  `json:"primary_intent"`
	SecondaryIntent *Intent `json:"secondary_intent"` // Pode ser null
	Confidence      float64 `json:"confidence"`       // De 0.0 a 1.0
	NeedsWrite      bool    `json:"needs_write"`      // Flag para injeção de tools de mutação
	IsMixed         bool    `json:"is_mixed"`         // Flag de alerta para mensagens híbridas
}
```

---

## 2. Lógica de Fallback & Confiança (Resiliência)

Para garantir a confiabilidade (SRE approach), não podemos confiar cegamente na resposta do Roteador. Se a confiança (`confidence`) for baixa, o sistema deve acionar mecanismos de mitigação (graceful degradation) em vez de invocar uma ferramenta destrutiva no banco de dados.

### Implementação em Go (Rascunho)

```go
package orquestrador

import (
	"log"
)

const ThresholdHighConfidence = 0.85
const ThresholdLowConfidence = 0.60

// RouteMessage processa o resultado do Roteador e decide o caminho seguro.
func RouteMessage(result RouterResult, userMessage string) (Agent, error) {
	// 1. Fallback Crítico: Baixa confiança
	if result.Confidence < ThresholdLowConfidence {
		log.Printf("[SRE-WARN] Confiança muito baixa (%.2f). Fallback para Agente de Clarificação.", result.Confidence)
		return NewClarificationAgent("Não tenho certeza do que você deseja fazer. Pode reformular?"), nil
	}

	// 2. Intents Mistas com Confiança Média
	if result.IsMixed && result.Confidence < ThresholdHighConfidence {
		log.Printf("[SRE-INFO] Intent Mista detectada com média confiança (%.2f). Escalando para Especialista Geral.", result.Confidence)
		return NewGeneralistAgent(), nil // Agente com acesso a ferramentas de leitura mistas
	}

	// 3. Segurança de Escrita (Write Protection)
	if result.NeedsWrite && result.PrimaryIntent != IntentDatabase && result.SecondaryIntent != nil && *result.SecondaryIntent != IntentDatabase {
		// Conflito estrutural: Quer escrever, mas nenhuma das intenções é de banco de dados.
		log.Printf("[SRE-ALERT] Alucinação do router detectada: NeedsWrite=true sem IntentDatabase.")
		return NewClarificationAgent("Notei que você quer registrar algo, mas não entendi exatamente o quê. Pode detalhar?"), nil
	}

	// 4. Caminho Feliz (Roteamento para o Especialista)
	return NewSpecialistAgent(result.PrimaryIntent, result.NeedsWrite), nil
}
```

---

## 3. Pré-Router (Regras Determinísticas de Latência Zero)

A primeira camada defensiva não requer IA. Ela utiliza regras estritas (Regex/Prefixos) para mensagens óbvias, poupando tokens e reduzindo a latência para 0ms no roteamento.

### Interface Go (PreRouter)

```go
package orquestrador

import (
	"regexp"
	"strings"
)

// PreRouter define o contrato para avaliadores de regra de latência zero.
type PreRouter interface {
	// Evaluate retorna um RouterResult pré-construído e um booleano indicando se houve match.
	Evaluate(message string) (RouterResult, bool)
}

// RegexPreRouter é uma implementação concreta focada em comandos explícitos.
type RegexPreRouter struct{}

func (r *RegexPreRouter) Evaluate(message string) (RouterResult, bool) {
	msgLower := strings.ToLower(strings.TrimSpace(message))

	// Match: Comandos diretos de banco de dados
	if strings.HasPrefix(msgLower, "/registrar") || strings.HasPrefix(msgLower, "/novo") {
		return RouterResult{
			PrimaryIntent: IntentDatabase,
			Confidence:    1.0,  // Certeza absoluta (rule-based)
			NeedsWrite:    true, // Comandos como "/registrar" implicam escrita
			IsMixed:       false,
		}, true
	}

	// Match: Saudações óbvias
	greetRegex := regexp.MustCompile(`^(olá|ola|bom dia|boa tarde|boa noite|tudo bem)\??$`)
	if greetRegex.MatchString(msgLower) {
		return RouterResult{
			PrimaryIntent: IntentChat,
			Confidence:    1.0,
			NeedsWrite:    false,
			IsMixed:       false,
		}, true
	}

	return RouterResult{}, false // Passa a bola para o LLM Fast Router
}
```

---

## 4. Orquestração e Mesclagem de Ferramentas (Dynamic Specialists)

Ao invés de carregar o agente com ferramentas estáticas baseadas apenas na `PrimaryIntent`, o Orquestrador monta o arsenal de ferramentas "On-the-Fly" (em tempo real) avaliando os atributos `NeedsWrite` e `SecondaryIntent`.

### Regras de Mesclagem de Ferramentas

| Cenário do Roteador | Arsenal de Ferramentas Injetadas | Motivação (SRE) |
| :--- | :--- | :--- |
| `Primary: AGRONOMY`, `NeedsWrite: false` | `[consultar_base_conhecimento]` | Princípio do Menor Privilégio. Evita que o agrônomo invente registros. |
| `Primary: DATABASE`, `NeedsWrite: false` | `[consultar_dados_fazenda]` | Apenas leitura. Bloqueia ferramentas de mutação se o usuário só pediu um relatório. |
| `Primary: DATABASE`, `NeedsWrite: true` | `[todas_as_tools_de_escrita]` | Permissão total para CRUD baseada em intenção confirmada de gravação. |
| `Primary: AGRONOMY`, `IsMixed: true`, `NeedsWrite: true` | `[consultar_base_conhecimento, tools_de_escrita_seguras]` | Híbrido: Permite ao agente responder à dúvida técnica E engatilhar a criação de um registro na mesma resposta. |

### Lógica de Construção do Toolset (Go)

```go
func BuildToolset(result RouterResult, allTools []mcp.Tool) []mcp.Tool {
	var activeTools []mcp.Tool

	for _, tool := range allTools {
		// 1. Tool de RAG
		if tool.Category == "RAG" && (result.PrimaryIntent == IntentAgronomy || (result.SecondaryIntent != nil && *result.SecondaryIntent == IntentAgronomy)) {
			activeTools = append(activeTools, tool)
		}

		// 2. Tools de Leitura de Dados (Sempre seguras se intent for Database)
		if tool.Category == "DB_READ" && (result.PrimaryIntent == IntentDatabase || result.IsMixed) {
			activeTools = append(activeTools, tool)
		}

		// 3. Tools de Mutação (Apenas se NeedsWrite for true)
		if tool.Category == "DB_WRITE" && result.NeedsWrite {
			activeTools = append(activeTools, tool)
		}
	}

	return activeTools
}
```

---

## 🔒 Princípios SRE Aplicados

1. **Graceful Degradation:** Na ausência de alta confiança (`Confidence < 0.60`), o sistema degrada graciosamente para o *Clarification Agent*, evitando ações destrutivas ou alucinações técnicas que poderiam comprometer as certificações orgânicas do produtor.
2. **Defense in Depth (Defesa em Profundidade):** Não confiamos apenas no System Prompt do Especialista. Limitamos o escopo de atuação dele retirando ferramentas mutáveis (Princípio do Menor Privilégio) via a engine de roteamento dinâmico.
3. **Latência Otimizada:** O `RegexPreRouter` processará ~15% das mensagens triviais e atalhos de power-users sem tocar na API do LLM, cortando custos e garantindo tempo de resposta sub-milissegundo para estes casos.
