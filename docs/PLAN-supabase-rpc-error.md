# /plan - Supabase RPC Silent Failure

## Contexto e Investigação
O usuário reportou que a "Compra de Adubo" (registrada na sessão via Bot com Múltiplas Intenções) confirmou sucesso no WhatsApp, mas não apareceu no **Dashboard Financeiro (DRE)**, retornando "Nenhuma transação encontrada".

### Causa Raiz Descoberta 🔍
A falha ocorreu devido a uma característica silenciosa do **PostgREST** (camada REST do Supabase):
1. O backend em Go foi atualizado na Fase 2 para enviar `valor_total_arg` e `alocacoes_talhoes_arg` no payload RPC.
2. No entanto, o script SQL de atualização (`20260607_fase2_ledger_rateio.sql`) **nunca foi executado no banco de dados em produção**.
3. Como o Supabase ignora parâmetros JSON adicionais não mapeados, ele processou a requisição usando a **RPC antiga** (`20260401000000_multi_modalidade.sql`).
4. A RPC antiga registrou o evento no `caderno_campo` com sucesso (retornando o `compra_id` que validou o fluxo no Go), mas ignorou totalmente a parte financeira (que não existia na versão antiga), causando um vazamento (vazio) no DRE.

---

## Proposed Changes (Plano de Resolução)

### 1. Atualizar RPC no Supabase (Banco de Dados)
Precisamos aplicar a migração que refatora a função para suportar o *split-billing* (rateio) financeiro.

#### [EXECUTE SQL] `supabase/migrations/20260607_fase2_ledger_rateio.sql`
A execução deste arquivo atualizará a `public.rpc_registrar_compra_insumo` para:
- Receber `valor_total_arg`, `alocacoes_talhoes_arg` e `categoria_nome_arg`.
- Registrar a despesa na tabela `transacoes_financeiras`.
- Fazer a iteração no JSONB do array e salvar o rateio proporcional na tabela `transacao_alocacoes`.

### 2. Sincronizar o Typescript do Frontend (Garantia)
Reverificar se o componente `useTransacoes.ts` já foi implantado com o *join* na tabela de alocações (fase planejada anteriormente).

---

## Verification Plan

### Teste Rápido no DRE
Após aplicar o SQL, faremos uma nova simulação enviando:
> *"Comprei 500 reais de calcário, dividindo pro Talhão 1 e Talhão 2"*

Verificaremos o Dashboard Financeiro para assegurar que a despesa de R$ 500 apareça rateada corretamente.
