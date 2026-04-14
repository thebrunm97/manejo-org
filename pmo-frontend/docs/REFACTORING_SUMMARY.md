# 📘 Relatório de Refatoração Arquitetural: Preparação Mobile

**Data:** 19/01/2026
**Objetivo:** Desacoplar Regras de Negócio da Interface Visual (MUI) para viabilizar futura migração para React Native.
**Status:** ✅ Concluído

## 🏗️ A Nova Arquitetura (Clean Architecture)

Saímos de uma estrutura monolítica (onde o componente fazia tudo) para uma arquitetura em 4 Camadas, facilitando testes e reutilização.

### 1. Camada de Domínio (`src/domain/`)
**Responsabilidade:** Lógica pura, cálculos matemáticos e tipos. Zero dependências de React ou Backend.

**Exemplos:**
*   `geoUtils.ts`: Calcula área em hectares (GeoLib) sem depender do Leaflet.
*   `pmoTransformers.ts`: Limpa e valida dados do formulário antes do envio.

### 2. Camada de Infraestrutura & Serviços (`src/services/`)
**Responsabilidade:** Comunicação com o mundo externo (Supabase, APIs, Storage).

**Mobile-Ready:**
*   **Storage:** Migrado de localStorage (síncrono) para `IStorageProvider` (assíncrono/Promise), pronto para AsyncStorage.
*   **API:** `weatherService` e `dashboardService` isolam chamadas externas.
*   **Mídia:** `IMediaPicker` abstrai a diferença entre `<input type="file">` (Web) e Câmera Nativa (Mobile).

### 3. Camada de Aplicação (Hooks) (`src/hooks/`)
**Responsabilidade:** O "Cérebro" do React. Gerencia estado, efeitos e orquestra chamadas aos serviços.

**Benefício:** Um componente Mobile poderá usar `usePmoFormLogic()` exatamente como a Web usa, compartilhando 100% da regra de negócio.

**Hooks Criados:**
*   `usePmoFormLogic`: Gerencia o formulário gigante de 19 seções.
*   `usePlanosListLogic`: Gerencia listagem, delete e ativação de PMOs.
*   `useTalhaoManager`: Gerencia a criação de polígonos no mapa.
*   `useMediaManager`: Gerencia upload de fotos e documentos.
*   `useDashboardLogic`: Carregamento paralelo de métricas.

### 4. Camada de Apresentação (View) (`src/pages/` e `src/components/`)
**Responsabilidade:** Apenas renderizar (MUI) e capturar eventos do usuário.
**Estado:** Componentes agora são "Dumb" (Burros/Declarativos). Não fazem fetch nem cálculos complexos.

### 5. Navegação & Roteamento (Adapter Pattern)
**Problema:** Dependência de strings mágicas (`/pmo/:id`) e acoplamento direto com `react-router-dom`, incompatível com Mobile (`Stack.Navigator`).
**Solução:** Implementação de **Named Routes** e um **Hook Adaptador**.

**Arquivos Chave:**
*   `src/routes/routeNames.ts` (Dicionário de Telas e Tipos).
*   `src/hooks/navigation/useAppNavigation.ts` (Abstração da navegação).
*   `src/routes/RouteGuard.tsx` (Proteção de rotas centralizada).

**Exemplo de Código (Antes vs Depois):**
*   *Antes:* `navigate('/pmo/' + id)`
*   *Depois:* `navigateTo(SCREENS.PMO_EDITOR, { pmoId: id })`

## 📊 Resumo das Alterações Críticas

| Arquivo Original (Problema) | Status | Solução Aplicada | Ganho Mobile |
| :--- | :--- | :--- | :--- |
| `PmoFormPage.tsx` | ✅ | Extraído para `usePmoFormLogic` + `pmoTypes` | Formulário complexo portável. |
| `PlanosManejoList.tsx` | ✅ | Extraído para `usePlanosListLogic` | Listagem leve e rápida. |
| `SatelliteView.jsx` | ✅ | Extraído para `useTalhaoManager` + `geoUtils` | Cálculo de área idêntico no App. |
| `Secao18_MUI.tsx` | ✅ | Extraído para `useMediaManager` + `WebMediaPicker` | Upload via Câmera/Galeria facilitado. |
| `DashboardPage_MUI.tsx` | ✅ | Extraído para `useDashboardLogic` + `Promise.all` | Carregamento paralelo sem travar UI. |
| `App.tsx` / Roteamento | ✅ | **Adapter Pattern** (`useAppNavigation`) | **Rotas nomeadas compatíveis com React Native.** |

## 🚀 Próximos Passos (Backlog Futuro)

1.  **Backend/Infra:** Corrigir as Policies RLS do Supabase (profiles) para que os testes E2E passem.
2.  **Migração:** Iniciar projeto React Native (Expo) e importar a pasta `src/domain` e `src/services` para testar o compartilhamento de código.
