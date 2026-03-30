# ADR-002: Fat Database — Lógica de Negócio no PostgreSQL

## Status: Aceito

## Contexto
Operações de manejo orgânico envolvem múltiplas tabelas (talhões, canteiros, caderno_campo, etc) que devem ser atualizadas de forma atômica para garantir a integridade dos dados e o compliance da certificação.

## Decisão
Implementar a lógica de negócio pesada e transacional como **RPCs (funções PL/pgSQL)** diretamente no banco de dados (Supabase/Postgres), mantendo o backend Go apenas como uma camada fina de orquestração ("Thin Backend").

## Justificativa
- **Atomicidade**: Todas as mudanças relacionadas a uma operação de campo ocorrem em uma única transação no banco.
- **Consistência de Dados**: Evita que o estado do banco fique parcial se o backend cair no meio de um loop de salvamento.
- **Performance**: Elimina rount-trips excessivos entre o backend e o banco de dados para checagem de regras de negócio.
- **Segurança (RLS)**: Permite que políticas de Row Level Security sejam aplicadas com mais granularidade dentro de funções atômicas.

## Exemplos de RPCs Críticas
- `rpc_registrar_operacao_campo`: Processa registros de manejo de forma polimórfica.
- `criar_infraestrutura_pmo`: Configuração inicial de talhões e canteiros.
- `match_farm_documents`: Busca vetorial (pgvector) integrada na base.

## Consequências
- (+) Risco zero de inconsistência entre tabelas dependentes.
- (+) Backend Go muito mais simples, focado em chamadas de API e IA.
- (-) Lógica SQL é mais complexa de testar via unit tests.
- (-) Vendor lock-in parcial com o motor de banco de dados Postgres.
- **Mitigação**: As funções são escritas em SQL padrão, tornando a migração para outro provedor Postgres viável se necessário.
