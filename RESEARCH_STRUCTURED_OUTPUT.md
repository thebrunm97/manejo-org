# RESEARCH: Camada de Structured Output Agnóstica em Go

**Projeto:** `manejo-org` | **Data:** 2026-04-09 | **Status:** Investigação Concluída ✅

---

## 1. Investigação Arquitetural

### 1.1 `internal/llm/types.go` — O gargalo da `MapToGenaiSchema`
A função `MapToGenaiSchema` é o coração da integração atual com o Google Gemini. 

- **Como funciona hoje:** Ela recebe um `map[string]interface{}` (representação manual de um JSON Schema) e o converte recursivamente para o tipo `*genai.Schema` exigido pelo SDK oficial do Google.
- **Problema:** O schema é definido "na mão" (hardcoded), o que gera duplicação entre as structs Go (como `UnifiedIntentResult`) e a definição do schema. Se a struct mudar, o desenvolvedor precisa lembrar de atualizar o mapa manual, gerando riscos de dessincronização.

### 1.2 `internal/gemini/router.go` — Atração de Intenção
A struct `UnifiedIntentResult` é o modelo de dado primário para a IA. 
- **Observação:** Atualmente, a IA preenche este modelo via Structured Output hardcoded no `router.go`.
- **Extração:** O roteador extrai a intenção (DATABASE, RAG, etc.) e faz o NER (Named Entity Recognition) para atividades agrícolas.
- **Gargalo:** Muitos campos da `UnifiedIntentResult` não estão sendo devidamente mapeados no `ResponseSchema` do Gemini, limitando a capacidade da IA de preencher todos os detalhes técnicos (ex: `houve_descartes`).

---

## 2. Pesquisa de Ferramental (Ecossistema Go)

### 2.1 Geração: `github.com/invopop/jsonschema`
Esta biblioteca é a escolha ideal para o papel do "Pydantic" no ecossistema Go.
- **Capacidade:** Suporta structs complexas, aninhamento, enums e tags personalizadas.
- **Tradução Gemini:** O `jsonschema.Schema` gerado pode ser facilmente convertido para `genai.Schema` através de um mapeamento recursivo de tipos.
- **Tradução OpenRouter:** O mesmo schema pode ser serializado para JSON e enviado no campo `response_format` da API da OpenAI/OpenRouter.

### 2.2 Validação: `github.com/go-playground/validator/v10`
O projeto já possui o `validator` (via dependências do Gin). 
- **Papel:** Após o `json.Unmarshal` da resposta da IA, o `validator` garantirá que as regras de negócio (ex: confiança entre 0 e 1, campos obrigatórios preenchidos) sejam respeitadas estruturalmente.

---

## 3. Comparativo Técnico de Payload

| Recurso | Google Gemini (SDK Go) | OpenRouter (OpenAI Format) |
|---|---|---|
| **Ponto de Injeção** | `genai.GenerateContentConfig.ResponseSchema` | `body["response_format"]` |
| **Tipo de Dado** | `*genai.Schema` (Struct Tipada) | `map[string]interface{}` (JSON Schema) |
| **Modo Estrito** | Nativo (via Schema) | `"strict": true` + `additionalProperties: false` |
| **MIME Type** | `application/json` (Obrigatório) | N/A |

---

## 4. Edge Cases e Riscos

- **`time.Time`:** O Go serializa para strings ISO. O Gemini não entende o keyword `format: date-time`. **Solução:** Usar `string` com descrição clara na struct de saída da IA.
- **Ponteiros (`*string`):** O Gemini pode ter dificuldades com tipos nulos em Structured Output dependendo da versão. **Solução:** Preferir zero-values (`""`, `0`) e utilizar a tag `validate:"required"` para campos críticos.
- **Campos `interface{}`:** Atualmente usados em `Quantidade` e `ValorTotal`. **Devem ser convertidos para `string` ou `float64`** para que o gerador de schema funcione corretamente.

---

## 5. Plano de Implementação (Faseamento)

### Fase 1: Fundação do Pacote `schema`
1. Criar `internal/llm/schema/`.
2. Implementar `Builder` que utiliza `invopop/jsonschema` para gerar o schema agnóstico.
3. Criar os adaptadores: `ForGoogle()` e `ForOpenRouter()`.

### Fase 2: Robustez e Validação
1. Implementar `Decode[T](rawJSON string, dest *T) error` que realiza o Unmarshal e chama o `validator/v10` sequencialmente.
2. Adicionar testes unitários garantindo que schemas complexos (nested) sejam compatíveis com o Gemini.

### Fase 3: Refatoração do Roteador
1. Atualizar `UnifiedIntentResult` com tags `jsonschema` e `validate`.
2. Substituir o schema manual no `router.go` pela chamada dinâmica ao `schema.ForGoogle()`.

### Fase 4: Integração OpenRouter
1. Atualizar o `openRouterTransport` no `client.go` para injetar o `response_format` caso um schema seja fornecido no contexto da chamada.

---

## 6. Próximas Ações Sugeridas
1. Aprovação deste plano de pesquisa.
2. Execução da **Fase 1** (Instalação das dependências e criação do pacote base).

---
*Documento gerado como parte da Missão RPI do ManejoOrg.*
