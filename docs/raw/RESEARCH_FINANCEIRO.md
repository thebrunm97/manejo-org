# RESEARCH_FINANCEIRO.md - Motor Analítico (DRE & Talhões)

Este documento estabelece o blueprint estratégico para a implementação do Dashboard Financeiro B2C, com foco em performance, precisão matemática e escalabilidade mobile-first.

## 1. Estratégia de Agregação de Dados

### Proposta: Abordagem "Fat Database" (RPCs no Supabase)
Diferente da abordagem tradicional de trazer transações brutas para o frontend, propomos o uso de **PostgreSQL Functions (RPCs)** para o processamento pesado.

**Por que RPCs?**
- **Payload Reduzido**: Em vez de baixar milhares de linhas de `transacoes_financeiras`, o frontend recebe apenas o resumo agregado (ex: 12 meses de DRE).
- **Consistência Matemática**: A lógica de soma e arredondamento reside no banco, garantindo que o DRE na web seja idêntico ao do mobile.
- **Mobile-First**: Menos processamento na CPU do dispositivo do usuário e menor consumo de bateria/dados.

**RPCs Recomendados:**
1. `get_dre_mensal(p_propriedade_id, p_ano)`: Retorna agregações de Receita, Despesa e Lucro por mês.
2. `get_lucro_por_talhao(p_propriedade_id, p_safra)`: Retorna o resultado líquido de cada talhão baseado em `transacao_alocacoes`.

---

## 2. O Desafio do Rateio (Edge Cases)

### Despesas "Globais" vs "Diretas"
O sistema utiliza a tabela `transacao_alocacoes` para vincular despesas a talhões. No entanto, despesas como "Conta de Luz" ou "Manutenção da Sede" não possuem um `talhao_id` natural.

**Estratégia de Tratamento:**
- **Exibição no DRE**: Serão listadas como "Despesas Administrativas/Fixas" fora da visão de talhão.
- **Cálculo de Lucro Real por Talhão**:
    - **Opção A (Recomendada)**: Rateio Proporcional por Área. A despesa global é dividida entre os talhões ativos com base no seu percentual de área (hectares) sobre o total da fazenda.
    - **Opção B**: Manter como "Margem de Contribuição". O talhão mostra apenas despesas diretas, e as globais são abatidas apenas no resultado final da fazenda.
    
> [!NOTE]
> Sugerimos a **Opção A** para automação total, mas com transparência na UI indicando o "Custo Rateado".

---

## 3. Estrutura de Dados para Recharts

### Gráfico de Barras Duplo (DRE Mensal)
O componente `BarChart` do `recharts` consumirá o seguinte formato:

```typescript
interface DREMonthlyData {
  mes: string;       // "Jan", "Fev"... ou "2024-01"
  receitas: number;
  despesas: number;
  lucro: number;
}
```

### Gráfico de Pizza (Resultado por Talhão)
```typescript
interface ProfitByTalhao {
  name: string;      // Nome do Talhão
  value: number;     // Valor em Reais
  fill: string;      // Cor do talhão (vinda de public.talhoes.cor)
}
```

### Lidando com "Meses Vazios"
Para evitar que o gráfico "pule" meses sem transações, a RPC do Postgres deve utilizar um `generate_series` para garantir que todos os 12 meses do ano sejam retornados, preenchendo com `0` onde não houver dados. Isso evita lógica complexa de preenchimento no frontend.

---

## 4. Próximos Passos
1. Aprovação deste Blueprint pelo Tech Lead.
2. Criação das Migrations de RPC no Supabase.
3. Implementação dos Hooks de Dados (`useFinanceiroStats`) no Frontend.
4. Construção da UI com Recharts.
