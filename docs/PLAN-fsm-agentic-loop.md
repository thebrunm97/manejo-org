# Transição FSM para Agentic Loop (Fase 1: Read-Only Tool Calling)

Implementação do modo sandbox do orquestrador com a nova ferramenta especializada `ConsultarLeiOrganica_RAG` de leitura de dados, garantindo a robustez do Agentic Loop sem risco de mutação acidental ou panics por argumentos inválidos.

## User Review Required

> [!IMPORTANT]
> **Confirmação de Vetorização:** O teste local no Supabase confirmou que o documento `L10831.pdf` **já está vetorizado** com 6 chunks na tabela `farm_documents` com `pmo_id = null` (global). Reutilizaremos a infraestrutura existente de busca vetorial e Meta-RAG para esta ferramenta.

## Open Questions

Não existem perguntas pendentes. O utilizador já confirmou na interação anterior que a Lei Orgânica 10.831 é um documento global e que deveríamos prosseguir por este caminho após a validação da vetorização.

---

## Proposed Changes

### MCP Tools & Registry

#### [MODIFY] [tools_registry.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/mcp/tools_registry.go)
- Registar a nova ferramenta `ConsultarLeiOrganica_RAG` no MCP Server na função `InitializeTools`.
- A definição deve conter a descrição solicitada e o parâmetro obrigatório `query`.

#### [MODIFY] [tools_rag.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/mcp/tools_rag.go)
- Implementar a função `handleConsultarLeiOrganica`.
- Esta função extrai o parâmetro `query` de forma segura, obtém o `pmo_id` ativo (com fallback para `0` se não estiver presente) e encaminha para `handleConsultarBaseConhecimento` sem o filtro de categoria para evitar que o metadata nulo descarte os chunks da lei.

---

### Orchestrator Logic & Argument Validation

#### [MODIFY] [orchestrator.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/state/orchestrator.go)
- Adicionar validação estrita ao argumento `query` quando a ferramenta for `ConsultarLeiOrganica_RAG` no loop de execução para evitar panics caso a IA envie valores vazios ou tipos incorretos.

---

## Verification Plan

### Automated Tests
- Executar os testes do MCP para garantir a integridade dos handlers:
  ```powershell
  go test -v ./internal/mcp/...
  ```
- Compilar o projeto completo para validar que não há erros de tipagem ou assinaturas:
  ```powershell
  go build ./...
  ```

### Manual Verification
1. Fazer uma pergunta sobre a Lei 10.831 (ex: *"O que a lei orgânica diz sobre o uso de esterco?"*) e validar no log que a ferramenta `ConsultarLeiOrganica_RAG` é acionada e retorna os chunks adequados.
2. Fazer um chat simples (ex: *"Oi"*) e garantir que as ferramentas não são invocadas (mantendo o bypass do Fast-Track).
