# Produtor

Pessoa que opera a lavoura e responde pela conformidade orgânica. No banco,
é `auth.users` (identidade, gerida pelo Supabase Auth) espelhado em
`public.profiles` (dados de aplicação).

## `public.profiles`

`supabase/migrations/20260401_create_profiles.sql`

| Coluna | Papel |
| --- | --- |
| `id` UUID PK | FK para `auth.users(id)`, `ON DELETE CASCADE` |
| `nome`, `telefone` | Identificação; `telefone` é a chave de correlação com o WhatsApp |
| `role` | `user` \| `admin` \| `coop` (CHECK) |
| `pmo_ativo_id` | [[pmo]] em foco na sessão |
| `bonus_credits`, `bonus_expires_at` | Créditos de uso da IA |

Perfil é criado automaticamente no signup pelo trigger `handle_new_user`,
que lê `raw_user_meta_data`. `updated_at` é mantido por `handle_updated_at`.

## Por que `profiles` é fundacional

Praticamente toda policy RLS do projeto consulta `profiles` para checar
`role = 'admin'`. A migration é numerada para rodar antes de todas as
outras.

## Relações

- Possui N [[propriedade]] (`propriedades.user_id`).
- Assume cotas em [[demanda-coletiva]].
- É membro de [[organizacao]] através de suas propriedades.

## No frontend

`AuthContext` expõe `user`, `profile`, `isAdmin`, `currentPropriedade` e
`allPropriedades` — consumidos pelos guards em `pmo-frontend/src/routes/`.
