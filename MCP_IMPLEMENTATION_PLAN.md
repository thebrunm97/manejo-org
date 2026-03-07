# MCP Implementation Plan (Spec-Driven)

Este plano detalha a transição da arquitetura rígida de RAG e salvamento de dados para uma abordagem baseada em Model Context Protocol (MCP), permitindo que o bot utilize ferramentas dinâmicas para consulta e persistência.

## 1. Inicialização

Integraremos o MCP no `pmo-bot-go` da seguinte forma:

- **Local:** Criaremos um novo pacote em `internal/mcp`.
- **Instanciação:** O `mcp.Server` será instanciado no `main.go`. Ele rodará como um serviço interno (ou via stdio/SSE se necessário para debug).
- **Consumo:** O `fsm.go` passará a atuar como um "Tool User". Em vez de chamar explicitamente o `supabase.MatchFarmDocuments`, ele enviará a intenção do usuário para o LLM (Gemini) com o catálogo de ferramentas MCP disponíveis.

## 2. Mapeamento de Tools (Ferramentas)

Substituiremos a lógica hardcoded por uma ferramenta unificada de busca:

1.  **`consultar_base_conhecimento(pmo_id int, pergunta string)`**:
    - **Objetivo:** Pesquisar manuais, regras de plantio, histórico da fazenda e normas globais orgânicas.
    - **Ação:** Realiza busca vetorial no Supabase (RPC `match_farm_documents`), retornando chunks relevantes de documentos da fazenda (Multitenant) e globais.
2.  **`save_farm_record(pmo_id int, record_data json)`**:
    - **Objetivo:** Persistir dados no Caderno de Campo.
    - **Ação:** Valida conformidade e insere no Supabase.

## 3. Integração FSM

A máquina de estados (`internal/state/fsm.go`) será refatorada para:

1.  **Detecção de Intenção:** Manter o Groq para extração inicial (NER).
2.  **Delegação ao MCP:**
    - Se a intenção for `duvida`, o bot chama o Gemini passando as definições das ferramentas MCP.
    - O Gemini decide se precisa chamar `query_farm_data` ou `get_global_norms` antes de responder.
3.  **Resposta:** O bot processa o retorno da ferramenta e entrega a resposta final (Texto ou Áudio via TTS).

## 4. Plano de Ação Atômico

Para as próximas fases, seguiremos este roteiro:

1.  **Setup do Skeleton:** Criar o diretório `internal/mcp` e definir as interfaces básicas do servidor.
2.  **Tool: `query_farm_data`:** Migrar a lógica de busca vetorial do `fsm.go` para uma ferramenta MCP isolada.
3.  **Orquestração Gemini-MCP:** Atualizar o `gemini.Client` para suportar Tool Calling (Function Calling) seguindo o protocolo MCP.
4.  **Refatoração do Handler:** Adaptar o `webhook/handler.go` para permitir que o fluxo de decisão passe pelo roteador de ferramentas.

---
**Nota:** Este plano prioriza a estabilidade, mantendo o fluxo atual como fallback durante a migração.
