# RESEARCH: Camada de Structured Output Agnóstica em Go

**Projeto:** `pmo-bot-go` | **Data:** 2026-04-09 | **Status:** Investigação Concluída ✅

---

## Sumário Executivo

Este documento é o entregável da Missão RPI (Research, Planning & Investigation) para implementação de uma camada de Structured Outputs agnóstica em Go — equivalente ao Pydantic do Python. A solução proposta permite definir uma `struct` Go com tags e gerar automaticamente o schema correto para **Google Gemini** e **OpenRouter**, validando a resposta da IA após o `json.Unmarshal`. Nenhum código de produção foi escrito neste documento.

---

## Fase 1 — Investigação da Arquitetura Atual

### 1.1 `internal/llm/types.go` — A Função `MapToGenaiSchema`

**O que ela faz:** Converte recursivamente um `map[string]interface{}` (no formato JSON Schema) em um `*genai.Schema` fortemente tipado, necessário para o SDK do Google.

**Pontos críticos identificados:**

| Aspecto | Comportamento Atual |
|---|---|
| **Entrada** | `map[string]interface{}` (schema manual, feito à mão) |
| **Suporte a tipos** | `string`, `integer`, `number`, `boolean`, `object`, `array`, `enum` |
| **Recursão** | Sim — percorre `properties` e `items` corretamente |
| **Restrições** | `isRoot` força `TypeObject` no topo; adiciona `_unused` placeholder se sem propriedades |
| **`$defs`/`$ref`** | ❌ Não suportado na implementação atual |
| **`anyOf`/`oneOf`** | ❌ Não suportado na implementação atual |

**Gargalo:** O schema é escrito **manualmente** pelo desenvolvedor como `map[string]interface{}`, sem qualquer vínculo com structs Go. Isso cria duplicação entre a struct `UnifiedIntentResult` e o `ResponseSchema` definido em `router.go`.

### 1.2 `internal/gemini/router.go` — `ClassifyIntent` e `UnifiedIntentResult`

**Problema central:** Existe uma **duplicação perigosa** entre:

```go
// Struct Go — fonte de verdade do domínio
type UnifiedIntentResult struct {
    Intent     Intent  `json:"intent"`
    Confidence float64 `json:"confidence"`
    // ... +17 campos adicionais
}
```

```go
// Schema hardcoded no router.go — desynced da struct
ResponseSchema: &genai.Schema{
    Type:     genai.TypeObject,
    Required: []string{"intent", "confidence", "reasoning"},
    Properties: map[string]*genai.Schema{
        "intent":      {Type: genai.TypeString, Enum: []string{...}},
        "confidence":  {Type: genai.TypeNumber},
        // ⚠️ Apenas ~14 dos 20 campos da struct estão aqui
    },
}
```

**Campos ausentes no schema atual:** `houve_descartes`, `qtd_descartes`, `insumo_generico`, `item_area`, `tipo_limpeza`, `produto_utilizado`, e outros. A IA pode omiti-los silenciosamente.

### 1.3 Fluxo de Fallback — OpenRouter via `CallOpenRouter`

O projeto usa a biblioteca `github.com/sashabaranov/go-openai` como cliente HTTP para o OpenRouter. A chamada é feita via `c.OpenAI.CreateChatCompletion(ctx, req)`.

**Limitação atual para Structured Output no OpenRouter:** O método `openai.ChatCompletionRequest` do SDK `go-openai` **não possui o campo `ResponseFormat` com suporte nativo a `json_schema`**. O campo existente é apenas `ResponseFormat openai.ChatCompletionResponseFormat` que aceita `json_object` mas não o envelope completo `json_schema` com `strict: true`.

**Implicação:** Para enviar `response_format` completo ao OpenRouter, o payload precisaria ser injetado via o `openRouterTransport.RoundTrip` (que já faz modificação do body), ou usar uma requisição HTTP direta, similar ao que já é feito para o campo `reasoning`.

---

## Fase 2 — Pesquisa do Ferramental (Go)

### 2.1 `github.com/invopop/jsonschema` — Geração de Schema a partir de Structs

**Veredicto: ✅ Recomendada. Madura (v0.13+), 1.330+ importações no Go ecosystem.**

#### Como funciona

