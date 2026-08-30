# PLAN-mutation-hardening.md — Arquitetura de Mutações, Idempotência e HITL

> **Objetivo:** Estabelecer a infraestrutura compartilhada e as políticas determinísticas para ferramentas de escrita (mutações) no Agentic Loop do PMO Bot, cobrindo política de confirmação (HITL), idempotência contra retries de LLM, semântica de lote e guardrails de segurança.

---

## 1. Princípio e Política Geral de Confirmação (HITL)

Em vez de decisões ad hoc por ferramenta, adotamos uma **Política Baseada em Risco e Limiar (Risk-Threshold Matrix)** com 4 regras determinísticas:

```
                      [ Chamada de Ferramenta ]
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
[ Hard Error / Inválido ]                      [ Dados Válidos ]
 (Qtd <= 0, Talhão nulo)                                   │
         │                                                 ▼
   [ REJEIÇÃO ]                         ┌──────────────────┴──────────────────┐
                                        ▼                                     ▼
                              [ Critérios de Risco ]                [ Operação de Rotina ]
                              - Impacto financeiro (> R$ 500)       - Colheita / Plantio padrão
                              - Quantidade alta (> 50% limiar)      - Limpeza / Irrigação
                              - Irreversível (Cadastro Fazenda)     - Registro sem impacto financeiro
                              - Lote de Múltiplas Ações                       │
                                        │                                     ▼
                                        ▼                             [ EXECUÇÃO DIRETA ]
                                [ SOLICITA HITL ]                     (Feedback pós-ação + Lote)
                             (Grava em hitl_pending)
```

### Regras Declaradas da Política:
1. **Regra Financeira (Impacto no Caixa):**
   - Transação financeira geral de despesa ou venda com `valor_total > R$ 500,00` $\rightarrow$ **Exige HITL**.
   - Compra de insumos (`registrar_compra_insumo`) sem comprovação de Nota Fiscal (`nota_fiscal == ""`) com `valor_total > R$ 200,00` $\rightarrow$ **Exige HITL**.
   - Valores com comprovante e $\le$ R$ 500,00 com descrição clara $\rightarrow$ **Execução Direta**.
2. **Regra de Volume e Escala Agronômica:**
   - Quantidade física $> 50\%$ do limite de segurança padrão (`DefaultLimiteManejo` $= 2.500\text{ kg/L}$) $\rightarrow$ **Exige HITL**.
   - Quantidade dentro da faixa operacional padrão $\rightarrow$ **Execução Direta**.
3. **Regra de Irreversibilidade Estrutural e Contratual:**
   - Criação de novas propriedades (`cadastrar_propriedade`), exclusão de infraestrutura ou compromisso formal de entrega de cotas a cooperativas (`registrar_cota_cooperativa`) $\rightarrow$ **Exige HITL**.
4. **Regra de Operações em Lote:**
   - `RegistrarLoteOperacoes` com 2 ou mais itens heterogêneos $\rightarrow$ **Exige HITL** (apresenta sumário consolidado de uma vez).

---

## 2. Mecanismo de Idempotência (Proteção contra Retries do LLM)

### Problema:
Modelos com retries automáticos por timeout/respostas vazias (ex: Nemotron / fallback de provedores) podem reenviar a mesma chamada de ferramenta, causando duplicidade no banco de dados (dupla despesa, dupla colheita).

