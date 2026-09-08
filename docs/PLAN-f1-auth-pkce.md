# Project Plan: F1 Auth PKCE Migration (PLAN-f1-auth-pkce.md)

## Overview
**Goal:** Fix the technical debt F1. At present, the `OnboardingPage` intercepts a custom JWT via the `?token=` URL parameter and manually injects it using `supabase.auth.setSession()`. This is an anti-pattern as the token is leaked in browser history, referrers, and proxy logs. The goal is to migrate to a secure Custom Exchange Endpoint flow.

**Project Type:** WEB + BACKEND (Fullstack)

## 🛑 Socratic Gate (Resolved)

**1. Flow Strategy (Phone Authentication):**
✅ **Decisão:** Opção A (Custom Exchange Endpoint) com mitigações pesadas. O bot vai gerar um código opaco (opaque code) de uso único e a interface fará a troca segura (POST). Opção C descartada por não resolver o problema central. Opção B descartada pela alta fricção (digitação de OTP pelo produtor).

**2. Session Persistence:**
✅ **Decisão:** Sessão persistente. Produtores rurais precisam se manter logados sem atrito. Isso aumenta a criticalidade do código na URL (pois ele dá acesso a um refresh token duradouro), exigindo as proteções severas detalhadas nas Tasks abaixo.

**3. Tratamento de erro (Expired/Invalid):**
✅ **Decisão:** Falhas de autenticação na UI (código expirado ou inválido) orientarão o produtor a retornar ao WhatsApp e enviar um "Oi" para solicitar um novo link. Não haverá mecanismo de envio de link partindo da web.

---

## Success Criteria
- [ ] Nenhuma credencial de sessão de longa duração (JWT completo ou refresh token) transita na URL.
- [ ] O código de troca na URL é puramente opaco, de uso único, e expira em 10 minutos.
- [ ] O mecanismo de troca (`AuthCallback.tsx`) neutraliza crawlers/bots de preview de link do WhatsApp, exigindo interação do usuário para consumir o código de fato.
- [ ] Sessões são estabelecidas de forma segura (Persistent Session) na web sem expor a chave de longa duração no histórico do navegador.

## Tech Stack
- **Frontend:** React + Supabase JS Client
- **Backend:** Go + Supabase Admin API

## File Structure & Proposed Changes

### Component: Backend (pmo-bot-go)
#### [MODIFY] internal/state/onboarding.go
Atualizar a geração do `tokenURL` para gerar um código opaco criptograficamente seguro e inseri-lo na URL.
#### [NEW/MODIFY] internal/supabase/magiclink.go (ou novo arquivo de auth)
Implementar a geração do código (CSPRNG), o hash (SHA-256) e a gravação atômica no Supabase.
#### [NEW] API Endpoint (Go)
Criar rota (ex: `POST /api/v1/auth/exchange`) para validar o código e retornar a sessão do Supabase, aplicando rate-limiting.

### Component: Frontend (pmo-frontend)
#### [MODIFY] src/pages/OnboardingPage.tsx
Remover a lógica vulnerável de `URLSearchParams` token extraction e `supabase.auth.setSession`. A página só deve carregar se a sessão já existir.
#### [NEW] src/pages/AuthCallback.tsx
Página dedicada de "Landing" do link de onboarding. Apresenta uma tela "Pronto para começar?" com um botão "Entrar/Continuar" que, **ao ser clicado**, dispara o POST para trocar o código opaco pela sessão do Supabase.

---

## Task Breakdown

### 1. **Task:** Implementação do Motor de Códigos Opacos (Backend)
   - **Agent:** `backend-specialist`
   - **Skills:** `api-patterns`, `clean-code`, `database-design`
   - **Detalhes Técnicos:**
     - **Tabela e RLS:** Criar tabela `onboarding_tokens` com RLS habilitado. **Nenhuma política pública** será criada. Acesso estritamente via `service_role` key do backend (Princípio de Privilégio Mínimo).
     - **Geração:** Usar `crypto/rand` com alta entropia (mínimo 128 bits, ex: base64url de 24 bytes). NUNCA `math/rand`.
     - **Armazenamento Seguro:** Hashear o código (SHA-256) antes de armazenar na tabela.
     - **TTL:** Exatamente 10 minutos.
   - **Output:** Serviço de geração de códigos integrável ao fluxo do bot.
   - **Verify:** Códigos são persistidos como hashes. O endpoint anônimo da API não consegue ler a tabela.

