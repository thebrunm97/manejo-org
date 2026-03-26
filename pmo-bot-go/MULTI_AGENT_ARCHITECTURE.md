# MULTI_AGENT_ARCHITECTURE.md
# Plano de Refatoração: Single-Agent → Hierarchical Multi-Agent (MCP)

> **Status:** Aguardando aprovação antes da implementação.
> **Data:** 2026-03-26
> **Arquitetura alvo:** Summoner/Orchestrator + Familiars/Specialists (Google Cloud pattern)

---

## Diagnóstico do Sistema Atual

### Problemas Identificados

| Componente | Problema Atual |
|---|---|
| `client.go` | `GenerateContentWithTools` injeta **todos os 11 tools** em **toda chamada**, inflando tokens inutilmente |
| `mcp/tools.go` | `InitializeTools()` é monolítico — registra tudo em um único `map[string]Tool` sem categorias |
| `state/fsm.go` | Roteamento de intenção feito por um `if/else` de 300+ linhas acoplado ao estado do chat |
| `prompts/system_prompt.md` | Um único prompt tenta ser agrônomo + engenheiro + gerenciador de DB ao mesmo tempo |
| Tool Loop | O loop atual (`for i := 0; i < 5; i++`) não tem mecanismo de detecção de loop idêntico |

### Fluxo Atual (Problemático)

```
WhatsApp → FSM → Groq (NER) → if/else intent → Gemini + ALL 11 TOOLS → resposta
```

### Fluxo Alvo

```
WhatsApp → FSM → Router LLM (ultra-leve) → Intent{RAG|DB|CHAT}
                                             ↓
                              Specialist Agent + Tools Filtradas + Prompt Modular
```

---

## Fase 1: O Roteador (Orquestrador Leve)

### Objetivo
Substituir o `if/else` de intenção no `fsm.go` por uma chamada LLM rápida e determinística que classifica a intenção com `responseMimeType: "application/json"`.

### Implementação em Go

**Novo arquivo:** `internal/gemini/router.go`

```go
package gemini

import (
    "context"
    "encoding/json"
    "fmt"

    "github.com/google/generative-ai-go/genai"
)

// Intent representa a intenção classificada pelo Roteador.
type Intent string

const (
    IntentRAG      Intent = "RAG"      // Dúvidas técnicas → consultar_base_conhecimento
    IntentDatabase Intent = "DATABASE" // CRUD da fazenda → criar_talhao, registrar_colheita, etc.
    IntentChat     Intent = "CHAT"     // Saudações, contexto geral, sem ferramentas
)

// RouterResult é o JSON estruturado retornado pelo Roteador.
type RouterResult struct {
    Intent     Intent `json:"intent"`
    Confidence float64 `json:"confidence"` // 0.0 a 1.0
    Reasoning  string  `json:"reasoning"`  // Raciocínio interno (debug)
}

// routerSystemPrompt é o prompt ultra-focado do Roteador.
// Não tem acesso a ferramentas. Apenas classifica.
const routerSystemPrompt = `Você é um roteador de intenções. Classifique a mensagem do usuário em exatamente um dos três intents abaixo.

Responda APENAS em JSON válido com o schema: {"intent": "...", "confidence": 0.0, "reasoning": "..."}.

