# Estratégia de PWA e Offline-First: ManejoORG Mobile

Este documento descreve o blueprint arquitetural para transformar o ManejoORG em uma aplicação resiliente a falhas de conexão, otimizada para o uso no campo (offline ou 3G instável).

---

## 1. Estratégia de App Shell e Atualizações

### Configuração do Workbox (Vite PWA)
- **Cache de Ativos Estáticos:** O `vite-plugin-pwa` deve capturar todo o bundle gerado (`index.html`, `js`, `css`, fontes e ícones).
- **Runtime Caching:** Implementaremos cache para as fontes do Google (já configurado) e para os mapas (MapLibre/Mapbox) usando uma estratégia de `Stale-While-Revalidate` ou `Cache-First` para tiles de satélite já visualizados.
- **Update Strategy (`registerType`):** 
    - Atualmente configurado como `autoUpdate`. 
    - **Recomendação:** Manter `autoUpdate` para garantir que o produtor sempre tenha as correções mais recentes sem precisar de intervenção manual. O Workbox fará o download em background e aplicará na próxima recarga.

## 2. O Desafio dos Dados Offline (Read & Write)

### Leitura (Read): Cache Seletivo da "Safra Atual"
Para garantir que o produtor consiga visualizar dados sem internet, utilizaremos o **IndexedDB** como uma camada de projeção local:
- **Escopo:** Sincronizaremos apenas a "Safra Atual" (últimos 6 meses de Diário de Campo e Financeiro) + Estrutura da Propriedade (Talhões).
- **Trigger de Sincronização:** Toda vez que a aplicação iniciar online ou após um login bem-sucedido, um processo de "Warm-up" popula as tabelas do IndexedDB.
- **Hooks de Consumo:** Os hooks de dados (ex: `useFieldDiary`) devem tentar ler do IndexedDB se a rede falhar ou se os dados ainda não estiverem no cache de memória (Zustand).

### Escrita (Write): Fila de Sincronização Unificada
Implementaremos um padrão de "Optimistic Updates" com persistência:
1. **Fila Local:** Toda mutação (Insert/Update) é salva primeiro no `SYNC_QUEUE_STORE` do IndexedDB com um `status: 'pending'`.
2. **UI Otimista:** A interface reflete a mudança imediatamente usando IDs temporários (`offline_...`).
3. **Motor de Sincronização (`useSyncEngine`):** 
    - Escuta eventos `online` do navegador.
    - Processa a fila seguindo a estratégia **Last-Write-Wins (LWW)**, utilizando o `updated_at` gerado no dispositivo para resolver conflitos simples no Supabase.
    - Utiliza **Backoff Exponencial** em caso de falhas intermitentes (ex: 504 Gateway Timeout).

## 3. Autenticação (Supabase Auth)

### Comportamento em Campo
- **Persistência do Token:** O Supabase JS armazena o token no `localStorage` por padrão. Isso permite que o `<RouteGuard>` valide a sessão localmente e renderize a UI cacheada mesmo sem sinal.
- **Regra de Ouro: Escrita Livre, Sincronização Protegida:**
    - Se o usuário estiver offline e o token expirar, permitimos que ele continue trabalhando e registrando dados na fila local.
    - **Ponto de Bloqueio:** O `useSyncEngine` interceptará erros `401 Unauthorized` durante a tentativa de sync.
    - **Ação:** Se um 401 ocorrer, a sincronização é pausada, os dados offline permanecem seguros na fila, e um aviso visual solicita que o usuário faça login assim que recuperar o sinal. Nenhuma tentativa de escrita local é bloqueada.

## 4. Mapa de Implementação (Gap Analysis)

| Componente | Status Atual | Ação Necessária |
| :--- | :--- | :--- |
| **Vite Config** | Configurado | Ajustar `SW` para incluir assets de assets de assets/fontes específicos. |
| **IndexedDB (localDb)** | Implementado | Expandir stores para suportar `FINANCEIRO_SAVE`. |
| **useSyncEngine** | Implementado | Adicionar handler específico para erro `401` (Unauthorized) para pausar a fila. |
| **useAuthContext** | Implementado | Garantir que o estado `isLoading` não bloqueie a renderização offline por timeout de rede. |
| **Lazy Loading Dados** | Não implementado | Criar o serviço de "Hydration" local para a safra atual (6 meses). |

---

**Assinado:**
Arquiteto Frontend Sênior - ManejoORG App
🚜💨📡📝