### Solução Arquitetural e Granularidade:
1. **Granularidade Determinística por Chamada de Ferramenta (Sem Dependência de `tool_call_id`):**
   - **Por que NÃO usar `tool_call_id`?** O `tool_call_id` é gerado dinamicamente pela API do provedor (OpenAI/OpenRouter/Gemini) a cada completion. Se o orchestrator faz retry por timeout ou resposta vazia, o provedor gera um **novo** `tool_call_id`, o que mudaria o hash e anularia a proteção contra duplicatas.
   - **Fórmula Estável Gerada pelo Orchestrator:**
     $$\text{IdempotencyKey} = \text{SHA256}(\text{from\_phone} + \text{":"} + \text{message\_id} + \text{":"} + \text{tool\_name} + \text{":"} + \text{canonical\_args\_json} + \text{":"} + \text{occurrence\_index})$$
     - `from_phone`: Telefone do produtor (contexto de autenticação).
     - `message_id`: ID único da mensagem do WhatsApp (estável entre retries da mesma mensagem).
     - `tool_name`: Nome canônico da ferramenta chamada.
     - `canonical_args_json`: JSON normalizado com chaves ordenadas dos argumentos.
     - `occurrence_index`: **Contador agrupado por `(tool_name, canonical_args_json)`**, e NÃO pela posição global na lista do turno. O orchestrator mantém um mapa `seenMap[tool_name + ":" + canonical_args_json]++`.
   - **Invariância a Permutações do LLM:** Se numa retry o LLM reordenar as chamadas (ex: emitir uma despesa antes dos plantios), a contagem do grupo `(registrar_plantio, args_A)` começará em 0 e incrementará para 1 independentemente da ordem relativa entre ferramentas diferentes, garantindo **idempotência estável e imune a permutações de geração**.

2. **Sincronização de Janelas de TTL (Idempotência $\ge$ HITL):**
   - **Janela do HITL:** O registro em `hitl_pending` tem TTL de **10 minutos** (`expires_at = NOW() + INTERVAL '10 minutes'`).
   - **Janela de Idempotência:** A `IdempotencyKey` é gravada diretamente na linha do registro persistido (`caderno_campo.idempotency_key` ou `transacoes_financeiras.idempotency_key`) como constraint `UNIQUE`, ou retida por **30 dias** na tabela de auditoria.
   - **Regra de Dependência:** Como $\text{TTL}_{\text{idempotência}} \gg \text{TTL}_{\text{HITL}}$, a proteção contra duplicatas permanece ativa mesmo que o produtor demore 9 minutos para responder "SIM" ou caso ocorra um retry assíncrono tardio.

3. **Comportamento na RPC do Supabase:**
   - Se `idempotency_key` já existe: a RPC **não executa novo INSERT** e retorna imediatamente o registro já gravado com status `already_processed`.
   - Se `idempotency_key` é nova: executa o INSERT e indexa a chave.

---

## 3. Semântica de Operações em Lote (`RegistrarLoteOperacoes`)

### Regra de Domínio Fixa (Decisão Determinística sem Ambiguidade do LLM):
A decisão entre execução **Atômica** vs **Sucesso Parcial** é uma regra de negócio fixa por categoria de lote, **eliminando qualquer inferência ou parâmetro livre deixado para o LLM**:

1. **Lotes Financeiros / Contábeis $\rightarrow$ Sempre Atômico (All-or-Nothing):**
   - Lotes envolvendo compras com rateio (`alocacoes_talhoes`), pagamentos múltiplos ou fechamento financeiro são executados em **transação única SQL**.
   - Se 1 rateio falhar ou o valor não bater com o total, ocorre **ROLLBACK TOTAL**, prevenindo corrupção no fluxo de caixa.

2. **Lotes de Manejo Agrícola de Rotina $\rightarrow$ Sempre Sucesso Parcial (Isolated-Item):**
   - Operações de campo (ex: colheita de tomate + plantio de alface + limpeza de galpão) são eventos físicos independentes.
   - Execução item a item no repositório:
     - Itens válidos sofrem **commit**.
     - Itens inválidos são isolados e não travam os demais.
     - Feedback granular com detalhamento dos lotes gerados e do motivo do item não salvo:
       ```text
       ✅ 2 operações registradas:
       • Colheita de 100 kg de Tomate no Talhão 01 (Lote: COL-20260816-TOM-01)
       • Plantio de 300 mudas de Alface no Talhão 02

       ⚠️ 1 operação não pôde ser salva:
       • Compra de Adubo: faltou informar o fornecedor ou valor.
       ```

---

## 4. Guardrails: Bloqueio Duro (Hard Block) vs Soft HITL

