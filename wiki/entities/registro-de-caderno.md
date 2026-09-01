# Registro de caderno

Uma linha da [[caderneta-de-campo]]: um evento agrícola datado, localizado e
quantificado.

## `public.caderno_campo`

`supabase/migrations/20260402000000_create_core_app_tables.sql:169`

| Grupo | Colunas |
| --- | --- |
| Identidade | `id` UUID PK, `criado_em`, `data_registro`, `data` |
| Vínculo | `user_id`, `propriedade_id`, `pmo_id`, `talhao_id`, `canteiro_ids` UUID[] |
| Classificação | `tipo_atividade` (NOT NULL), `tipo_operacao`, `secao_origem`, `sistema`, `status` |
| Conteúdo | `produto`, `talhao_canteiro`, `quantidade_valor`, `quantidade_unidade`, `detalhes_tecnicos` JSONB |
| Comercial | `lote`, `destino`, `classificacao`, `valor_total`, `origem`, `nota_fiscal`, `fornecedor` |
| Perdas | `houve_descartes`, `qtd_descartes`, `unidade_descartes` |
| Conformidade | `modalidade_aplicada`, `responsavel`, `equipamentos` TEXT[] |
| Procedência | `observacao_original`, `audio_url`, `raw_payload_id` |

RLS: `USING (user_id = auth.uid())`.

## Tipagem dos detalhes

`detalhes_tecnicos` é JSONB validado **em runtime no cliente** por schemas
Zod escolhidos conforme `tipo_atividade` — `DetalhesPlantioSchema`,
`DetalhesManejoSchema`, `DetalhesColheitaSchema`
(`pmo-frontend/src/types/CadernoTypes.ts`), com fallback tolerante para
`Outro`. Parse que falha não derruba a UI: o registro é rebaixado a `Outro`.

## Caminhos de escrita

| Origem | Caminho |
| --- | --- |
| WhatsApp | [[pmo-bot-go]] → RPC `rpc_registrar_operacao_campo` |
| PWA online | `create_caderno_registro` / `create_limpeza_registro` |
| PWA offline | fila `offline-sync-queue` → [[motor-de-sincronizacao-offline]] |

## Relações

- N:N [[canteiro]] via `caderno_campo_canteiros`.
- 1:N [[lote-de-rastreabilidade]] (colheita gera lote).
- Recebe rateio de custo via `transacao_alocacoes.caderno_campo_id`.
