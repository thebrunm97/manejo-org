# 📶 Offline Sync — Estratégia de Sincronização

O ManejoORG foi projetado para funcionar no "meio do mato", onde a conexão de internet é instável ou inexistente. A arquitetura **Offline-First** garante que nenhum dado de manejo seja perdido.

---

## 1. Stack Tecnológica Offline
O sistema utiliza o navegador como um "banco de dados local temporário" antes de enviar as informações para o Supabase.

| Tecnologia | Função |
|---|---|
| **IndexedDB** | Banco de dados NoSQL embarcado no navegador para armazenamento persistente de registros. |
| **`idb` (Library)** | Wrapper leve para facilitar o uso de Promises com IndexedDB. |
| **`useSyncEngine`** | Custom Hook global que monitora o status da rede e processa a fila de sincronização. |

---

## 2. Schema Local (`utils/db.ts`)
O banco de dados IndexedDB (`manejo-org-db`) possui as seguintes *Object Stores*:

- **`pending_pmo_data`:** Dados de formulários de Planos de Manejo que ainda não foram salvos no servidor.
- **`pending_caderno_data`:** Registros de atividades de campo (colheita, plantio, etc) capturados offline.
- **`sync_queue`:** Fila de operações atômicas (metadados das requisições pendentes).

---

## 3. Fluxo de Sincronização

### Passo 1: Captura (Salvamento Local)
Quando o usuário clica em "Salvar" e não há internet:
1. O sistema intercepta o erro de rede.
2. Os dados são serializados em JSON e salvos na store correspondente do IndexedDB.
3. Uma notificação amigável é exibida: *"Salvo localmente! Sincronização pendente."*

### Passo 2: Monitoramento (`useSyncEngine`)
O motor de sincronização roda globalmente no `App.tsx`:
1. Escuta o evento `window.addEventListener('online')`.
2. A cada **30 segundos**, caso o navegador esteja com `navigator.onLine = true`, ele verifica se há itens nas stores `pending_`.

### Passo 3: Reconciliação (Push to Cloud)
1. O `useSyncEngine` lê a fila de baixo para cima (ordem cronológica).
2. Tenta enviar cada registro para as RPCs do Supabase.
3. Se o servidor responder com sucesso (HTTP 200/201), o item é **deletado** do IndexedDB local.
4. Se o erro persistir, o item permanece na fila para a próxima tentativa (Backoff exponencial simplificado).

---

## 4. UI: Indicadores de Status
O usuário é informado sobre o estado da sua conexão através de ícones na `Sidebar` ou `Navbar`:

- **Ícone Verde (Cloud Check):** Sistema online e todos os dados sincronizados.
- **Ícone Âmbar (Refresh/Warning):** Existem registros "presos" no dispositivo aguardando internet.
- **Ícone Vermelho (Wifi Off):** O dispositivo está totalmente desconectado.

---

## 5. Cuidados e Limitações
- **Conflitos de Versão:** O sistema utiliza `last_modified_at` para garantir que dados mais antigos no servidor não sobreponham alterações locais recentes.
- **Limpeza de Cache:** Ao fazer *Logout*, por segurança, o IndexedDB local é limpo para evitar vazamento de dados entre diferentes usuários no mesmo dispositivo.
- **Tamanho do Arquivo:** Atualmente, apenas metadados e textos são sincronizados offline. Upload de imagens e áudios exige conexão ativa no momento do envio (futura melhoria).
