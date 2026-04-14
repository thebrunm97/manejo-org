# Estratégia de Sincronização Offline (ManejoORG)

**Versão da Estratégia:** 1.0 (MVP)
**Data:** 2026-02-18

Este documento descreve como o ManejoORG lida com a operação offline e a sincronização de dados quando a conexão é restabelecida.

## 1. Arquitetura "Offline-First"

O aplicativo utiliza uma abordagem híbrida:
*   **Leitura:** Tenta buscar dados do cache local (`idb`) primeiro. Se não encontrar, busca na API.
*   **Escrita:**
    *   **Online:** Envia diretamente para o Supabase. Se falhar, faz fallback para salvar no `idb` local.
    *   **Offline:** Salva diretamente no `idb` com um ID temporário (ex: `offline_1740001234`).

## 2. Mecanismo de Sync

Quando a conexão retorna (`window.onLine` event), o hook `useSync` (e seus derivados `usePmoFormLogic`, `useCadernoSync`) é acionado:

1.  **Iteração:** O sistema lê todos os registros pendentes no IndexedDB.
2.  **Identificação:**
    *   Registros com ID `offline_*` são tratados como **Criação** (`INSERT`).
    *   Registros com UUID válido são tratados como **Atualização** (`UPDATE`).
3.  **Envio:** O sistema tenta enviar um por um para o Supabase.
4.  **Limpeza:** Se o envio for bem-sucedido, o registro local é deletado. Se falhar, ele permanece no `idb` para a próxima tentativa.

## 3. Resolução de Conflitos (Client-Wins)

⚠️ **ATENÇÃO:** Atualmente, o sistema utiliza uma estratégia **"Client Wins" (O Cliente Ganha)** cega.

*   **Cenário:** O Produtor edita o PMO offline. O Consultor edita o mesmo PMO online.
*   **Resultado:** Quando o Produtor ficar online, o sistema enviará seus dados (`updatePmo`), **sobrescrevendo** as alterações feitas pelo Consultor no servidor.

### Riscos Conhecidos
*   Em ambientes multi-usuário (Produtor + Consultor editando simultaneamente), pode haver perda de dados do lado do servidor se o cliente offline tiver uma versão desatualizada.

### Mitigação Atual
*   O uso predominante é "Single User" (apenas o produtor ou apenas o consultor editando por vez).
*   Alertas visuais de "Sincronizando..." informam o usuário que dados estão sendo enviados.

## 4. Melhorias Futuras (Pós-MVP)

Para a Fase 3.0, planejamos implementar:
1.  **Verificação de `updated_at`:** O backend rejeita updates se o `updated_at` do cliente for menor que o do servidor.
2.  **Merge Inteligente:** Tentar mesclar campos JSONB em vez de substituir o objeto inteiro.
3.  **Interface de Conflito:** Perguntar ao usuário qual versão manter.