### 2. **Task:** Rota de Troca (Auth Exchange Endpoint)
   - **Agent:** `backend-specialist`
   - **Skills:** `api-patterns`, `clean-code`
   - **Detalhes Técnicos:**
     - **Atomicidade:** Consumir o token usando: `UPDATE ... WHERE token_hash = $1 AND used = false AND expires_at > now() RETURNING user_id`.
     - **Rate Limiting:** Dupla camada: (1) 5 tentativas / IP / minuto; (2) 3 tentativas / `user_id` / 10 minutos (previne enumeração distribuída).
     - **Mecanismo de Emissão de Sessão (Decisão Crítica & Trade-offs):** 
       Para evitar que o backend Go armazene e assine o `JWT_SECRET` do Supabase manualmente, usaremos *Backend-driven Password Login*.
       1. O backend gera uma senha efêmera forte (32+ caracteres CSPRNG).
       2. Atualiza a senha do usuário via `admin.updateUserById(user_id, { password })` usando a `service_role`.
       3. Imediatamente faz `signInWithPassword({ phone, password })`.
       4. Supabase devolve uma sessão 100% real (com `access_token` e `refresh_token`).
       5. O backend encaminha essa sessão ao frontend e a descarta.
       
       > [!WARNING]
       > **Trade-offs Aceitos & Mitigações Obrigatórias:**
       > - **Sobrescrita Silenciosa de Senha:** Este mecanismo assume que o login primário é via WhatsApp e *destrói* qualquer senha que o produtor tivesse. Se no futuro um "login por senha" for adicionado, esse fluxo precisará ser repensado.
       > - **Falta de Atomicidade:** Se o passo 3 (`signInWithPassword`) falhar após o passo 2 (`updateUserById`), o usuário ficará com a senha zerada e sem sessão. **Mitigação:** O endpoint deve fazer *retry* automático local (ex: 2 tentativas) em caso de timeout. Falhas definitivas retornarão erro amigável ao frontend orientando a pedir novo link ao bot.
       > - **Rate Limiting:** Aplicar 5 tentativas por IP/minuto no endpoint de troca. (Nota de design: a exigência original de limite por `user_id` foi descartada porque o token possui 192 bits reais de entropia; o espaço de busca de 2^192 torna tentativas de força bruta distribuída inviáveis, eliminando a necessidade de rastreio por ID na camada de rede).
       > - **Risco de Vazamento em Logs:** A senha temporária trafega entre o backend e o Supabase. **Mitigação:** É terminantemente proibido registrar (logar) a senha temporária em qualquer nível (`DEBUG`, `INFO`, `ERROR`) ou payload HTTP de observabilidade.
       > - **CORS:** O endpoint Go exigirá configuração estrita de CORS, aceitando apenas a origem do `pmo-frontend` (`FRONTEND_URL` em prod, `localhost:5173` em dev), mitigando ataques cross-origin.
       > - **Semântica de Falha ("Fail Closed"):** Se o processo falhar (ex: crash ou timeout) *entre* o consumo do token e o sucesso do login, o token é considerado "queimado" permanentemente. O usuário ficará sem sessão e precisará solicitar um novo link via WhatsApp. Essa escolha sacrifica conveniência em favor de máxima segurança (garantindo que tokens parcialmente consumidos não fiquem órfãos ou reutilizáveis).
   - **Output:** Endpoint `/api/v1/auth/exchange` seguro, com CORS e rate limit.
   - **Verify:** Duas requisições simultâneas falham uma (race condition). CORS bloqueia domínios de terceiros.

### 3. **Task:** Landing Page Segura contra Link-Preview (Frontend)
   - **Agent:** `frontend-specialist`
   - **Skills:** `frontend-design`, `react-patterns`
   - **Detalhes Técnicos:**
     - Criar `AuthCallback.tsx`.
     - **Defesa Crawler:** Jamais fazer o POST no `useEffect`/`onMount`. Exigir que o produtor clique num botão ("Entrar/Continuar").
     - **Resiliência de Estado:** Se o usuário clicar, mas fechar a aba e voltar depois, o fluxo deve se manter consistente. Se a aba for fechada *antes* do clique, o código permanece válido (TTL 10min).
     - Em caso de falha (código expirado ou já usado), instruir: "Este link expirou. Mande um 'Oi' no WhatsApp para gerar um novo".
   - **Output:** Interface segura integrada com o endpoint Go.
     - *Nota Técnica:* O frontend obtém os tokens JWT (`access_token` e `refresh_token`) a partir da resposta HTTP POST. Em seguida, injeta a sessão no Supabase via `auth.setSession()`. Isso difere do fluxo original (e é seguro) pois os tokens vêm via TLS do backend, e não extraídos publicamente da URL.
   - **Verify:** O código na URL não expira só de acessar a página. Exige interação.