Intents disponíveis:
- "RAG": O usuário tem uma dúvida técnica sobre agricultura orgânica, normas (IN 46, Lei 10.831), pragas, adubação, certificação. NÃO envolve criar ou registrar dados.
- "DATABASE": O usuário quer registrar, criar, consultar ou modificar dados da fazenda: talhões, canteiros, colheitas, vendas, insumos, compostagem, limpeza, propagação vegetal.
- "CHAT": Saudação, agradecimento, conversa genérica, ou mensagem fora do domínio agro.`

// ClassifyIntent faz uma chamada LLM leve para classificar a intenção.
// Usa temperatura 0 e forçado para JSON — sem ferramentas, sem histórico.
func (c *Client) ClassifyIntent(ctx context.Context, userMessage string) (RouterResult, error) {
    model := c.client.GenerativeModel(c.Config.Model)
    model.SystemInstruction = &genai.Content{
        Parts: []genai.Part{genai.Text(routerSystemPrompt)},
    }
    model.SetTemperature(0)
    model.ResponseMIMEType = "application/json"

    resp, err := model.GenerateContent(ctx, genai.Text(userMessage))
    if err != nil {
        return RouterResult{Intent: IntentChat}, fmt.Errorf("router llm error: %w", err)
    }

    if len(resp.Candidates) == 0 || len(resp.Candidates[0].Content.Parts) == 0 {
        return RouterResult{Intent: IntentChat}, fmt.Errorf("router: empty response")
    }

    rawJSON, ok := resp.Candidates[0].Content.Parts[0].(genai.Text)
    if !ok {
        return RouterResult{Intent: IntentChat}, fmt.Errorf("router: non-text response")
    }

    var result RouterResult
    if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
        // Fallback seguro: não deixa o sistema quebrar
        return RouterResult{Intent: IntentRAG, Confidence: 0.5}, nil
    }

    return result, nil
}
```

### Integração no `fsm.go`

Substituir o bloco `if extracted.Intencao == "duvida" || extracted.Intencao == "configurar_infraestrutura"` por:

```go
// Antes de chamar Gemini, classificar intent via Roteador
routerCtx, routerCancel := context.WithTimeout(ctx, 5*time.Second)
defer routerCancel()

routedIntent, _ := gemClient.ClassifyIntent(routerCtx, body)
log.Printf("🧭 [ROUTER] Intent classificada: %s (confidence: %.2f)", routedIntent.Intent, routedIntent.Confidence)

// Despachar para o Especialista correto
tools := mcpServer.GetToolsForIntent(routedIntent.Intent)
prompt := gemClient.GetPromptForIntent(routedIntent.Intent)
```

---

## Fase 2: Prompts Modulares

### Objetivo
Dividir o monolítico `internal/gemini/prompts/system_prompt.md` em três arquivos especializados, cada um com um "papel" bem definido.

### Estrutura de Arquivos

```
internal/gemini/prompts/
├── system_prompt.md      [MANTER — fallback geral]
├── router.md             [NOVO — prompt do Roteador (embutido em router.go)]
├── agronomist.md         [NOVO — especialista em RAG / dúvidas orgânicas]
└── db_operator.md        [NOVO — especialista em CRUD / infraestrutura]
```

### `agronomist.md` — Familiar: Consultor Orgânico

**Responsabilidade exclusiva:** Responder dúvidas técnicas usando `consultar_base_conhecimento` e conhecimento do modelo.

```markdown
Você é o Consultor Orgânico Especialista do ManejoORG.
Seu ÚNICO papel é responder dúvidas técnicas sobre agricultura orgânica.

## FERRAMENTAS DISPONÍVEIS
- `consultar_base_conhecimento`: Use SEMPRE antes de responder qualquer dúvida técnica.

## REGRAS
1. Baseie-se nas normas da IN 46/2011 e Lei 10.831/2003.
2. NUNCA recomende agrotóxicos ou fertilizantes sintéticos.
3. Se não tiver certeza, consulte a base ANTES de responder.
4. Use linguagem acessível ao produtor rural.
5. NUNCA escreva JSON ou schemas na sua resposta.
```

### `db_operator.md` — Familiar: Operador de Banco de Dados

**Responsabilidade exclusiva:** Executar operações de CRUD na fazenda usando as ferramentas de escrita.