```go
import "github.com/invopop/jsonschema"

type MeuOutput struct {
    Nome  string `json:"nome" jsonschema:"required,description=Nome do usuário"`
    Idade int    `json:"idade" jsonschema:"required,minimum=0,maximum=150"`
    // Campo opcional — usa omitempty:
    Email string `json:"email,omitempty" jsonschema:"format=email"`
    // Enum:
    Status string `json:"status" jsonschema:"enum=ativo,enum=inativo"`
}

// Geração automática do schema:
r := &jsonschema.Reflector{
    RequiredFromJSONSchemaTags: true,  // usa tag `jsonschema:"required"`
    ExpandedStruct:             true,  // não cria $defs separados
    DoNotReference:             true,  // inline todos os tipos
}
schema := r.Reflect(&MeuOutput{})
// schema é *jsonschema.Schema com .Properties, .Required, .Type, etc.
```

#### Tags Suportadas (jsonschema tag)

| Tag | Efeito no Schema |
|---|---|
| `required` | Adiciona campo ao array `required` |
| `description=texto` | Popula `description` |
| `enum=a,enum=b` | Cria array `enum` |
| `minimum=0,maximum=100` | Adiciona validações numéricas |
| `format=date-time` | Adiciona keyword `format` |
| `title=Meu Campo` | Adiciona `title` |
| `default=valor` | Adiciona `default` |
| `oneof_required=grupo` | Cria `oneOf` de grupo |

#### Comportamento com tipos especiais

| Tipo Go | Schema Gerado | Observação |
|---|---|---|
| `string` | `{"type": "string"}` | — |
| `int`, `int64` | `{"type": "integer"}` | — |
| `float64` | `{"type": "number"}` | — |
| `bool` | `{"type": "boolean"}` | — |
| `[]string` | `{"type": "array", "items": {"type": "string"}}` | — |
| `time.Time` | `{"type": "string", "format": "date-time"}` | ⚠️ Ver riscos |
| `*string` | `{"oneOf": [{"type": "string"}, {"type": "null"}]}` | ⚠️ Problemático — ver riscos |
| `interface{}` | `{}` (empty schema) | ⚠️ Muito permissivo |
| `map[string]interface{}` | `{"type": "object"}` | Sem propriedades fixas |

### 2.2 Mapeamento `invopop/jsonschema` → `genai.Schema`

O schema do `invopop` é uma struct Go (`*jsonschema.Schema`) com campos como `.Type`, `.Properties`, `.Items`, `.Enum`, `.Required`. Para converter para `genai.Schema`, usaremos a função `MapToGenaiSchema` já existente como **ponte**, mas adaptada para receber `*jsonschema.Schema` em vez de `map[string]interface{}`.

**Estratégia:** Serializar `*jsonschema.Schema` para JSON (`json.Marshal`), deserializar para `map[string]interface{}`, e passar ao `MapToGenaiSchema` existente. Isso evita reescrever o mapeamento do zero.

```
invopop.Reflector.Reflect(&T{})
    → *jsonschema.Schema
    → json.Marshal → []byte
    → json.Unmarshal → map[string]interface{}
    → MapToGenaiSchema(m, true)
    → *genai.Schema  ✅
```

**Alternativa mais eficiente (Fase 2 do plano):** Converter diretamente de `*jsonschema.Schema` para `*genai.Schema` sem passar por JSON, criando uma função `InvopopToGenai`.

### 2.3 Envelope para OpenRouter — `response_format`

O formato correto que o OpenRouter espera:

```json
{
  "model": "...",
  "messages": [...],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "UnifiedIntentResult",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": { ... },
        "required": [ ... ],
        "additionalProperties": false
      }
    }
  }
}
```

**Como injetar no projeto atual:** O `openRouterTransport.RoundTrip` já lê e reenvia o body. Podemos adicionar o campo `response_format` ao `bodyMap` nesta função, de forma condicional (só quando o schema for passado).

**Alternativa:** Criar um `RequestBuilder` que constrói o `map[string]interface{}` final e faz a chamada HTTP diretamente, sem depender do SDK `go-openai` para essa feature.

### 2.4 `github.com/go-playground/validator/v10` — Validação Pós-Geração

**Veredicto: ✅ Já está no `go.mod` como dependência indireta (injetada pelo gin). Já disponível!**

