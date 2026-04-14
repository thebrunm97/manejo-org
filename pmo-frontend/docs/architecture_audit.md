# Auditoria de Arquitetura de Software (pmo-frontend)

**Data:** 10/01/2026
**Responsável:** Staff Engineer / Senior Architect Agent
**Filosofia:** "Choose Boring Technology" (Estabilidade e Manutenibilidade)

---

## 1. O Fator "Jenga" (Complexidade Híbrida)

### Análise
Uma varredura no diretório `src` revela uma mistura significativa de arquivos `.jsx` (Legado/JavaScript) e `.tsx` (Moderno/TypeScript).
*   **Proporção:** Aproximadamente 60% `.jsx` e 40% `.tsx` (estimativa baseada na lista de arquivos). Componentes críticos como `TabelaDinamica`, que parecem ter versões duplicadas ou híbridas (`TabelaDinamica.jsx` e `TabelaDinamica_MUI.tsx`), representam um risco elevado.
*   **Mistura de Paradigmas:** Componentes como `ManualRecordDialog.tsx` (Tipado) convivem com `PmoParaImpressao.jsx` (Não tipado), dificultando a garantia de contratos de dados confiáveis entre componentes pais e filhos.

### Risco: Alto
A co-existência de lógicas duplicadas (ex: suporte a "legacy unitSelector" em `TabelaDinamica_MUI.tsx`) cria uma superfície de bugs onde correções aplicadas em um arquivo podem ser esquecidas no outro. O componente `ManualRecordDialog.tsx` centraliza lógica excessiva de construção de payload (decisões baseadas em 4 abas diferentes) dentro da camada de visualização, violando o princípio de Separação de Responsabilidades.

### Anti-Patterns Detectados
*   **Lógica de Negócio na UI:** O método `executeSave` em `ManualRecordDialog.tsx` contém regras de negócio complexas (ex: "Se aba for 0, é Plantio e usa propriedades X, Y") que deveriam residir em uma camada de serviço ou domínio.
*   **State Mirroring:** O componente `FastTextField` implementa uma sincronização de estado interno complexa (`useEffect` observando `value` externo) para fins de performance, o que pode causar "race conditions" sutis de renderização se o pai atualizar props muito rapidamente.

---

## 2. O Fator "Spaghetti de Dados" (Fluxo de Estado)

### Análise
*   **Data Fetching:** O `cadernoService.ts` centraliza as chamadas, o que é um ponto positivo (Boa Prática). No entanto, a implementação interna frequentemente retorna `data as any[]`, anulando a segurança que o serviço deveria prover.
*   **Props Drilling:** Em fluxos de formulário complexos (`PmoFormPage`), há indícios de passagem profunda de props de configuração, embora o uso de componentes autônomos (Dialogs) mitigue parte do problema.

### Realtime
*   O uso de `supabase.channel` foi detectado em componentes de Dashboard. A ausência de um Contexto de Realtime centralizado (ex: `RealtimeProvider`) significa que múltiplos componentes podem estar abrindo sockets desnecessariamente ou falhando em fechar conexões ao desmontar (`useEffect` cleanup precisa ser rigoroso).

### Risco: Médio
A maior preocupação não é o *fetching* (que está centralizado), mas a tipagem frouxa do retorno (`any`), que contamina todo o fluxo de dados subsequente, forçando componentes de UI a fazerem verificações defensivas ou casts inseguros.

---

## 3. O Fator "Dependência Frágil" (UI & Libs)

### Análise
*   **Uso "Cru" do Material UI:** O arquivo `TabelaDinamica_MUI.tsx` importa dezenas de componentes do `@mui/material` diretamente. A renderização de inputs (`renderInputControl`) é feita _inline_ com lógica ad-hoc para `Select` e `TextField`.
*   **Fragilidade:** A lógica para lidar com valores "out-of-range" (valores legados que não estão mais na lista de opções) está hardcoded dentro dos componentes (ex: `renderUnitSelect` em `ManualRecordDialog.tsx`), em vez de encapsulada em um componente reutilizável robusto.

### Risco: Médio-Alto
Falta um componente `<SafeSelect />` padronizado. Se o MUI atualizar sua lógica de Select (como ocorreu recentemente com warnings de out-of-range), a correção precisará ser aplicada em múltiplos arquivos (`ManualRecordDialog`, `TabelaDinamica`, `DadosCadastrais`, etc.), aumentando o esforço de manutenção.

---

## 4. O Fator "Segurança de Tipos" (TypeScript & Zod)

### Análise
*   **Uso de `any`:** Disseminado.
    *   `cadernoService.ts`: `return (data as any[]) || [];`
    *   `HarvestTypes.ts`: `detalhes_tecnicos: any | null;`
    *   `TabelaDinamica_MUI.tsx`: `[key: string]: any;`
*   **Strings Mágicas:** O código está repleto de strings liberais como `'Plantio'`, `'Manejo'`, `'kg'`, `'ton'`. Elas são usadas tanto para lógica condicional (`if (tipo === 'Plantio')`) quanto para exibição. Um erro de digitação ('Plantio ' vs 'Plantio') causará falhas silenciosas.
*   **Validação:** Inexistente (Zero Zod). O sistema confia cegamente que o que vem do banco ou do input do usuário está correto. Conversões como `parseFloat(qtdColheita)` são feitas diretamente na UI sem validação de esquema robusta.

### Risco: Crítico
Esta é a maior vulnerabilidade arquitetural atual. A aplicação finge ser tipada, mas internamente opera como JavaScript puro com casts forçados. Refatorações futuras serão perigosas pois o compilador não conseguirá garantir a integridade dos dados de `detalhes_tecnicos`.

---

## CONCLUSÃO: Top 3 Prioridades de Refatoração

Com base na matriz **Impacto vs. Esforço**:

1.  **Blindagem de Tipos (TypeScript Strict Mode + Enums)**
    *   **Ação:** Eliminar `any` de `HarvestTypes` e `cadernoService`. Criar *Discriminated Unions* para `DetalhesTecnicos` (ex: `type Registro = RegistroPlantio | RegistroManejo`). Substituir strings mágicas por Enums (`ActivityType.PLANTIO`).
    *   **Porquê:** Bloqueia a maior parte dos bugs lógicos e permite refatorações seguras.

2.  **Extração de Lógica de Negócio (Custom Hooks)**
    *   **Ação:** Retirar toda a lógica de `executeSave` e validação do `ManualRecordDialog.tsx` e mover para um hook `useCadernoRegistro`. O Dialog deve apenas coletar dados e chamar `save(data)`.
    *   **Porquê:** Facilita testes unitários da lógica de negócio sem precisar montar componentes React complexos.

3.  **Padronização de Inputs (Design System Wrapper)**
    *   **Ação:** Criar componentes `<AppSelect />` e `<AppTextField />` que encapsulam o comportamento do Material UI e tratam automaticamente valores legados/inválidos e debouncing.
    *   **Porquê:** Resolve definitivamente os problemas de performance de digitação e os warnings de "out-of-range" em um único lugar.
