# supabase-postgres

O banco não é um depósito passivo: é onde mora a regra de negócio
(ADR-002 *Fat Database*, `docs/architecture/adr/002-fat-database.md`).
Diretório: `supabase/`.

## Estrutura

```
supabase/migrations/  ~60 migrations versionadas por data
supabase/rollbacks/   reversões
supabase/tests/       testes de banco
supabase/seed.sql     dados iniciais
supabase/config.toml  configuração do stack local
```

## Três pilares

**1. RLS em tudo.** Toda tabela de domínio tem
`ENABLE ROW LEVEL SECURITY` e policy ancorada em `auth.uid()`. Entidades
folha usam RLS indireta por subconsulta ([[canteiro]] via [[talhao]],
[[ciclo-de-cultivo]] via canteiro). A única exceção deliberada é a leitura
anônima do [[lote-de-rastreabilidade]].

**2. RPCs atômicas.** Operações multi-tabela são funções
`SECURITY DEFINER`, não sequências de `INSERT` do cliente. Exemplos:
`rpc_registrar_operacao_campo`, `rpc_registrar_transacao_com_rateio`,
`create_caderno_registro`, `complete_onboarding`, `rpc_update_propriedade`.
Isso garante atomicidade mesmo quando o chamador é o WhatsApp e a conexão
cai no meio.

**3. Extensões.** `pgvector` para o [[rag-e-base-de-conhecimento]];
tipos e extensões criados em `20260330_bootstrap_extensions_and_types.sql`,
incluindo `modalidade_producao_enum`.

## Ordem de migração importa

`20260401_create_profiles.sql` roda primeiro porque quase toda policy RLS
consulta `profiles.role`. Depois vêm as tabelas núcleo
(`20260402000000_create_core_app_tables.sql`), operacionais e de terceiros.

## Famílias de tabelas

| Família | Tabelas |
| --- | --- |
| Núcleo | `propriedades`, `pmos` (+ 9 filhas), `talhoes`, `canteiros`, `ciclos_cultivo`, `caderno_campo` |
| Coletivo | `organizacoes`, `organizacao_membros`, `demandas_coletivas`, `cotas_produtores` |
| Financeiro | `transacoes_financeiras`, `transacao_alocacoes`, `categorias_financeiras` |
| Conhecimento | `knowledge_documents`, `knowledge_chunks`, `farm_documents`, `rag_*` |
| Conversa | `messages`, `conversations`, `message_queue`, `processed_webhooks`, `raw_payloads` |
| Governança | `guardrail_events`, `hitl_pending`, `mutation_drafts`, `limites_seguranca`, `audios_audit` |
| WhatsApp | `whatsmeow_*`, `instances`, `lid_mappings` |

## Cuidados conhecidos

- `talhoes.geometry` é JSONB, não PostGIS — sem índice espacial.
- `pmos` guarda o formulário em `form_data` **e** normalizado nas filhas.
- Divergência de CHECK em [[transacao-financeira]].
- *Schema drift* corrigido em `caderno_campo_canteiros` — ver [[canteiro]].
