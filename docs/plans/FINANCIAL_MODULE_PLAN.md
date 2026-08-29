# FINANCIAL_MODULE_PLAN.md - Módulo Financeiro e de Custos

## 1. Modelagem de Dados (O Padrão Ledger)

Para separar o operacional do financeiro sem perder o vínculo técnico, utilizaremos um modelo de **Lançamento em Partida Simples com Rateio Direto**.

### 1.1 Novas Tabelas (Supabase)

```sql
-- Categorização para DRE e Fluxo de Caixa
CREATE TABLE public.categorias_financeiras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    tipo text NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    descricao text,
    created_at timestamptz DEFAULT now()
);

-- O Fato Financeiro (A Transação)
CREATE TABLE public.transacoes_financeiras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    propriedade_id bigint REFERENCES public.propriedades(id) ON DELETE CASCADE,
    pmo_id bigint REFERENCES public.pmos(id) ON DELETE SET NULL,
    categoria_id uuid REFERENCES public.categorias_financeiras(id),
    tipo text NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA')),
    valor_total numeric(12,2) NOT NULL,
    data_competencia date NOT NULL DEFAULT CURRENT_DATE,
    fornecedor_cliente text,
    nota_fiscal text,
    status_pagamento text DEFAULT 'PAGO' CHECK (status_pagamento IN ('PAGO', 'PENDENTE', 'PROGRAMADO')),
    observacao text,
    created_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id)
);

-- A Ponte de Rateio (Onde o Custo encontra o Talhão)
CREATE TABLE public.transacao_alocacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transacao_id uuid REFERENCES public.transacoes_financeiras(id) ON DELETE CASCADE,
    talhao_id bigint REFERENCES public.talhoes(id) ON DELETE CASCADE,
    caderno_campo_id uuid REFERENCES public.caderno_campo(id) ON DELETE SET NULL, -- Vínculo opcional com manejo
    valor_alocado numeric(12,2) NOT NULL,
    percentual_alocado numeric(5,2), -- Helper para UI
    created_at timestamptz DEFAULT now()
);
```

### 1.2 Estratégia de Transição (Soft-Deprecation)
- **Migração:** Criar um script SQL para mover dados das colunas `valor_total`, `nota_fiscal` e `fornecedor` do `caderno_campo` para as novas tabelas, gerando alocações automáticas de 100% para o talhão referenciado.
- **Abandono:** As colunas originais no `caderno_campo` serão marcadas como `deprecated` no comentário do banco e ocultadas na UI após a homologação da V1.

---

## 2. O Cérebro do Bot (Go + LLM)

O bot passará a suportar **Lançamentos Multi-Entidade**.

### 2.1 Evolução dos Prompts (Groq/Gemini)
- **Extração de Rateio:** O prompt será atualizado para identificar o padrão `[VALOR TOTAL] + [LISTA DE ALOCAÇÕES]`.
    - *Input:* "Comprei 1000 reais de ureia, joguei 600 no Talhão 1 e 400 no Talhão 2".
    - *JSON Esperado:*
      ```json
      {
        "intencao": "registro_financeiro",
        "valor_total": 1000,
        "alocacoes": [
          {"talhao": "TALHAO 1", "valor": 600},
          {"talhao": "TALHAO 2", "valor": 400}
        ]
      }
      ```
- **Novas Intenções:**
    - `IntentRegistroFinanceiro`: Foco em transações monetárias puras ou compras/vendas com rateio.
    - `IntentConsultaFinanceira`: Responde via RAG/SQL sobre custos (ex: "Qual meu lucro no tomate até agora?").

### 2.2 Alterações no `fsm.go`
- Inclusão de um novo estado `StateProcessandoRateio` caso a soma das alocações não bata com o valor total informado, solicitando correção ao usuário.

---

## 3. As RPCs de Inteligência (Supabase)

### 3.1 `rpc_registrar_transacao_com_rateio(payload JSON)`
Garante que a transação e suas **N** alocações sejam gravadas em um bloco atômico. Se o rateio falhar, nada é gravado.
- **Entrada:** `{ propriedade_id, categoria_id, tipo, valor_total, data, alocacoes: [{talhao_id, valor, caderno_id}] }`

### 3.2 `rpc_obter_dre_por_talhão(p_propriedade_id)`
Calcula a rentabilidade em tempo real.
- **Retorno:** Tabela com `[Talhao, ReceitaTotal, CustoInsumos, CustoMaoDeObra, MargemContribuicao, CustoHectare]`.

---

## 4. O Frontend (React)

### 4.1 Dashboard Financeiro (Visual Intelligence)
- **Widgets Bento-Style:** 
    - Card de "Saúde Financeira" (Receita vs Despesa do Ciclo).
    - Gráfico de pizza com a distribuição de custos por Talhão.
    - Indicador de "Custo de Produção por kg" (Custo Total / Qtd Colhida).

### 4.2 UI de Rateio Inteligente
- Uma interface onde, ao registrar uma despesa, o produtor pode clicar em "Ratear por Área" e o sistema distribui o valor automaticamente entre todos os talhões proporcionalmente ao tamanho (m²) de cada um.

---

## 5. Fases de Execução (Roadmap)

| Fase | Título | Entregável Principal |
| :--- | :--- | :--- |
| **01** | **Fundação de Dados** | Migrations das tabelas Ledger + Categorias Base. |
| **02** | **Cérebro Financeiro** | Update Prompts (Groq) + `fsm.go` para suporte a split-billing. |
| **03** | **Motor de Inteligência** | Implementação das RPCs de DRE e Rateio Atômico. |
| **04** | **Experiência Visual** | Dashboard Financeiro + UI de Lançamento no React. |