```go
import "github.com/go-playground/validator/v10"

var validate = validator.New()

// Após receber JSON da IA e dar Unmarshal:
var result UnifiedIntentResult
if err := json.Unmarshal([]byte(rawJSON), &result); err != nil {
    return fallback, err
}

// Validação semântica:
if err := validate.Struct(result); err != nil {
    // err contém campos específicos que falharam
    for _, e := range err.(validator.ValidationErrors) {
        log.Printf("Campo '%s' inválido: %s", e.Field(), e.Tag())
    }
    return fallback, ErrInvalidLLMResponse
}
```

**Tags de validação úteis para nosso caso:**

| Tag | Uso |
|---|---|
| `validate:"required"` | Campo não pode ser zero-value |
| `validate:"oneof=RAG DATABASE CHAT"` | Restringe a valores conhecidos |
| `validate:"gte=0,lte=1"` | Valida confidence entre 0 e 1 |
| `validate:"dive,min=1"` | Valida cada item de um slice |
| `validate:"omitempty,email"` | Valida apenas se não-vazio |

---

## Fase 3 — Riscos e Edge Cases

### 3.1 `time.Time` e Ponteiros

| Risco | Impacto | Mitigação |
|---|---|---|
| `time.Time` → `{"format": "date-time"}` | Gemini **não suporta** o keyword `format` em `genai.Schema` → o campo será silenciosamente ignorado | Usar `string` com `jsonschema:"description=Data em formato YYYY-MM-DD"` nas structs de saída de IA |
| `*string` → `{"oneOf": [string, null]}` | `oneOf` com `null` **não tem suporte em `genai.Schema`** → o mapeamento falhará silenciosamente gerando `TypeString` | Evitar ponteiros nas structs de saída de IA. Usar zero-values (`""`, `0`, `false`) |
| `interface{}` → `{}` (empty schema) | A IA pode retornar qualquer coisa; `validator` não consegue validar | Tipar explicitamente: `Quantidade string` em vez de `Quantidade interface{}` — ⚠️ há campos assim em `UnifiedIntentResult` |

### 3.2 Limitações do Gemini (genai.Schema)

O Gemini suporta apenas um **subconjunto** do JSON Schema Draft 7:

| Keyword JSON Schema | Suporte Gemini | Suporte OpenRouter |
|---|---|---|
| `type` (string, object, etc.) | ✅ | ✅ |
| `properties` | ✅ | ✅ |
| `required` | ✅ | ✅ |
| `enum` | ✅ | ✅ |
| `items` (array) | ✅ | ✅ |
| `description` | ✅ | ✅ |
| `format` (date-time, email, etc.) | ❌ Ignorado | ✅ (parcial) |
| `$ref` / `$defs` | ✅ (Gemini 2.5+) | ✅ |
| `anyOf` / `oneOf` | ✅ (Gemini 2.5+) | ✅ |
| `additionalProperties: false` | ❌ Não suportado | ✅ (necessário para `strict`) |
| `minimum` / `maximum` | ❌ Não suportado | ✅ |
| `minLength` / `maxLength` | ❌ Não suportado | ✅ |
| `nullable` (Gemini específico) | ✅ | N/A |

**Implicação crítica:** O conversor `InvopopToGenai` deve **descartar silenciosamente** keywords não suportados pelo Gemini, em vez de falhar.

### 3.3 Limitações de Profundidade (Nesting)

- **Gemini:** Sem limite documentado, mas schemas complexos (alta profundidade + muitos campos + enums grandes) geram erros `400 InvalidArgument`. A recomendação é manter nesting ≤ 3 níveis e ≤ 30 propriedades por objeto.
- **OpenRouter:** Herda os limites do modelo backend. `strict: true` com `additionalProperties: false` requer que **todo** campo com `additionalProperties` aninhado também tenha `false` — falha silenciosa se esquecido.
- **`UnifiedIntentResult`:** Tem 20+ campos mas apenas aninhamento de 1 nível (`localizacao` com `talhao` e `canteiros`). Score: baixo risco.

### 3.4 `DoNotReference` no Reflector — Crítico para Gemini

O `invopop/jsonschema` por padrão gera schemas com `$defs` e `$ref`:

