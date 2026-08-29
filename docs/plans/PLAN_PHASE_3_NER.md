# Investigação: Phase 3 - Multi-Entity Extraction (NER Avançado)

Este documento detalha o planejamento técnico para permitir a extração de múltiplas entidades/ações de uma única mensagem do usuário, utilizando o motor agnóstico de Structured Output.

## 1. Transformação da Struct `UnifiedIntentResult`

Atualmente, `UnifiedIntentResult` possui campos planos de extração. Para suportar NER avançado, moveremos esses campos para uma struct dedicada (`AcaoEstruturada`) e usaremos um slice.

### Nova Estrutura Sugerida (`internal/llm/types.go`)

```go
type AcaoEstruturada struct {
	Intencao          string      `json:"intencao" jsonschema:"description=Mapeamento da ação (ex: registro, limpeza, registro_financeiro)"`
	Atividade         string      `json:"atividade,omitempty" jsonschema:"description=Atividade detectada"`
	Insumo            string      `json:"insumo,omitempty" jsonschema:"description=Insumo ou cultura principal"`
	Quantidade        string      `json:"quantidade,omitempty" jsonschema:"description=Valor da quantidade"`
	Unidade           string      `json:"unidade,omitempty" jsonschema:"description=Unidade de medida"`
	Localizacao       Localizacao `json:"localizacao,omitempty"`
	// ... campos secundários (Data, Fornecedor, etc)
}

type UnifiedIntentResult struct {
	Intent     Intent            `json:"intent" jsonschema:"required"`
	Confidence float64           `json:"confidence" jsonschema:"required"`
	Reasoning  string            `json:"reasoning" jsonschema:"required"`
	Entities   []AcaoEstruturada `json:"entidades" jsonschema:"minItems=1,description=Lista de ações detectadas. Cada ação deve ser independente e completa."`
}
```

## 2. Isolamento de Contexto com `jsonschema`

Para evitar que a IA misture dados (ex: atribuir a quantidade do item A ao item B), utilizaremos as seguintes estratégias nas tags:

1.  **Descrições de Campo Rigorosas**:
    *   `jsonschema:"description=Mantenha a quantidade estritamente ligada ao insumo mencionado na mesma frase/contexto."`
2.  **MinItems**: Garantir que se a intenção for DATABASE, pelo menos uma entidade seja gerada.
3.  **Prompt Habilitador**: Atualizar o roteador com exemplos de "Few-Shot" mostrando como separar sentenças compostas em múltiplas entradas no slice `entidades`.

## 3. Impacto na FSM e Orchestrator

### FSM (`internal/state/fsm.go`)
*   **Loop de Processamento**: O `ProcessMessage` deixará de ser linear. Implementaremos um loop sobre `unifiedRes.Entities`.
*   **Estado de Entrevista**: Se uma ação estiver incompleta, a FSM entrará no estado `StateAguardando...` referente a **essa ação específica**. As ações anteriores que foram válidas já terão sido salvas.
*   **Batch Save**: Estudar se devemos salvar todas juntas no final ou uma por uma (Recomendado: Uma por uma para evitar perda de dados se o loop quebrar).

### Orchestrator (`internal/state/orchestrator.go`)
*   O Orchestrator focado em ferramentas ("Agentic Loop") não será diretamente impactado na lógica de loop, mas sim na extração final caso ele precise retornar um objeto estruturado.

## 4. Plano de Migração (Lotes)

| Fase | Descrição | Impacto |
| :--- | :--- | :--- |
| **Fase 3.1** | Refatoração dos Tipos e Motor | Quebra compatibilidade nos handlers (ajuste manual necessário). |
| **Fase 3.2** | Atualização do Roteador | Melhora a precisão na extração de múltiplas ações. |
| **Fase 3.3** | Implementação do Loop na FSM | Habilita o processamento real de lotes no WhatsApp. |
| **Fase 3.4** | Validação de Handlers | Garante que `handleRegistroFinanceiro` e outros aceitem a nova struct. |

---
**Documento gerado por @backend-specialist & @project-planner.**
