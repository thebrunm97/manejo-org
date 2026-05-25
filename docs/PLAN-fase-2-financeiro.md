# Plano: Fase 2 - Módulo Financeiro

Este documento oficializa o fluxo de integração do backend Go e a Máquina de Estados (FSM) com as novas tabelas financeiras implementadas na Fase 1.

## Princípio Base de Segurança e RLS
**Toda execução de RPC deve ocorrer no contexto do usuário autenticado**. Para garantir que as políticas de Row Level Security (RLS) sejam estritamente aplicadas pelo PostgreSQL e não ignoradas pelas funções, adotamos obrigatoriamente a tag `SECURITY INVOKER` nas novas funções e na reescrita das funções operacionais.

## Fluxos de Integração

O registro de operações e transações ocorre de duas formas complementares.

### Cenário A: Registro Financeiro Puro
- **Gatilho:** O LLM identifica a intenção primária `REGISTRO_FINANCEIRO`.
- **Exemplo:** "Gastei R$ 500 no conserto do trator"
- **Fluxo Go:** `orchestrator.go` -> `handlers_financeiro.go` (`handleRegistroFinanceiro`)
- **Ação:** O Go processa o payload e aciona a RPC `rpc_registrar_transacao_com_rateio` passando o JSONB configurado com os dados da transação (valor, categoria, tipo, e alocações de talhão, se informadas).
- **Atomicidade:** A função PL/pgSQL insere os dados em `transacoes_financeiras` e itera sobre o array `alocacoes` inserindo os registros proporcionais em `transacao_alocacoes`. Se qualquer passo falhar (por exemplo, permissão negada pelo RLS), o PostgreSQL faz o *rollback* automático.

### Cenário B: Registro Operacional Híbrido (Manejo/Compra com Custos)
- **Gatilho:** O LLM processa uma intenção operacional (ex: Registro, Limpeza, Plantio, Colheita, Venda), e a extração contém a informação adicional de valor financeiro (`ValorTotal`).
- **Exemplo:** "Apliquei 10kg de adubo no talhão B e paguei R$ 150".
- **Fluxo Go:** `orchestrator.go` -> `handlers_manejo.go` (`finalizeRegistration`)
- **Ação:** As RPCs existentes (`rpc_registrar_operacao_campo` e `rpc_registrar_compra_insumo`) são chamadas como de costume. No entanto, o backend Go injeta a propriedade `valor_total` no JSON do payload.
- **Integração SQL:** Estas RPCs operacionais são alteradas. Após a criação primária no `caderno_campo`, as funções PL/pgSQL inspecionam o JSON. Se houver `valor_total`, processam o mapeamento (ex: inserindo em `transacoes_financeiras` com classificação como RECEITA/DESPESA e atribuindo uma categoria base) e vinculam 100% daquele valor ao `talhao_id` correspondente via `transacao_alocacoes`.

## Estratégia de Testes

A validação ocorrerá através de testes de integração em Go, contemplando:
1. Simulações que injetam custos em operações normais para testar a gravação transparente de registros financeiros.
2. Invocação direta da nova RPC para testar cenários de rateio onde múltiplos talhões estão envolvidos em uma única transação financeira.
