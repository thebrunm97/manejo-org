# Plano de Projeto: RAG com Janelamento Contextual (Contextual Windowing)

## 1. Escopo e Objetivo
A missão consiste em refatorar a mecânica de busca do sistema RAG para adicionar Contextual Windowing. 
Sempre que um *chunk* relevante for encontrado pelo cálculo de similaridade de cosseno (via embeddings de 1024 dimensões do BGE-M3), a base de dados deverá retornar também os *chunks* imediatamente vizinhos (N-1 e N+1) pertencentes ao mesmo documento (`source_document_id`). Isto enriquecerá significativamente o contexto enviado ao LLM, evitando cortes abruptos na informação.

## 2. Fase de Contexto e Questões Socráticas (Open Questions)

> **Antes de implementarmos, precisamos alinhar os seguintes pontos:**
> 
> 1. **Parâmetro `window_size`**: No requisito foi sugerido o `DEFAULT 1` (trazendo o N-1 e o N+1). Existe algum cenário (ex: documentos técnicos) onde seja útil permitir janelas maiores como `window_size = 2` (5 chunks no total)? O script suportará isso de forma dinâmica?
> 2. **Limite Final de Tokens**: Ao triplicar o tamanho potencial de cada match (se todos os matches tiverem vizinhos exclusivos), o contexto a ser enviado ao LLM vai crescer substancialmente. Têm algum teto máximo para a soma dos caracteres injetados no prompt?
> 3. **Campo `match_pmo_id`**: Atualmente a função RPC antiga (`match_farm_documents`) recebe um filtro `match_pmo_id`. Devemos manter a restrição do `pmo_id` (para segmentar por quinta) na nova função `match_documents_with_context`?

## 3. Breakdown das Tarefas (Implementação)

### 3.1. Base de Dados (SQL)
- **Criar ficheiro:** `sql/rpc_match_context.sql`.
- **Implementar Função:** `CREATE OR REPLACE FUNCTION match_documents_with_context(...)`.
- **Lógica SQL (CTE):**
  1. Primeiro passo (CTE `top_chunks`): Selecionar os `match_count` chunks mais similares calculando `1 - (embedding_1024 <=> query_embedding)` filtrando pelo `threshold` e, se aplicável, pelo `pmo_id`.
  2. Segundo passo: Fazer `JOIN` à tabela original usando o `source_document_id`.
  3. Aplicar filtro: `farm_documents.chunk_index BETWEEN top.chunk_index - window_size AND top.chunk_index + window_size`.
  4. Agregar/Filtrar duplicados (`DISTINCT ON`) para garantir que os N vizinhos não se repitam se as áreas colidirem.
  5. Ordenar a devolução por `source_document_id` ASC, `chunk_index` ASC (Garante contexto sequencial contínuo na leitura).

### 3.2. Refatoração Backend (Golang)
- **Ficheiro:** `pmo-bot-go/internal/supabase/client.go`.
- **Modificar Busca:** Atualizar a `MatchFarmDocuments` (ou criar nova `MatchDocumentsWithContext`) para invocar a nova função RPC.
- **Camada de Serviço (Prompt Assembly):** 
  - No ficheiro que compõe a mensagem do LLM (ex: `handler.go` ou camada RAG).
  - Iterar nos `DocumentMatch` retornados.
  - Como a RPC já ordena pelo ficheiro e index, no Go iteramos os resultados e agrupamos blocos que tenham o mesmo `source_document_id`.
  - Prefixar a junção com o cabeçalho: `--- Documento: [source_document_id] ---`.

### 3.3. Verificação (Checklist)
- [ ] O script SQL compila e aplica na Base de Dados sem erros de tipagem?
- [ ] A invocação RPC via Go com JSON *payload* funciona perfeitamente com os novos parâmetros?
- [ ] Os logs do bot mostram a fusão dos chunks corretamente encapsulados com o cabeçalho do documento?
- [ ] Passa na verificação do `checklist.py`?

## 4. Agentes Atribuídos
- `@[backend-specialist]`: Responsável por compor e otimizar as queries de PostgREST no cliente em Go e por fundir sequencialmente o contexto.
- `@[database-design]`: Responsável por construir e validar o Common Table Expression (CTE) e os JOINS na RPC SQL (sem impacto massivo no plano de execução de Postgres).

---
*Este plano está pronto para revisão.*
