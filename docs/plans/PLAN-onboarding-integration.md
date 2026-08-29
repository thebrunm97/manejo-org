# Planejamento: Integração do Onboarding Web com Backend e Supabase

## Overview
O objetivo é pegar o fluxo de onboarding criado no mockup do frontend (Perfil -> Culturas -> Modalidade -> Localização/Mapa) e torná-lo funcional. Isso significa conectá-lo ao banco de dados Supabase e integrá-lo ao fluxo do bot de WhatsApp em Go (`pmo-bot-go`).

## ✅ Decisões do Portão Socrático (Aprovado)
1. **Como o usuário chega na Web?** 
   - O bot recomendará o cadastro completo para maior precisão e benefícios, mas o fluxo web será independente (pode ser acessado pelo link com um token gerado pelo bot).
2. **Autenticação:**
   - Apenas token por hora (via URL, ex: `?token=XYZ`).
3. **Escopo do MVP:**
   - O fluxo web criará o Perfil e a Propriedade no banco.
   - Não será obrigatório ter um talhão de cara.
   - Será possível atrelar talhões criados no futuro (via WhatsApp/Chat) a polígonos reais cadastrados pela Web.
4. **Referência da Landing Page:**
   - A referência será a **Landing Page da ORTH (AskOrth)**, documentada no arquivo `askorth_reference.md`. Vamos puxar o conceito de "Value Proposition direta" (Seu Agrônomo IA 24/7), "How it works" simplificado em 3 passos sem sensores, e "Social Proof", mesclando isso com as visualizações ricas (Mockup WhatsApp + Dashboard) que já temos hoje.

## Project Type
**FULL STACK** (Web: `frontend-specialist`, Backend/DB: `backend-specialist`, Auth/Security: `security-auditor`)

## Success Criteria
- [ ] O fluxo do frontend envia os dados (Perfil, Culturas, Modalidade, Lat/Lng) para o Supabase com sucesso.
- [ ] O banco de dados armazena corretamente a modalidade a nível de **Talhão/Propriedade** e as preferências a nível de **Produtor/Perfil**, respeitando as decisões de arquitetura.
- [ ] O link entre o usuário do WhatsApp e o usuário do sistema Web funciona de forma segura.

## Tech Stack
- **Frontend:** React 19, Tailwind CSS, MapLibre GL, Supabase JS Client (`@supabase/supabase-js`).
- **Backend:** Supabase (PostgreSQL, RLS Policies), Go (`pmo-bot-go`).

## File Structure
Mudanças esperadas:
```text
pmo-frontend/
├── src/pages/Onboarding.tsx (versão real conectada ao DB)
├── src/lib/supabase.ts (cliente Supabase)
├── src/services/onboardingService.ts (lógica de inserção no banco)

pmo-bot-go/
├── internal/state/onboarding.go (ajuste no fluxo para enviar o link web)
├── internal/api/magiclink.go (geração de token seguro para a URL)
```

## Task Breakdown

### Task 1: Modelagem de Banco de Dados e RLS (Supabase)
- **Agent:** `backend-specialist` (ou `database-architect`) + `supabase-postgres-best-practices`
- **Ação:** Criar/atualizar as tabelas no Supabase:
  - `profiles` (role/perfil, culturas de interesse)
  - `properties` / `farms` (localização lat/lng capturada no mapa)
  - `plots` / `talhoes` (status da modalidade de cultivo)
- **Verificação:** Executar inserções manuais no psql/supabase studio com sucesso e validar RLS.

### Task 2: Geração de Link Seguro (Go Bot)
- **Agent:** `backend-specialist`
- **Ação:** Após o bot coletar o nome inicial, gerar um link de onboarding (ex: `/onboarding?token=XYZ`) usando um token JWT ou Auth nativo do Supabase (OTPLink) e enviar via WhatsApp.
- **Verificação:** O bot envia a mensagem correta com a URL formatada e o token válido.

### Task 3: Integração Frontend (Supabase Client)
- **Agent:** `frontend-specialist`
- **Ação:** Transformar `OnboardingPremiumMockupPage.tsx` na página oficial `Onboarding.tsx`. 
  - Conectar cada passo ao estado global ou form handler. 
  - A etapa de Localização salvará a Propriedade.
  - A etapa de Modalidade será salva como preferência do Produtor ou atrelada a um Talhão (se o usuário decidir criar um agora, mas será opcional).
  - No botão "Concluir", realizar as chamadas RPC ou Inserts no Supabase usando o token da URL.
- **Verificação:** Finalizar o fluxo na UI deve criar os registros corretos no Supabase.

### Task 4: Redesign da Landing Page (Fusão com Referência)
- **Agent:** `frontend-specialist`
- **Ação:** Refatorar `LandingPage.tsx` para incorporar a estética e os elementos da imagem de referência enviada pelo usuário, mesclando-os com as estruturas de alto valor já existentes (Animações de WhatsApp, Gráficos Financeiros, Bento Grid).
- **Verificação:** A página deve compilar corretamente, manter a responsividade e apresentar uma identidade visual coesa de acordo com a referência.

## ✅ Phase X: Verification
- [ ] Segurança: Validação do token/autenticação entre WhatsApp e Web (evitar IDOR, onde alguém edita o ID na URL).
- [ ] UX Audit: O frontend valida campos vazios e exibe loading no botão "Concluir".
- [ ] Teste E2E: Fluxo completo (Receber link no zap -> Abrir Web -> Preencher 4 passos -> Concluir -> Dados no banco).
- [ ] Conformidade: Modalidade salva no Talhão (não no perfil do produtor).