### 4. **Task:** Integração no Roteiro do Bot e Limpeza
   - **Agent:** `backend-specialist`
   - **Skills:** `clean-code`
   - **Detalhes Técnicos:** Atualizar `onboarding.go` para inserir o código opaco na mensagem do WhatsApp. Limpar a interceptação de `?token=` antiga em `OnboardingPage.tsx`.
   - **Output:** O sistema de onboarding rodando pela nova infraestrutura.
   - **Verify:** End-to-end (Bot manda WhatsApp -> Clica -> Botão Entrar -> Mapa carregado).

## Phase X: Verification Plan

### Automated Tests

#### Testes de Regressão de Segurança (Go) — `internal/api/auth_pkce_test.go`

| Teste | O que prova | Status |
|---|---|---|
| `TestAuthExchange_RaceCondition` | 5 goroutines concorrentes via TCP real (`httptest.NewServer` + `startGate`/`close()`) competem pelo mesmo código opaco. Exatamente 1 obtém HTTP 200; as outras 4 recebem HTTP 401. O mock do PostgREST usa `sync.Mutex` replicando a semântica de `UPDATE ... WHERE used = false RETURNING`. | ✅ Passou (3 execuções consecutivas, `-count=3`) |
| `TestAuthExchange_ExpiredToken` | Mock retorna `[]` (lista vazia), simulando token expirado/inválido no filtro `&used=eq.false&expires_at=gt.now()`. Handler responde 401 sem prosseguir para `UpdateUserPasswordAndLogin`. | ✅ Passou |

> [!WARNING]
> **Pendência de CI — Go Race Detector:** O comando `go test -race` não pôde ser executado neste ambiente por ausência de toolchain CGO/gcc no Windows. Data races em Go frequentemente não se manifestam em execuções funcionais normais — o race detector é a ferramenta específica para detectá-las. **Ação requerida antes de considerar a ausência de data races formalmente comprovada:** rodar `go test -race ./internal/api/` em um ambiente CI Linux com CGO habilitado.

- Run `python .agent/scripts/security_scan.py .` garantindo que o novo endpoint foi mapeado e não há vazamentos.
- `python .agent/scripts/lint_runner.py .`

### Manual Verification
1. **Teste de Link Preview:** Enviar link no WhatsApp, esperar a preview gerar, clicar no link, garantir que o código **não foi queimado** e o login tem sucesso.
   - *Contexto:* Com Evolution API (gateway não-oficial), o pre-fetch do OpenGraph é executado pelo app cliente do destinatário, não por um servidor da Meta. A mitigação (exigir clique) é idêntica, mas o teste só é válido com dispositivo físico real recebendo a mensagem.
   - *Resultado Esperado:* Prévia gerada (pelo app cliente do WhatsApp), aba abre, usuário clica em "Entrar", sessão autenticada. Código **não queimado** antes do clique.
   - *Status:* [AGUARDANDO TESTE FÍSICO MANUAL — requer dispositivo real com WhatsApp]
2. **Teste de Race Condition:** Coberto pelo teste automatizado `TestAuthExchange_RaceCondition` acima. Pendente: revalidar com `-race` em CI Linux.
3. **Teste de Persistência Abortada:** Abrir o link, ver o botão "Continuar", fechar a aba inteira. Reabrir o link novamente a partir do WhatsApp. O link deve continuar válido, provando que não há consumo precoce.
4. **Teste de Expiração:** Coberto pelo teste automatizado `TestAuthExchange_ExpiredToken` acima. Tentar usar um link gerado há mais de 10 minutos (deve falhar amigavelmente).

---

## Estado de Fechamento das Tasks

| Componente | Status de Revisão Técnica | Pendências Abertas |
|---|---|---|
| **Task 1 & 2 — Backend** (atomicidade, TTL, rate limit, CORS, zero-log) | ✅ Validado por revisão de código + testes automatizados | `go test -race` pendente em CI Linux |
| **Task 3 — Frontend** (`AuthCallback.tsx`, defesa crawler, `setSession` seguro) | ✅ Validado por revisão de código | Nenhuma |
| **Task 4 — Integração Bot** (`onboarding.go`, limpeza `OnboardingPage.tsx`) | ✅ Validado por revisão de código | Nenhuma |
| **Comportamento real do WhatsApp/Evolution** | ⏳ Não verificável por análise estática | Teste físico manual pendente (sem previsão)
