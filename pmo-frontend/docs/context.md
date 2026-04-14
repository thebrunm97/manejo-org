# Contexto Mestre do Projeto (AgroVivo)

Este documento consolida a arquitetura, padrões e regras de negócio para manutenção e evolução do frontend. Deve ser utilizado como referência para entender o sistema híbrido (Legado + Moderno).

## 1. Tech Stack & Padrões (Non-Negotiables)
*   **Frontend:** React (Vite), Material UI (v5).
*   **Backend:** Supabase (PostgreSQL + Realtime).
*   **Linguagem:** Transição Híbrida (JSX Legado -> TSX Moderno). Novos componentes devem ser **TypeScript**.
*   **Gerenciamento de Estado:**
    *   *Simples:* Props drilling / State lifting.
    *   *Vivo:* Supabase Realtime para dados compartilhados (ex: Dashboard de Colheita).

## 2. Regras de Ouro (Aprendizados & Fixes)
1.  **Resiliência de UI (Selects):**
    *   Componentes de seleção (`Select`/`Autocomplete`) **DEVEM** implementar lógica de fallback.
    *   Se o valor vindo do banco não existir na lista fixa de opções, ele deve ser renderizado dinamicamente/manualmente para evitar erros "MUI: out-of-range value" ou componentes em branco.
2.  **Dashboards "Vivos" (Realtime):**
    *   Painéis de visualização (como `HarvestDashboard`) não devem depender apenas de `useEffect` com fetch único.
    *   **Obrigatório:** Assinar o canal `postgres_changes` (filtro por `pmo_id`) para refletir atualizações feitas em outros dispositivos instantaneamente.
3.  **Sincronização Pai-Filho:**
    *   O estado de "Última Atividade" ou indicadores de status devem ser elevados (*lifted*) para o orquestrador (`DashboardPageMUI`).
    *   Componentes filhos devem expor callbacks (ex: `onDataUpdate`) para notificar o pai sobre novos dados, garantindo consistência visual em toda a tela.
4.  **Imutabilidade & Auditoria de Edição:**
    *   A edição de registros (`ManualRecordDialog` em modo edição) **DEVE** exigir justificativa.
    *   O "Tipo de Atividade" (Plantio/Manejo/etc) é considerado imutável após criação.
    *   Justificativas são concatenadas no campo `observacao_original` com timestamp para fins de auditoria simples.

## 3. Mapa de Arquitetura
*   **Orquestrador (Pai):** `src/pages/DashboardPage_MUI.jsx`
    *   Gerencia o Layout, Autenticação e Estado Global da página (ex: data da última sincronização).
*   **Features Modernas (TSX):**
    *   `src/components/Dashboard/ManualRecordDialog.tsx`: Modal de entrada de dados (Create & Edit). Implementa fluxo de justificativa.
    *   `src/components/Dashboard/HarvestDashboard.tsx`: Componente de visualização. Implementa Realtime e "Lifting State Up".
*   **Núcleo Legado (JSX):**
    *   `src/components/Common/TabelaDinamica_MUI.jsx`: Renderiza listagens antigas e complexas. Código crítico que deve ser mantido funcional e protegido contra regressões.

## 4. Camada de Dados
*   **Tabela Principal:** `caderno_campo`
*   **Campos Chave:**
    *   `id` (uuid)
    *   `pmo_id` (numeric FK): Identificador do Plano de Manejo.
    *   `data_registro` (timestamp ISO): Data real da operação.
    *   `detalhes_tecnicos` (JSONB): Armazena dados flexíveis/não-estruturados.
*   **Service Layer:**
    *   Toda escrita ou leitura complexa deve passar por `src/services/cadernoService.ts`.
    *   Evitar chamadas diretas ao `supabase` em componentes para lógica de negócio repetitiva.