```json
{
  "$defs": { "Localizacao": { "type": "object", ... } },
  "properties": {
    "localizacao": { "$ref": "#/$defs/Localizacao" }
  }
}
```

O `MapToGenaiSchema` atual **não resolve `$ref`**, o que causaria falha silenciosa. **Solução:** Configurar `ExpandedStruct: true` e `DoNotReference: true` no `Reflector` para garantir schemas inline sem referências.

---

## Comparativo de Payload: Google vs OpenRouter

### Google Gemini (via SDK `google.golang.org/genai`)

```go
// Passado em GenerateContentConfig
config := &genai.GenerateContentConfig{
    ResponseMIMEType: "application/json",
    ResponseSchema: &genai.Schema{
        Type: genai.TypeObject,
        Required: []string{"intent", "confidence"},
        Properties: map[string]*genai.Schema{
            "intent":     {Type: genai.TypeString, Enum: []string{"RAG", "DATABASE", "CHAT"}},
            "confidence": {Type: genai.TypeNumber},
            "localizacao": {
                Type: genai.TypeObject,
                Properties: map[string]*genai.Schema{
                    "talhao":    {Type: genai.TypeString},
                    "canteiros": {Type: genai.TypeArray, Items: &genai.Schema{Type: genai.TypeString}},
                },
            },
        },
    },
}
```

**Características:**
- Schema embutido diretamente no `GenerateContentConfig`
- Tipo `*genai.Schema` — fortemente tipado
- `ResponseMIMEType: "application/json"` é **obrigatório** junto com `ResponseSchema`
- Keywords não suportados causam `400 InvalidArgument` ou são silenciosamente ignorados
- Não usa `additionalProperties`

### OpenRouter (via HTTP body modificado)

```json
{
  "model": "google/gemini-2.5-flash",
  "messages": [...],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "UnifiedIntentResult",
      "strict": true,
      "schema": {
        "type": "object",
        "required": ["intent", "confidence"],
        "additionalProperties": false,
        "properties": {
          "intent": {"type": "string", "enum": ["RAG", "DATABASE", "CHAT"]},
          "confidence": {"type": "number"},
          "localizacao": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "talhao": {"type": "string"},
              "canteiros": {"type": "array", "items": {"type": "string"}}
            }
          }
        }
      }
    }
  }
}
```

**Características:**
- Campo `response_format` no body JSON da requisição
- Schema é JSON puro (representável como `map[string]interface{}` ou `json.RawMessage`)
- `strict: true` é recomendado mas nem todos os modelos suportam
- `additionalProperties: false` é **necessário** para strict em todos os níveis aninhados
- Injetado via `openRouterTransport.RoundTrip` já existente

### Tabela Comparativa Final

| Aspecto | Google Gemini | OpenRouter |
|---|---|---|
| **Formato do Schema** | `*genai.Schema` (tipado) | JSON puro (`map[string]interface{}`) |
| **Onde é enviado** | `GenerateContentConfig.ResponseSchema` | `request_body["response_format"]` |
| **MIME type obrigatório** | `"application/json"` | Não necessário |
| **Strict mode** | Implícito | `"strict": true` explícito |
| **additionalProperties** | Não suportado | Necessário para strict |
| **`$ref` / `$defs`** | Suportado no Gemini 2.5+ | Suportado |
| **Validação de formato** | Não suportado | Parcialmente suportado |

---

## Plano de Implementação — Faseamento

### Estrutura Proposta

```
internal/llm/
├── types.go          (existente — não modificar ainda)
└── schema/           (NOVO PACOTE)
    ├── builder.go    (API pública: FromStruct, ForGoogle, ForOpenRouter)
    ├── converter.go  (lógica interna: invopop → genai.Schema)
    ├── validator.go  (lógica: validar resposta LLM com go-playground/validator)
    └── builder_test.go
```

---

### Fase 0: Preparação (sem quebrar nada) — ≈ 1h

**Objetivo:** Adicionar dependência e estrutura base sem alterar código existente.

1. **Adicionar `invopop/jsonschema` ao `go.mod`:**
   ```bash
   go get github.com/invopop/jsonschema@latest
   ```
   > `go-playground/validator/v10` já está disponível (dependência indireta via gin).