```markdown
Você é o Operador de Registros da Fazenda do ManejoORG.
Seu ÚNICO papel é registrar, criar e consultar dados estruturados da fazenda.

## FERRAMENTAS DISPONÍVEIS (CRUD)
- `criar_infraestrutura_fazenda` — criar talhão + canteiros em um passo
- `criar_talhao` — criar apenas talhão
- `criar_canteiros` — criar canteiros em um talhão existente
- `registrar_colheita` — Form 07
- `registrar_venda` — Form 08
- `registrar_compra_insumo` — Form 06
- `registrar_propagacao_vegetal` — Seção 9
- `adicionar_insumo_pmo` — Seção 8
- `registrar_limpeza` — Form 04
- `registrar_compostagem` — Form 05
- `consultar_dados_fazenda` — leitura de talhões, canteiros, caderno

## REGRAS CRÍTICAS
1. **COMPLETUDE OBRIGATÓRIA:** Nunca execute uma ferramenta de escrita sem ter a quantidade exata.
   - Se faltar quantidade: pergunte antes de chamar qualquer tool.
2. **ANTI-ALUCINAÇÃO:** Nunca invente valores. Pergunte ao usuário.
3. **EXECUÇÃO ÚNICA:** Cada registro deve ser feito apenas uma vez.
4. NUNCA escreva JSON ou código na resposta ao usuário.
5. Confirme ao usuário após cada registro bem-sucedido.
```

### Carregamento Dinâmico em `client.go`

```go
//go:embed prompts/system_prompt.md
var systemPromptDefault string

//go:embed prompts/agronomist.md
var systemPromptAgronomist string

//go:embed prompts/db_operator.md
var systemPromptDBOperator string

// GetPromptForIntent seleciona o prompt correto baseado na intenção classificada.
func GetPromptForIntent(intent Intent) string {
    switch intent {
    case IntentRAG:
        return systemPromptAgronomist
    case IntentDatabase:
        return systemPromptDBOperator
    default:
        return systemPromptDefault
    }
}
```

---

## Fase 3: Injeção Dinâmica de Ferramentas

### Objetivo
Alterar `mcp/server.go` para agrupar tools por categoria e `client.go` para enviar apenas as ferramentas relevantes baseadas no `Intent`, reduzindo o context window e prevenindo chamadas incorretas.

### Agrupamento de Tools em `mcp/tools.go`

Adicionar uma constante de categoria a cada tool:

```go
// ToolCategory define o grupo funcional de uma ferramenta.
type ToolCategory string

const (
    CategoryRAG      ToolCategory = "RAG"      // Ferramentas de leitura/busca
    CategoryDatabase ToolCategory = "DATABASE" // Ferramentas de escrita/CRUD
    CategoryAll      ToolCategory = "ALL"      // Sem filtro (fallback)
)

// Tool atualizado com Category
type Tool struct {
    Name        string                                                 `json:"name"`
    Description string                                                 `json:"description"`
    InputSchema map[string]interface{}                                 `json:"inputSchema"`
    Category    ToolCategory                                           `json:"-"`
    Handler     func(args map[string]interface{}) (interface{}, error) `json:"-"`
}
```

**Mapeamento de categorias para as 11 tools existentes:**

| Tool | Categoria |
|---|---|
| `consultar_base_conhecimento` | `RAG` |
| `consultar_dados_fazenda` | `RAG` |
| `criar_infraestrutura_fazenda` | `DATABASE` |
| `adicionar_insumo_pmo` | `DATABASE` |
| `registrar_propagacao_vegetal` | `DATABASE` |
| `registrar_limpeza` | `DATABASE` |
| `criar_talhao` | `DATABASE` |
| `criar_canteiros` | `DATABASE` |
| `registrar_compostagem` | `DATABASE` |
| `registrar_compra_insumo` | `DATABASE` |
| `registrar_colheita` | `DATABASE` |
| `registrar_venda` | `DATABASE` |

### Novo Método em `mcp/server.go`

```go
// GetToolsForIntent retorna apenas as ferramentas relevantes para o Intent classificado.
// Isso reduz o context window do Gemini e previne chamadas incorretas de ferramentas.
func (s *Server) GetToolsForIntent(intent gemini.Intent) []*genai.Tool {
    var declarations []*genai.FunctionDeclaration

    for _, t := range s.tools {
        // Filtrar por categoria: RAG recebe apenas tools de leitura
        // DATABASE recebe todas as tools de escrita + leitura de dados
        switch intent {
        case gemini.IntentRAG:
            if t.Category != CategoryRAG {
                continue // Bloqueia criar_talhao, registrar_colheita, etc.
            }
        case gemini.IntentDatabase:
            if t.Category == CategoryRAG && t.Name == "consultar_base_conhecimento" {
                continue // Bloqueia RAG puro para o operador de DB
            }
        }
        // ... build declarations (lógica existente de GetToolDeclarations)
        declarations = append(declarations, buildDeclaration(t))
    }

    return []*genai.Tool{{FunctionDeclarations: declarations}}
}
```

