# Technical Debt & Backlog

> Os débitos do backend Go vivem em `pmo-bot-go/docs/debitos_tecnicos.md` (IDs `DT-XX`), que
> se declara fonte única de verdade para aquele serviço — itens novos do bot entram lá, não aqui.
> Este arquivo guarda o que ainda não foi absorvido por aquele registro.

## [PMO Knowledge Ops] RAG Específico do Usuário Final
**Data:** 21/07/2026
**Status:** 📌 Pendente
**Descrição:**
A atual infraestrutura de ingestão e vetorização de documentos (`/api/v1/admin/knowledge/ingest`) foi construída exclusivamente para o painel de **Admin Global** (documentos que balizam as regras de toda a plataforma).

A antiga página (`/admin/conhecimento`) foi deletada pois era "código zumbi" (protegida pela rota de Admin, mas com lógica tentando ler o `pmo_id` do usuário).

**O que precisa ser construído para os Fazendeiros/PMOs:**
1. **Novo Endpoint (Go):** `/api/v1/user/knowledge/ingest`
   - Deve extrair o `pmo_id` do JWT/Sessão do usuário autenticado.
   - Deve aplicar **Cotas** (limite de uploads com base na *tier* do plano: Free vs Pro).
2. **Nova Tela (Frontend):** `/propriedade?tab=knowledge` ou similar.
   - Componente para o usuário final fazer upload de suas cartilhas de plantio pessoais, análises de solo, etc.
   - Mostrar apenas os `ingestion_jobs` atrelados ao seu próprio `pmo_id`.

**Objetivo Final:** Quando o usuário falar com o Bot, a *similarity search* (busca vetorial no Supabase) deve usar como contexto os documentos globais (Admin) **MAIS** os documentos atrelados ao seu PMO.