| Cenário de Validação | Tipo de Bloqueio | Comportamento do Sistema |
|---|---|---|
| Quantidade $\le 0$, Valor $< 0$, Talhão obrigatório nulo | **Hard Block** (Erro Fatal) | Rejeição imediata. O bot devolve mensagem pedagógica ao produtor explicando o dado faltante/inválido. Não grava nada. |
| Manejo $> 5.000\text{ kg/L}$ ou Despesa $> \text{R\$} 50.000,00$ | **Soft HITL** (Gatilho Forçado) | Em vez de bloquear, o sistema intercepta como **Risco Elevado** e pergunta: *"Atenção: Este valor está acima do limite habitual. Confirma que deseja realmente lançar R$ X?"* |
| Tentativa de injeção de prompt ou alteração de contexto | **Hard Block** | Bloqueado pelo filtro de injeção/PII. |

---

## 5. Máquina de Estados e Ciclo de Vida do HITL

### Diagrama de Estados do HITL:

```
[ Início ]
    │
    ▼
( Orchestrator detecta Risco )
    │
    ├─► Grava em `hitl_pending` (status: 'waiting', TTL: 10 min)
    ├─► Envia WhatsApp: "Confirma [Ação]? Responda SIM ou NÃO"
    │
    ▼
[ Aguardando Resposta ]
    │
    ├───────────► Respondeu "SIM"  ──► Executa Tool via MCP ──► Status: 'approved' ──► "✅ Confirmado!"
    │
    ├───────────► Respondeu "NÃO"  ──► Cancela ───────────────► Status: 'rejected' ──► "🚫 Cancelado!"
    │
    ├───────────► Timeout (10 min) ──► pg_cron expira ────────► Status: 'expired'
    │
    └───────────► Nova Pergunta    ──► Webhook processa a dúvida e adiciona lembrete:
                                       "Você tem uma confirmação pendente de [Ação]. Deseja confirmar?"
```

---

## 6. Plano de Fases de Execução

### Fase 2.1: Infraestrutura de Idempotência e Política HITL (Base)
- [ ] Adicionar suporte a `idempotency_key` granular por chamada de tool no `Orchestrator` e nas RPCs do Supabase.
- [ ] Refatorar `RequiresHITL(toolName, args, evalContext)` em `internal/guardrails/hitl.go` para aplicar as 4 regras de limiar dinâmico.
- [ ] Ajustar `internal/guardrails/business.go` para transformar limites excedidos em gatilhos de Soft HITL em vez de rejeição dura.
- [ ] Implementar regra fixa de semântica de lote (Financeiro = Atômico, Manejo = Parcial).

### Fase 2.2: Padronização e Auditoria das Tools Existentes (14 Ferramentas)
- [ ] Padronizar nomenclatura (`RegistrarPlantio` $\rightarrow$ `registrar_plantio`).
- [ ] Garantir passagem obrigatória de `idempotency_key` e `raw_payload_id` em todas as ferramentas.
- [ ] Cobrir testes unitários e de concorrência com retries simulados.

### Fase 2.3: Implementação das Lacunas Reais (3 Ferramentas Novas)
- [ ] **`cadastrar_propriedade`**: Criação de fazenda + auto-criação de PMO inicial.
- [ ] **`registrar_manejo_campo`**: Adubação orgânica, caldas, podas e tratamentos fitossanitários.
- [ ] **`registrar_cota_cooperativa`**: Vinculação de cotas a demandas coletivas abertas.

### Fase 2.4: Verificação e Testes E2E
- [ ] Executar benchmark E2E de simulação HITL (`hitl_e2e_simulate_test.go`).
- [ ] Teste de idempotência com retries concorrentes e múltiplas chamadas no mesmo turno.
- [ ] Auditoria final de segurança e tipos (`go test ./...`).

---

## Agentes Responsáveis
* **`project-planner`**: Estruturação de fases, gates e contratos.
* **`backend-specialist`**: Implementação em Go, RPCs Supabase, middlewares e testes.