2. **Criar diretório `internal/llm/schema/`** (pacote vazio com `package schema`).

3. **Ponto de verificação:** `go build ./...` deve continuar passando.

---

### Fase 1: `schema.Builder` — Geração do Schema (≈ 3h)

**Arquivo:** `internal/llm/schema/builder.go`

```go
// API pública proposta:
package schema

// Reflector pré-configurado: sem $refs, sem $defs, required via tags
var reflector = &jsonschema.Reflector{
    RequiredFromJSONSchemaTags: true,
    ExpandedStruct:             true,
    DoNotReference:             true,
}

// SchemaOf retorna o schema JSON como map[string]interface{} a partir de qualquer struct.
// Este é o formato intermediário agnóstico.
func SchemaOf(v any) (map[string]interface{}, error)

// ForGoogle converte o schema para *genai.Schema, pronto para ResponseSchema.
// Descarta keywords não suportados pelo Gemini (format, minimum, maximum, etc.).
func ForGoogle(v any) (*genai.Schema, error)

// ForOpenRouter retorna o envelope completo response_format como map[string]interface{}.
// Inclui "name", "strict": true, "additionalProperties": false recursivamente.
func ForOpenRouter(schemaName string, v any) (map[string]interface{}, error)
```

**Arquivo:** `internal/llm/schema/converter.go`

```go
// invopopToGenai converte *jsonschema.Schema para *genai.Schema.
// Implementação interna — não usar diretamente.
func invopopToGenai(s *jsonschema.Schema) *genai.Schema

// addAdditionalProperties adiciona "additionalProperties: false" recursivamente
// em todos os objetos aninhados (necessário para strict mode no OpenRouter).
func addAdditionalProperties(m map[string]interface{})
```

**Ponto de verificação:** Testes unitários em `builder_test.go` cobrindo:
- `UnifiedIntentResult{}` → schema correto (sem `time.Time`, sem ponteiros)
- Schema gerado para Google não contém `format`, `minimum`, `additionalProperties`
- Schema gerado para OpenRouter contém `additionalProperties: false` em todos os níveis

---

### Fase 2: `schema.Validator` — Validação da Resposta (≈ 1h)

**Arquivo:** `internal/llm/schema/validator.go`

```go
var validate = validator.New()

// Decode faz json.Unmarshal + validação estrutural em uma operação atômica.
// Retorna erro descritivo se qualquer campo `validate:"..."` falhar.
func Decode[T any](rawJSON string, dest *T) error
```

**Uso final proposto em `router.go`:**

```go
// ANTES (atual):
var result UnifiedIntentResult
if err := json.Unmarshal([]byte(rawJSON), &result); err != nil { ... }

// DEPOIS:
var result UnifiedIntentResult
if err := schema.Decode(rawJSON, &result); err != nil {
    log.Printf("⚠️ [ROUTER] Resposta da IA inválida: %v", err)
    return fallback, nil
}
```

**Ponto de verificação:** Testes unitários cobrindo:
- JSON válido → sem erro
- JSON com `confidence: 1.5` → erro de validação `lte=1`
- JSON com intent desconhecido → erro de validação `oneof=...`
- JSON com campo `intent` ausente → erro de validação `required`

---

### Fase 3: Refatorar `router.go` — Eliminar Schema Manual (≈ 2h)

**Objetivo:** Substituir o `ResponseSchema` hardcoded pelo schema gerado automaticamente.

**Subtarefas:**

1. **Tipar campos `interface{}` em `UnifiedIntentResult`:**
   - `Quantidade interface{}` → `Quantidade string` (a IA retorna strings)
   - `QtdDescartes interface{}` → `QtdDescartes string`
   - `ValorTotal interface{}` → `ValorTotal string`

2. **Adicionar tags `jsonschema` em `UnifiedIntentResult`:**
   ```go
   type UnifiedIntentResult struct {
       Intent     Intent  `json:"intent" jsonschema:"required,enum=RAG,enum=DATABASE,enum=CHAT,enum=REGISTRO_FINANCEIRO"`
       Confidence float64 `json:"confidence" jsonschema:"required,minimum=0,maximum=1"`
       Reasoning  string  `json:"reasoning" jsonschema:"required"`
       // Campo opcional:
       Intencao   string  `json:"intencao,omitempty" jsonschema:"description=Mapeamento para fluxo legado"`
       // ...
   }
   ```

