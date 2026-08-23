# PLAN-hitl-judge-bugfix.md
## Correção de Bugs: HITL Duplo + OutputJudge Agressivo

**Contexto:** Log de produção de 06/06/2026 revelou 4 bugs críticos após o deploy do NER Multimodal.

---

## Diagnóstico dos Bugs (Root Cause Analysis)

### 🐛 Bug 1 — HITL Triplo (3 confirmações para 1 operação)
**Sintoma:** O produtor recebeu 3 mensagens de confirmação iguais para o mesmo frete de R$150.

**Root Cause:** O loop NER multimodal em `fsm.go` itera sobre `unifiedRes.Intents`. A intenção `FINANCE` chama `handleDuvidaFallback`, que instancia um `Orchestrator`. O Orchestrator dispara `HITL.RequestApproval` na primeira tool call — mas como o loop de intents roda 3 vezes (DATABASE, FINANCE, RAG), **o Orchestrator é criado 3 vezes**, cada um disparando o HITL independentemente para a mesma ferramenta.

**Arquivo:** `pmo-bot-go/internal/state/orchestrator.go` + `fsm.go`

**Fix:** Implementar um **HITL dedup guard** no `Orchestrator.ExecuteAgenticLoop`: antes de chamar `RequestApproval`, verificar via `FindPendingByPhone` se já existe um token `waiting` para o mesmo `tool_name` + `phone` nesta sessão. Se sim, skip o RequestApproval e inject o synthetic result de `awaiting_confirmation` diretamente, sem criar novo registro.

---

### 🐛 Bug 2 — OutputJudge bloqueando respostas RAG legítimas
**Sintoma:** A resposta sobre "Traça-do-tomateiro" (baseada em documentos Embrapa) foi bloqueada com `ALUCINACAO_DADOS`.

**Root Cause:** O `judgeSystemPrompt` em `judge_gemini.go` define `ALUCINACAO_DADOS` como *"afirmação de datas, produtividades, variedades ou registros específicos da fazenda que não foram mencionados pelo usuário"*. O juiz está interpretando as recomendações técnicas do RAG (nomes de pragas, técnicas) como "dados não confirmados dos registros da fazenda". O prompt não distingue entre:
- Dados da fazenda do produtor (contexto privado)
- Conhecimento técnico agronômico geral (fontes públicas/Embrapa)

**Arquivo:** `pmo-bot-go/internal/guardrails/judge_gemini.go`

**Fix:** Refinar a definição de `ALUCINACAO_DADOS` para excluir explicitamente respostas RAG com fontes identificadas. Adicionar ao `buildJudgePrompt` a informação de `intent` e se `rag_farm_documents` foi usado como ferramenta — quando `intent=RAG` e tool inclui `consultar_documentos`, relaxar a política de alucinação.

---

### 🐛 Bug 3 — Mensagem "Olá! Sou o assistente..." vazando no fluxo
**Sintoma:** No meio das respostas completas, o bot enviou `"Olá! Sou o assistente do ManejoORG. Como posso ajudar você hoje?"` — uma saudação genérica.

**Root Cause:** O loop de intents em `fsm.go` possui um Fast-Track para `IntentChat`. Quando o NER Multimodal classifica a mensagem multi-intenção, um dos intents pode ser `CHAT` (saudação detectada no início da mensagem "Chefe, ..."). O Fast-Track então injeta a saudação genérica **como resposta de uma das intents**, que é agregada no `finalResponses`.

**Arquivo:** `pmo-bot-go/internal/state/fsm.go`

**Fix:** O Fast-Track de `IntentChat` (linhas 193-200) deve ser executado **apenas** quando `IntentChat` é o ÚNICO intent (condição já existe). Dentro do loop `for idxIntent, intent := range unifiedRes.Intents`, adicionar um skip para `IntentChat` quando existem outros intents no mesmo array — a saudação não deve ser gerada em mensagens mistas.

---

### 🐛 Bug 4 — Resposta final fragmentada (3 mensagens separadas)
**Sintoma:** O produtor recebeu 3 mensagens separadas no final: a confirmação do frete, uma mensagem genérica, e o RAG de pragas — em vez de uma resposta única consolidada.

**Root Cause:** O `sendFeedback` em `fsm.go` é chamado em diferentes pontos do código (dentro do loop e no final). Quando o HITL retorna `awaiting_confirmation`, `handleDuvidaFallback` retorna a resposta imediatamente e `fsm.go` faz `sendFeedback` com o resultado parcial. Os resultados subsequentes (RAG) geram novas chamadas a `sendFeedback`. Resultado: 3 mensagens separadas.

