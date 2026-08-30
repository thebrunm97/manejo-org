# Decisões de Engenharia & Arquitetura

Este documento detalha as principais decisões arquiteturais, padrões de resiliência e abordagens de alta performance aplicadas no Manejo Orgânico (PMO Bot). O objetivo é garantir um sistema corporativo robusto, tolerante a falhas e com interface ultra-responsiva.

## 1. Arquitetura do Mapa (GIS & WebGL)

A renderização e interação com talhões são críticas para a experiência offline-first no campo.

### 1.1 Separação de Responsabilidades (Shell vs Inner)
O componente `FarmMap.tsx` foi dividido arquiteturalmente para isolar o ciclo de vida do contexto de mapas do ciclo de vida React:
- **`FarmMap` (Shell)**: Envolve o mapa com um `<MapProvider>`, gerenciando apenas o contêiner externo.
- **`FarmMapInner`**: Lida com a reatividade profunda e interação direta com a instância do MapLibre GL JS, recebendo acesso seguro e unificado ao objeto do mapa.

### 1.2 Performance Extrema (Zero Re-renders em Interações)
Para garantir feedback visual instantâneo (60fps) e evitar engasgos em dispositivos móveis menos potentes, decidimos **eliminar re-renders do React** durante interações de hover e seleção de talhões.
- Em vez de alterar um estado React `selectedId` e repassar propriedades de estilo que recriam as `Layers`, utilizamos o método nativo da GPU do MapLibre: `map.setFeatureState`.
- O cursor e os estados de hover (`setHover`, `commitSelection`) são mutados cirurgicamente utilizando os IDs das features.
- Guardrails como o `setCursorSafe` previnem atualizações redundantes do cursor.

### 1.3 Guard Clauses Geográficos
A engine WebGL pode sofrer *crash* completo se alimentada com coordenadas inválidas (NaN) ou malformadas.
No `MapController`, implementamos rotinas estritas (ex: helper `isValidCoord` usando `Number.isFinite`) que inspecionam o `centerOfMass` e caixas delimitadoras (`fitBounds`) antes de qualquer movimentação da câmera, garantindo que coordenadas corrompidas no banco de dados não quebrem o dashboard.

---

## 2. Integração e Tooling (MCP / Supabase)

O ecossistema utiliza agentes LLM com acesso dinâmico ao banco de dados via Model Context Protocol (MCP).

### 2.1 Conflito de Configuração em Nuvem (`mcp.json` vs `.env.local`)
O MCP nativo `supabase` usa uma arquitetura híbrida (HTTP + OAuth em `mcp.supabase.com`). Devido ao comportamento padrão do VS Code de sincronizar a lista de MCP servers, configurações locais injetando variáveis de ambiente seguras (`SUPABASE_ACCESS_TOKEN`) frequentemente eram sobrescritas após reinicializações.

### 2.2 Workaround Definitivo (`supabase-local`)
- **Transporte `stdio`**: Evitamos o uso da ferramenta built-in nomeando nosso servidor customizado de `supabase-local`.
- **Comando Direto via `npx`**: Chamamos diretamente `@supabase/mcp-server-supabase` informando `--project-ref` e `--features`, acoplando o token via variável de ambiente.
- Isso garante consistência offline, imunidade a resets de nuvem e estabilidade ininterrupta para que o Agente consiga visualizar o banco, rodar migrações e inspecionar schemas de maneira confiável.

---

## 3. Padrões de Interface (UI Components)

As interfaces do produtor rural (PWA) priorizam máxima clareza e hierarquia visual, usando micro-alinhamentos para refinamento estético.

### 3.1 Micro-alinhamentos em Cards de Métricas (`HarvestDashboard`)
Para evitar desalinhamentos grotescos entre valores numéricos gigantes (ex: "1.240") e suas respectivas unidades métricas (ex: "kg", "ha"), padronizamos o contêiner flexível dos valores:
- `flex items-baseline`: Garante que a linha de base da tipografia do número (maior) e da unidade (menor) coincidam perfeitamente.
- `gap-1.5 flex-nowrap min-w-0`: Impede quebras de layout descontroladas e assegura um visual coeso e corporativo sem envolver grids complexas.

---

## 4. Resiliência do Orquestrador (Backend Go)

O roteador de inteligência ("Cérebro") requer blindagem máxima contra recursões infinitas e comportamentos não determinísticos da LLM.

### 4.1 Deterministic Guardrails
- Criamos defesas profundas (`internal/guardrails/business.go` e etc) que rejeitam, em tempo constante, intenções prejudiciais ou transições de estado incorretas (ex: requisição de finanças enquanto no meio de um fluxo de adubação vital).
- **FSM Fail-safes:** A Máquina de Estados Finita (FSM) que governa o diálogo com o produtor conta com limites rígidos (timeouts, tentativas máximas de chamadas de ferramentas e fallbacks automáticos) e auditoria de log no Supabase (transparência).
- Essas adições (presentes a partir dos commits recentes de segurança e FSM) blindam o loop principal e asseguram confiabilidade "Enterprise-grade".
