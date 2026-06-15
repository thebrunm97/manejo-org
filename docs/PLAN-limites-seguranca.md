# PLAN-limites-seguranca.md - Dashboard de Configurações de Segurança

Este documento detalha o plano de implementação para o "Dashboard de Configurações de Segurança" (Limites do Assistente Virtual) no frontend React (`pmo-frontend`) integrado à nova tabela do Supabase (`limites_seguranca`).

---

## Visão Geral (Overview)

O objetivo é criar uma interface administrativa onde donos de propriedades e administradores gerais possam visualizar e customizar os limites de segurança determinísticos utilizados pelo Avaliador Global (Guardrails) em Go. O fluxo deve prever a criação física da tabela no Supabase com segurança via RLS, a aba de "Limites do Assistente" na tela de perfil da propriedade, e a lógica de fallbacks automáticos se nenhum limite customizado for definido.

---

## Critérios de Sucesso

1. **Migração SQL DDL**: Criação do arquivo de migração `supabase/migrations/20260609_create_limites_seguranca.sql` definindo a tabela `limites_seguranca` com chaves estrangeiras adequadas (`pmo_id` e `propriedade_id` com exclusão em cascata) e chave primária composta.
2. **Políticas de Segurança (RLS)**: Leitura e escrita restritas estritamente para utilizadores com `profiles.role = 'admin'` ou onde `propriedades.user_id = auth.uid()`.
3. **Nova Aba de Navegação**: Aba "Limites do Assistente" adicionada reativamente em `PropertyProfilePage.tsx`.
4. **Formulário de Configuração**: Exibição dos inputs numéricos estilizados com Tailwind CSS com os limites de Transação Financeira (R$) e de Manejo (kg/L).
5. **Fallbacks Determinísticos**: Inputs inicializados com os valores padrão `50000.00` e `5000.00` caso a tabela não tenha registros para a propriedade ativa.
6. **Bloqueio de UI**: Inputs e botão de gravação desabilitados/ocultos com um aviso claro caso o utilizador conectado não seja administrador ou dono da propriedade.
7. **Salvamento (Upsert)**: Ação de salvar executando uma chamada de `upsert` no Supabase utilizando a chave composta `(propriedade_id, pmo_id)`.

---

## Arquitetura e Estrutura de Arquivos

```
manejo-org-app-clean/
├── supabase/
│   └── migrations/
│       └── 20260609_create_limites_seguranca.sql (NEW - Criação de tabela, RLS e triggers)
└── pmo-frontend/
    └── src/
        └── pages/
            └── PropertyProfilePage.tsx (MODIFY - Adição da aba, lógica de busca/salvamento e bloqueios)
```

---

## Proposta de Alterações

### Componente 1: Banco de Dados & Supabase Migrations

#### [NEW] [20260609_create_limites_seguranca.sql](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/supabase/migrations/20260609_create_limites_seguranca.sql)
* Criação da tabela `public.limites_seguranca` contendo:
  * `pmo_id` (bigint, FK para `public.pmos` ON DELETE CASCADE)
  * `propriedade_id` (bigint, FK para `public.propriedades` ON DELETE CASCADE)
  * `limite_transacao` (numeric(12, 2) NOT NULL DEFAULT 50000.00)
  * `limite_manejo` (numeric(12, 2) NOT NULL DEFAULT 5000.00)
  * `created_at` (timestamptz DEFAULT now())
  * `updated_at` (timestamptz DEFAULT now())
  * `PRIMARY KEY (propriedade_id, pmo_id)` para chave primária composta e unicidade garantida.
* Habilitação de Row Level Security (RLS).
* Definição de política de leitura (`SELECT`) e escrita (`ALL`) para:
  * Usuários com `role = 'admin'` na tabela `profiles`.
  * Donos da propriedade (`user_id` da tabela `propriedades` igual ao `auth.uid()`).
* Definição de trigger para sincronização de `updated_at`.

---

### Componente 2: Frontend React (`pmo-frontend`)

#### [MODIFY] [PropertyProfilePage.tsx](file:///c:/Users/brunn/Documents/PROGRAMACAO/manejo-org-app-clean/pmo-frontend/src/pages/PropertyProfilePage.tsx)
* Importação do cliente do Supabase:
  * `import { supabase } from '../supabaseClient';`
* Atualização do estado de aba ativa (`activeTab`) para incluir o tipo `'seguranca'`.
* Criação de novos estados de controle local:
  * `limiteTransacao` (number)
  * `limiteManejo` (number)
* Atualização do `loadData` no `useEffect`:
  * Fazer uma busca em `limites_seguranca` filtrando por `propriedade_id === currentPropriedade.id` e `pmo_id === pmoAtivoId`.
  * Se houver registro, preenche `limiteTransacao` e `limiteManejo`.
  * Se não houver, aplica os valores padrão (`50000` e `5000`).
* Adição da verificação de permissão de escrita/leitura na UI:
  * `const isAuthorized = role === 'admin' || (currentPropriedade && user && currentPropriedade.user_id === user.id);`
* Atualização do manipulador `handleSave`:
  * Se a aba ativa for `'seguranca'`, realiza o `.upsert()` na tabela `limites_seguranca` utilizando `{ propriedade_id, pmo_id, limite_transacao, limite_manejo }`.
  * Emite feedback de sucesso/erro via `toast`.
* Atualização da renderização do formulário:
  * Adicionar o botão "LIMITES DO ASSISTENTE" na barra de abas.
  * Renderizar a seção correspondente à aba `'seguranca'` com os inputs estilizados, labels explicativos e o alerta de permissão caso `isAuthorized` seja falso.
  * Alterar o texto do botão de submissão inferior para "Salvar Limites" se a aba ativa for `'seguranca'`.

---

## Plano de Verificação

### Testes Automatizados
* Após a execução, podemos validar a compilação do frontend:
  ```bash
  npm run build
  ```

### Verificação Manual
1. **Validação RLS (Acesso do Dono)**: Logar com a conta do dono da propriedade e garantir que os dados de limites são carregados e podem ser salvos com sucesso.
2. **Validação RLS (Acesso de Outros)**: Tentar visualizar a tela com uma conta sem privilégios sobre a propriedade e garantir que o formulário está travado em modo somente-leitura ou oculta as opções.
3. **Validação de Fallback**: Limpar o registro da propriedade ativa em `limites_seguranca` e verificar se a tela do frontend exibe os limites default de R$ 50.000,00 e 5.000 kg/L.