### Resultado da Filtragem

| Intent | Tools Enviadas | Tools Bloqueadas |
|---|---|---|
| `RAG` | `consultar_base_conhecimento` | Todos os 10 CRUD tools |
| `DATABASE` | Todos os 10 CRUD tools + `consultar_dados_fazenda` | `consultar_base_conhecimento` |
| `CHAT` | Nenhuma | Todas (resposta direto do modelo) |

---

## Fase 4: Interceptors e Memória Curta

### Objetivo
Implementar middlewares no MCP Server que (a) bloqueiam loops de tool idêntica, (b) injetam notas de sistema `[SISTEMA: ...]` no histórico do `history.Manager` após o sucesso de uma ferramenta, criando uma "memória de contexto" da sessão.

### 4.1 — Middleware de Loop Guard

**Problema:** O loop atual em `fsm.go` (`for i := 0; i < 5; i++`) não detecta quando o Gemini chama a **mesma tool com os mesmos argumentos** repetidamente.

**Solução em `mcp/server.go`:**

```go
// LoopGuard rastreia as chamadas de tools durante uma sessão de resposta.
type LoopGuard struct {
    seen map[string]int // chave: "toolName+argsHash", valor: contador
    maxRepeat int
}

func NewLoopGuard(maxRepeat int) *LoopGuard {
    return &LoopGuard{seen: make(map[string]int), maxRepeat: maxRepeat}
}

// CheckAndRecord verifica se a combinação tool+args já foi vista.
// Retorna true se for SEGURO prosseguir, false se for um loop detectado.
func (lg *LoopGuard) CheckAndRecord(toolName string, args map[string]interface{}) bool {
    key := buildCallKey(toolName, args) // hash estável de toolName + args JSON
    lg.seen[key]++
    return lg.seen[key] <= lg.maxRepeat
}

// CallToolWithGuard é o wrapper de CallTool com proteção de loop.
func (s *Server) CallToolWithGuard(guard *LoopGuard, name string, args map[string]interface{}) (interface{}, error) {
    if !guard.CheckAndRecord(name, args) {
        return nil, fmt.Errorf("[LOOP_GUARD] Tool '%s' foi chamada com args idênticos mais de %d vez(es). Bloqueado para prevenir loop infinito", name, guard.maxRepeat)
    }
    return s.CallTool(name, args)
}
```

**Integração no `fsm.go` — Substituir `mcpServer.CallTool` por:**

```go
// Criar guard por sessão de resposta (vive apenas durante o tool loop)
guard := mcp.NewLoopGuard(2) // máximo 2 chamadas idênticas

// ... dentro do tool loop:
result, err := mcpServer.CallToolWithGuard(guard, tc.Name, tc.Args)
```

### 4.2 — Middleware de Memória Curta (Post-Tool Injection)

**Objetivo:** Após uma tool ser executada com sucesso, injetar uma nota `[SISTEMA: ...]` no histórico do `history.Manager`. Isso garante que chamadas futuras na mesma sessão saibam o que já foi feito, sem depender apenas da memória interna do Gemini.

**Novo método em `history/manager.go`:**

```go
// InjectSystemNote adiciona uma nota de sistema ao histórico do usuário.
// Essas notas têm role "model" mas são formatadas com [SISTEMA: ...]
// para que o Gemini as interprete como fatos do sistema, não como sua própria resposta.
func (m *Manager) InjectSystemNote(from, toolName string, result interface{}) {
    note := fmt.Sprintf("[SISTEMA: Tool '%s' executada com sucesso. Resultado: %v. Não execute esta tool novamente para o mesmo dado nesta sessão.]", toolName, result)
    m.AddMessage(from, "model", note)
}
```

**Integração no `fsm.go` — Após `mcpServer.CallToolWithGuard` ter sucesso:**

