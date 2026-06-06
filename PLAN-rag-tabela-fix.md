# RAG Tabela Fix — Migrar knowledge_chunks → farm_documents

## Goal
O bot consulta a tabela `farm_documents` via RPC `match_farm_documents`, mas os PDFs da Embrapa (milho, hortaliças) foram ingeridos na tabela `knowledge_chunks`. São tabelas **completamente separadas** — por isso o RAG retorna "Não encontrei" para milho.

## Diagnóstico (Root Cause)

| Item | Valor |
|------|-------|
| Tabela que o bot consulta | `farm_documents` (via RPC `match_farm_documents`) |
| Tabela onde os PDFs estão | `knowledge_chunks` (296 chunks, 2 documentos) |
| Chunks de milho em `farm_documents` | **0** |
| Chunks de milho em `knowledge_chunks` | **~148** (do PDF da Embrapa 2008) |
| Dimensão dos embeddings | Ambas usam **3072** (compatíveis) |
| Filtro da RPC | `WHERE (pmo_id = match_pmo_id OR pmo_id IS NULL)` |

## Opções de Solução

### Opção A: Migrar dados de `knowledge_chunks` → `farm_documents` (SQL INSERT)
- Copiar os 296 chunks com `pmo_id = NULL` (global) para `farm_documents`
- **Prós:** Zero alteração no código Go, zero rebuild de container
- **Contras:** Duplicação de dados, precisa manter sincronizado no futuro

### Opção B: Alterar a RPC para consultar AMBAS as tabelas (UNION)
- Modificar `match_farm_documents` para fazer `UNION ALL` entre `farm_documents` e `knowledge_chunks`
- **Prós:** Sem duplicação, fonte única de verdade
- **Contras:** RPC mais complexa, possível impacto de performance

### Opção C: Unificar as tabelas permanentemente
- Migrar tudo para `farm_documents` e depreciar `knowledge_chunks`
- **Prós:** Arquitetura limpa a longo prazo
- **Contras:** Pode quebrar o ingestor Python que alimenta `knowledge_chunks`

## Recomendação: Opção A (migração SQL imediata)
É a mais segura, rápida e não requer rebuild do container.

## Tasks
- [x] ~~Executar SQL INSERT~~ → Opção B aplicada: UNION ALL na RPC `match_farm_documents`
- [x] Validar: RPC retorna 6 chunks do milho (similarity 0.84–1.00) ✅
- [x] Validar: RPC continua retornando `farm_documents` (Olericultura) ✅
- [ ] Teste no WhatsApp: perguntar sobre espaçamento/densidade do milho

## Done When
- [x] RPC retorna chunks do manual de milho da Embrapa
- [ ] Bot responde corretamente sobre densidade de plantio (40.000-50.000 plantas/ha)
