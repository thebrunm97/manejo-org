# PLAN-supabase-mutations

## Contexto
- **Objetivo**: Escalar o catálogo de ferramentas de mutação do LLM mapeando JSON Schemas rigorosos diretamente para as RPCs do Supabase existentes (ex: plantio, colheita, manejo).
- **Descoberta**: Foram encontradas duas RPCs principais nas migrações do Supabase:
  1. `rpc_registrar_operacao_campo(pmo_id_arg, user_id_arg, tipo_arg, payload_arg)`: Lida com Plantio, Propagação, Manejo, Colheita, Limpeza, etc.
  2. `rpc_registrar_compra_insumo(...)`: Lida com compras de insumos.

## Estratégia de Implementação (RegistrarPlantio)

1. **Definição da Ferramenta (`internal/mcp/tools_registry.go`)**
   - Nome: `RegistrarPlantio`
   - Parâmetros Rigorosos (JSON Schema):
     - `especies` (string, required): A cultura plantada (ex: "Alface").
     - `quantidade_valor` (number, required): Quantidade plantada.
     - `quantidade_unidade` (string, required): Unidade de medida (ex: "mudas", "kg").
     - `talhao_nome` (string, required): Nome do talhão onde foi plantado.
     - `data` (string, optional): Data do plantio no formato YYYY-MM-DD.
     - `origem` (string, optional): Origem das sementes/mudas.

2. **Handler de Mutação (`internal/mcp/tools_mutations.go`)**
   - Criar `handleRegistrarPlantio(args map[string]interface{}) (interface{}, error)`.
   - Recuperar `pmo_id` e `user_id` do contexto.
   - Montar o `payload_arg` (JSONB) exigido pela RPC.
   - Chamar o Supabase REST via cliente HTTP ou método existente: `POST /rest/v1/rpc/rpc_registrar_operacao_campo`.
   - Injetar `tipo_arg = 'Plantio'`.
   - Tratar e retornar o JSON de resposta (com status e mensagem).

## Checklist de Execução
- [ ] Criar arquivo `internal/mcp/tools_mutations.go` (ou expandir `specialized_handlers.go`).
- [ ] Implementar `handleRegistrarPlantio` consumindo o cliente Supabase.
- [ ] Registrar a ferramenta no `InitializeTools` do MCP.
- [ ] Atualizar as permissões ou referências, caso aplicável.
- [ ] Validar a compilação local com `go build ./...`.

## Agentes Sugeridos
- `backend-specialist`: Para implementação do código Go, integração de REST API (Supabase) e manipulação do payload JSON.
