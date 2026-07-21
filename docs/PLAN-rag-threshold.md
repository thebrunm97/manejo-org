# PLAN-rag-threshold

Ajustar o limiar de similaridade (similarity threshold) e opcionalmente o limite de resultados (top-K) na busca vetorial no backend em Go para aumentar o recall de dados sobre milho e outras culturas no RAG.

## User Review Required

> [!IMPORTANT]
> Reduzir o threshold para `0.50` ou `0.55` trará chunks com menor similaridade matemática. Isso melhora o recall (chance de encontrar a informação), mas pode introduzir ruído nas respostas se a pergunta do produtor for vaga. A blindagem semântica no `agronomist.md` será a responsável por filtrar esse ruído.

## Open Questions

1. **Valor Exato do Novo Threshold:** Devemos configurar o threshold para `0.50` ou `0.55`?
2. **Ajuste do Top-K (Limite de resultados):** Atualmente o código busca no máximo 4 documentos (`top-K = 4`). Devemos aumentar esse limite para `6` ou `8` para garantir que mais chunks relevantes sejam retornados ao Gemini?
3. **Necessidade de Rebuild:** Sim, qualquer alteração no código Go requer a execução de `docker compose -f docker-compose.prod.yml up -d --build pmo-bot-go` para compilar o binário e atualizar o container. O usuário confirma a execução automática após aprovação?

## Proposed Changes

### Backend Go

#### [MODIFY] [tools_rag.go](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-bot-go/internal/mcp/tools_rag.go)
- Reduzir o parâmetro `threshold` na chamada a `s.supabase.MatchFarmDocuments` da linha 78.
- Opcionalmente, atualizar o parâmetro `count` para aumentar a quantidade de chunks recuperados.

## Verification Plan

### Automated Tests
- Executar os testes de integração do RAG:
  ```bash
  go test -v ./pmo-bot-go/tests/integration_rag_test.go
  ```

### Manual Verification
- Reiniciar o bot e conferir logs da execução.
- Validar se a rota do webhook ou o MCP interno recupera e exibe dados quando o threshold é menor.