```go
result, err := mcpServer.CallToolWithGuard(guard, tc.Name, tc.Args)
if err == nil && historyManager != nil {
    // Injetar nota de memória curta APÓS toda tool bem-sucedida
    historyManager.InjectSystemNote(from, tc.Name, result)
    log.Printf("📝 [MEMORY] Nota de sistema injetada para tool '%s'", tc.Name)
}
```

### 4.3 — Diagrama do Fluxo Completo com os 4 Middlewares

```
                         ┌─────────────────────────────────────┐
                         │            WhatsApp Message          │
                         └──────────────────┬──────────────────┘
                                            │
                         ┌──────────────────▼──────────────────┐
                         │          FSM — Step 0-4              │
                         │  (Auth, Quota, Zero-IA commands)     │
                         └──────────────────┬──────────────────┘
                                            │
                         ┌──────────────────▼──────────────────┐
                         │        🧭 ROUTER (Fase 1)            │
                         │   ClassifyIntent() → Intent JSON     │
                         │   Temp=0, No Tools, No History       │
                         │   ~100-200 tokens                    │
                         └──────┬─────────────┬────────────────┘
                                │             │
               ┌────────────────▼──┐   ┌──────▼─────────────────┐
               │  Intent: RAG      │   │  Intent: DATABASE       │
               │  prompt:          │   │  prompt:                │
               │  agronomist.md    │   │  db_operator.md         │
               │                   │   │                         │
               │  Tools: [1 tool]   │   │  Tools: [10 tools]      │
               │  consultar_base   │   │  criar_, registrar_...  │
               └──────────┬────────┘   └──────┬──────────────────┘
                          │                   │
               ┌──────────▼───────────────────▼──────────────────┐
               │            Gemini Tool Loop (Fase 3+4)           │
               │                                                  │
               │  [Tool Call] → LoopGuard.Check() → CallTool()   │
               │                          ↓ (success)            │
               │              InjectSystemNote() → History        │
               └──────────────────────────────────────────────────┘
```

---

## Ordem de Implementação Recomendada

| Fase | Arquivo(s) Modificado(s) | Risco | Prioridade |
|---|---|---|---|
| **1 — Router** | `internal/gemini/router.go` (NOVO), `internal/state/fsm.go` | Baixo (additive) | 🔴 Alta |
| **2 — Prompts** | `internal/gemini/prompts/agronomist.md` (NOVO), `db_operator.md` (NOVO), `client.go` | Baixo | 🟠 Média |
| **3 — Tool Filter** | `internal/mcp/tools.go`, `internal/mcp/server.go` | Médio | 🟠 Média |
| **4a — LoopGuard** | `internal/mcp/server.go`, `internal/state/fsm.go` | Baixo | 🟡 Média |
| **4b — Memory** | `internal/history/manager.go`, `internal/state/fsm.go` | Baixo | 🟡 Baixa |

---

## Benefícios Esperados

| Métrica | Antes | Depois |
|---|---|---|
| Tokens por chamada dúvida | ~4.000 (11 tools + prompt gordo) | ~800 (1 tool + prompt focado) |
| Tokens por chamada DB | ~4.000 (11 tools + prompt gordo) | ~2.500 (10 tools + prompt focado) |
| Risco de loop infinito | Presente (sem guard) | Eliminado (LoopGuard) |
| Alucinação de tool errada | Alta (tudo disponível) | Reduzida (filtragem por intent) |
| Custo de API Gemini | Baseline | Redução estimada de 60-70% nas dúvidas técnicas |

---

## Notas de Dependência

- A **Fase 1** é pré-requisito para as Fases 2 e 3 (o Intent é o input do filtro).
- A **Fase 4a** pode ser implementada independentemente.
- As fases **NÃO são breaking changes** — o sistema atual continua funcionando durante a migração.
- O `Groq Extract()` existente pode ser **depreciado gradualmente** na medida em que o Router absorve o papel de classificação de intenção (evita dois LLM calls).

---

*Documento gerado pelo Arquiteto de Software Backend Sênior — ManejoORG Multi-Agent Migration.*
*Aguardando aprovação para início da implementação.*