**Arquivo:** `pmo-bot-go/internal/state/fsm.go`

**Fix:** Separar o **acúmulo de respostas** do **envio**. O loop de intents deve apenas acumular em `finalResponses[]`. O `sendFeedback` deve ser chamado **uma única vez** no final, com o `aggregatedResponse` completo. As respostas de HITL (awaiting_confirmation) devem ser tratadas como respostas parciais acumuladas, não enviadas individualmente.

---

## Arquivos a Modificar

### 1. `pmo-bot-go/internal/state/orchestrator.go`
**HITL Dedup Guard:**
- Antes de `RequestApproval`, consultar `o.HITL.FindPendingByPhone(ctx, o.Phone)`
- Se existir um pending com `ToolName == tc.Nome` → skip RequestApproval, inject synthetic `awaiting_confirmation` diretamente
- Logar `[HITL-DEDUP] Token reutilizado — evitando confirmação duplicada`

### 2. `pmo-bot-go/internal/guardrails/judge_gemini.go`
**OutputJudge RAG-Aware:**
- Refinar definição de `ALUCINACAO_DADOS` no `judgeSystemPrompt`:
  ```
  ALUCINACAO_DADOS:
    Afirmação de datas, produtividades ou registros ESPECÍFICOS DA FAZENDA DO PRODUTOR
    que não foram mencionados pelo usuário e não constam no contexto fornecido.
    EXCEÇÃO: Informações técnicas agronômicas gerais (nomes de pragas, técnicas de manejo,
    recomendações de fontes públicas como Embrapa) NÃO são alucinação de dados.
  ```
- Enriquecer `buildJudgePrompt` com campo `[INTENT]` e `[FONTE_RAG: sim/não]` para o juiz ter contexto suficiente

### 3. `pmo-bot-go/internal/state/fsm.go`
**Bug 3 — IntentChat Skip no Loop:**
- No loop `for idxIntent, intent := range unifiedRes.Intents`, adicionar:
  ```go
  if intent == llm.IntentChat && len(unifiedRes.Intents) > 1 {
      log.Printf("⏩ [FSM] Pulando IntentChat em mensagem mista")
      continue
  }
  ```

**Bug 4 — Single sendFeedback:**
- Remover chamadas intermediárias a `sendFeedback` dentro do loop de intents
- Garantir que o `sendFeedback` final (linha ~294) é o único ponto de envio ao produtor
- Respostas de HITL `awaiting_confirmation` são acumuladas em `finalResponses`, não enviadas imediatamente

---

## Ordem de Implementação

| # | Arquivo | Bug | Risco |
|---|---------|-----|-------|
| 1 | `judge_gemini.go` | Bug 2 (Judge RAG) | 🟢 Baixo — apenas prompt |
| 2 | `fsm.go` | Bug 3 (IntentChat) | 🟢 Baixo — 3 linhas |
| 3 | `orchestrator.go` | Bug 1 (HITL dedup) | 🟡 Médio — nova consulta async |
| 4 | `fsm.go` | Bug 4 (sendFeedback) | 🔴 Alto — refatoração de fluxo |

---

## Verificação

```powershell
# 1. Build
go build ./...

# 2. Simular mensagem multi-intenção
$body = @{
  event = "Message"
  data = @{
    info = @{ ID = "test-multifix-1"; Chat = "5511999999999@c.us"; Sender = "5511999999999@c.us"; IsFromMe = $false; Timestamp = (Get-Date -Format "o"); Type = "conversation" }
    message = @{ conversation = "Colhi 10 caixas de tomate, paguei 150 de frete (50% talhão 1, 50% talhão 2) e qual é a principal praga do tomate?" }
  }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "http://localhost:8080/webhook/evolution?token=ManejoOrgToken" -Method POST -Body $body -ContentType "application/json"

# Verificar logs:
# ✅ HITL enviado APENAS UMA VEZ
# ✅ [HITL-DEDUP] nos logs subsequentes (se loop rodar mais de uma vez)
# ✅ Resposta RAG sobre pragas NÃO bloqueada pelo Judge
# ✅ UMA única mensagem final consolidada
# ❌ NENHUM "Olá! Sou o assistente..." no meio das respostas
```

---

## Critérios de Aceitação

- [ ] Produtor recebe **1 única** mensagem de confirmação HITL por operação
- [ ] Resposta RAG com fonte Embrapa passa pelo OutputJudge sem bloqueio
- [ ] Mensagem multi-intenção gera **1 única** resposta consolidada final
- [ ] Nenhuma saudação genérica vazando em mensagens com múltiplas intenções
- [ ] `go build ./...` sem erros
