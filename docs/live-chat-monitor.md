# Painel de Mensagens em Tempo Real (Live Chat Monitor)

Implementação de um painel administrativo no `pmo-frontend` para acompanhar as interações do bot com os produtores em tempo real, utilizando a infraestrutura do Supabase Realtime.

## Proposed Changes

### Database Config (Database Architect)

#### [NEW] [20260610_evolve_messages_table.sql](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/supabase/migrations/20260610_evolve_messages_table.sql)
Criar migração SQL contendo:
- Adição da coluna `phone` (text) para guardar o telefone de contato (remetente/destinatário do chat).
- Adição da coluna `content` (text) para armazenar o corpo do texto da mensagem.
- Adição da coluna `role` (text) com valor padrão `'user'` para separar mensagens do produtor ('user') e do bot ('assistant').
- Migração de dados legados do campo `source` para `content` caso existam.
- Habilitação do realtime para a tabela `messages` adicionando-a na publicação `supabase_realtime`: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`.
- Criação da View eficiente `view_conversas_recentes` para agrupar as últimas interações por telefone, incluindo cruzamento com a tabela `profiles` para obter o nome do produtor se disponível.

### Frontend Components (Frontend Specialist)

#### [MODIFY] [routeNames.ts](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/routes/routeNames.ts)
- Adicionar `LIVE_CHAT_MONITOR` em `SCREENS`.
- Mapear a rota no `RootStackParamList`.

#### [MODIFY] [useAppNavigation.ts](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/hooks/navigation/useAppNavigation.ts)
- Mapear a rota `/admin/chat` para `SCREENS.LIVE_CHAT_MONITOR`.

#### [MODIFY] [App.tsx](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/App.tsx)
- Adicionar importação dinâmica (lazy) da página `LiveChatMonitor`.
- Inserir a rota `/admin/chat` protegida por `AdminRoute`.

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/components/Sidebar.tsx)
- Adicionar a aba "Chat ao Vivo" no menu lateral para administradores (com ícone `MessageSquare` ou similar).

#### [NEW] [LiveChatMonitor.tsx](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/pages/admin/LiveChatMonitor.tsx)
Página administrativa construída sob as regras de design premium (sem Indigo/Purple, utilizando `agro-floresta`, `agro-creme` e `agro-ouro`):
- **Split-View Layout (Tailwind CSS)**:
  - **Coluna Esquerda**: Lista de conversas recentes (obtida a partir da View `view_conversas_recentes`). Mostra o nome do produtor (ou telefone formatado), última mensagem truncada e timestamp relativo.
  - **Coluna Direita**: Histórico de mensagens do chat selecionado. Balões diferenciados para `user` (fundo cinza claro/creme) e `assistant` (fundo `agro-floresta` com texto claro).
- **Supabase Realtime Subscription**:
  - Escutar eventos de inserção na tabela `messages` e atualizar dinamicamente o estado local (mensagens e lista de contatos).
  - Incluir animação de fade-in/slide-up na chegada de novas mensagens.

## Verification Plan

### Automated Tests
- Validar a compilação do TypeScript e execução do linter no frontend: `npm run lint` e `npx tsc --noEmit`.

### Manual Verification
- Testar o funcionamento do realtime inserindo mensagens de teste via SQL e observando a atualização automática na tela do LiveChatMonitor.
- Validar se o nome do perfil do produtor é exibido corretamente caso o telefone corresponda a um cadastro em `profiles`.
- Verificar se a navegação lateral direciona para a página e exibe a tag correspondente.
