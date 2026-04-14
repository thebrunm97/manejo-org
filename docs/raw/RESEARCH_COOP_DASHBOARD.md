# RESEARCH_COOP_DASHBOARD.md - Torre de Controlo B2B

## 1. Mapeamento do Banco de Dados (Schema)

A estrutura atual permite a vinculação robusta entre cooperativas e produtores, mas requer joins precisos para agregação de dados.

### 1.1 Tabelas de Organização
- **`organizacoes`**: 
    - `id` (bigint): Chave primária.
    - `nome` (text), `cnpj` (text, unique), `tipo` (cooperativa, associacao, etc.).
- **`organizacao_membros`**:
    - `organizacao_id` (bigint) -> `organizacoes.id`.
    - `propriedade_id` (bigint) -> `propriedades.id`.
    - `role` (text): Define se é 'membro' ou 'gestor'. Atualmente vazio, mas fundamental para a Torre de Controlo.

### 1.2 Hierarquia Propriedade -> Talhão
- **Propriedade**: `public.propriedades` possui a coluna **`area_total_ha`** (numeric), usada para a visão macro (ex: "A Cooperativa possui 10.000 ha vinculados").
- **Talhão**: `public.talhoes` possui **`area_ha`** (numeric), usada para a visão operacional (ex: "Temos 500 ha de Milho plantados no grupo").
- **Vinculação**: `talhoes.propriedade_id` -> `propriedades.id`.

### 1.3 Rastreio de Produção (Colheitas)
- **Fonte Principal**: `public.caderno_campo`.
- **Joins**: Filtraremos por `tipo_atividade` IN ('COLHEITA', 'Colheita') e faremos o JOIN com `propriedades` via `propriedade_id`.
- **Colunas Chave**:
    - `quantidade_valor` (numeric): Volume colhido.
    - `quantidade_unidade` (text): Unidade (sacas, kg, ton).
    - `produto` (text): Nome da cultura colhida.
- **Previsão**: Consultaremos `pmo_culturas.estimativa_colheita` (text) e `ciclos_cultivo.data_colheita_prevista` para gerar o forecast do dashboard.

---

## 2. Segurança e Permissões (RLS)

- **Identificação do Gestor**: A permissão será baseada na coluna `role` da tabela `organizacao_membros`.
- **Lógica RLS Sugerida**:
    - Precisamos de uma política que permita `SELECT` em `talhoes` e `caderno_campo` se existir uma entrada em `organizacao_membros` relacionando o `auth.uid()` (através de suas propriedades) a uma organização onde ele seja 'gestor'.
    - *Nota:* Dado que a performance de RLS com subqueries recursivas pode ser lenta, a futura RPC de agregação deverá usar `SECURITY DEFINER` com filtragem manual baseada em `organizacao_id` para garantir velocidade e segurança.

---

## 3. Mapeamento do Frontend

### 3.1 Estrutura de Rotas
- **Páginas Atuais**: `/coop/organizacoes` (Lista) e `/coop/organizacoes/:id` (Gestão de Vínculos).
- **Injeção**: A nova rota será **`/coop/dashboard`** (ou `/coop/organizacoes/:id/dashboard`).
- **Nomes de Tela (`routeNames.ts`)**: Adicionar `COOP_DASHBOARD`.

### 3.2 Componentização e Layout
- **Layout**: Usaremos o `DashboardLayout`. O `Sidebar` será atualizado para exibir o menu "Torre de Controlo" apenas para usuários que possuam `role = 'gestor'` em alguma organização.
- **Estrutura de Pastas**:
    - `src/pages/coop/CoopDashboard.tsx`
    - `src/components/Coop/StatCards.tsx`
    - `src/components/Coop/ProductionChart.tsx`
    - `src/hooks/coop/useCoopStats.ts`

---

## 4. Blueprint da RPC de Agregação

Para alimentar a interface com performance, criaremos a RPC `get_coop_dashboard_stats(p_organizacao_id)` que retornará um JSON:

```json
{
  "total_membros": 45,
  "area_total_vinculada": 1250.5,
  "area_cultivada_por_cultura": [
    { "cultura": "Milho", "area": 800 },
    { "cultura": "Soja", "area": 450.5 }
  ],
  "volume_colheita_estimado": [
    { "cultura": "Milho", "volume": 12000, "unidade": "Sacas" }
  ],
  "producao_recente": [ ...últimos 5 registros do caderno_campo de membros... ]
}
```

---

## 5. Próximos Passos (Draft)
1. Criar a página base `CoopDashboard.tsx`.
2. Implementar a RPC no PostgreSQL.
3. Adicionar o link no `Sidebar` dinamicamente.