3. **Adicionar tags `validate` em `UnifiedIntentResult`:**
   ```go
   type UnifiedIntentResult struct {
       Intent     Intent  `json:"intent" validate:"required,oneof=RAG DATABASE CHAT REGISTRO_FINANCEIRO"`
       Confidence float64 `json:"confidence" validate:"gte=0,lte=1"`
       Reasoning  string  `json:"reasoning" validate:"required"`
       // ...
   }
   ```

4. **Substituir `ClassifyIntent` para usar o schema gerado:**
   ```go
   // Gerar schema uma vez (init ou lazy):
   googleSchema, _ := schema.ForGoogle(&UnifiedIntentResult{})
   
   config := &genai.GenerateContentConfig{
       ResponseMIMEType: "application/json",
       ResponseSchema:   googleSchema,  // gerado automaticamente!
       // ...
   }
   ```

5. **Adicionar injeção do `response_format` no `openRouterTransport.RoundTrip`** para as chamadas de classificação (via flag ou campo no bodyMap).

**Ponto de verificação:** Os testes existentes em `router_test.go` e `fallback_simulation_test.go` **devem continuar passando** sem modificação.

---

### Fase 4: Validação de Regressão e Testes de Integração (≈ 1h)

1. **Executar `go test ./...`** — garantir 0 regressões.

2. **Teste de smoke manual:** Enviar mensagem de registro de atividade ao bot e verificar que `UnifiedIntentResult` é populado corretamente com todos os campos.

3. **Teste de robustez:** Forçar resposta sem `intent` e verificar que o fallback é ativado graciosamente.

4. **Documentar** quais campos da `UnifiedIntentResult` estão excluídos do schema e por quê (campos `interface{}` convertidos, etc.).

---

## Checklist de Dependências a Adicionar

```bash
go get github.com/invopop/jsonschema@latest
# go-playground/validator/v10 já está disponível — apenas importar
```

**`go.mod` após:**
```
require (
    github.com/invopop/jsonschema v0.13.0
    // ... resto inalterado
)
```

---

## Decisões de Design — Pontos para Revisão

> ⚠️ **Decisão 1 — `interface{}` vs `string`:**  
> `UnifiedIntentResult` possui `Quantidade interface{}`, `ValorTotal interface{}`, `QtdDescartes interface{}`. Para o schema funcionar, eles **devem** ser tipados. A proposta é convertê-los para `string` (a IA sempre retorna texto). **Confirmar se isso não quebra consumidores downstream.**

> ⚠️ **Decisão 2 — OpenRouter Strict Mode:**  
> `"strict": true` no OpenRouter requer que **todos os campos** estejam no schema com `additionalProperties: false`. Se um modelo backend não suportar, pode falhar com 400. Proposta: usar `"strict": false` por padrão e ativar apenas para modelos explicitamente compatíveis (verificar via `/api/v1/models`).

> ⚠️ **Decisão 3 — Quando gerar o schema:**  
> O schema pode ser gerado 1x no `init()` do pacote (mais eficiente) ou sob demanda a cada requisição (mais fácil de testar). Recomendação: **gerar no `init()` e cachear**, com `sync.Once` para thread safety.

> ⚠️ **Decisão 4 — Escopo da Fase 3:**  
> A refatoração do `router.go` afeta o caminho crítico de cada requisição do bot. Sugestão: fazer em branch separado com feature flag `USE_SCHEMA_BUILDER=true`.

---

## Referências

- [invopop/jsonschema - pkg.go.dev](https://pkg.go.dev/github.com/invopop/jsonschema)
- [go-playground/validator - GitHub](https://github.com/go-playground/validator)
- [OpenRouter Structured Outputs](https://openrouter.ai/docs/api/reference/structured-outputs)
- [Google Gemini Controlled Generation](https://ai.google.dev/gemini-api/docs/structured-output)
- `internal/llm/types.go` — `MapToGenaiSchema` (linha 86-182)
- `internal/gemini/router.go` — `ClassifyIntent` e `UnifiedIntentResult`
- `internal/gemini/client.go` — `CallOpenRouter`, `openRouterTransport`
