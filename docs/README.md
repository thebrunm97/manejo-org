# 📚 Documentação Técnica — PMO Bot (ManejoORG)

Bem-vindo à central de documentação técnica do ecossistema ManejoORG. Este repositório contém as especificações, diagramas e guias para desenvolvedores e arquitetos do sistema.

---

## 🏗️ Arquitetura e Engenharia

Mergulhe nos princípios que sustentam a plataforma:

| Documento | Conteúdo |
|---|---|
| [**Visão Geral**](./architecture/overview.md) | Princípios de design, Tech Stack e Pilares. |
| [**Fluxos de Dados**](./architecture/data-flow.md) | Diagramas de sequência e fluxogramas do WhatsApp e Sync. |
| [**Finite State Machine (FSM)**](./backend/fsm.md) | Ciclo de vida da conversa e LoopGuard. |
| [**Agentes de IA**](./backend/agents.md) | Detalhamento dos Agentes Agronomist e DB Operator. |
| [**Compliance**](./backend/compliance.md) | Regras de blacklist e validação para certificação orgânica. |
| [**Decisões (ADRs)**](./architecture/adr/README.md) | Registro de decisões arquiteturais (Go, Fat DB, Offline, IA). |

---

## 🖥️ Frontend & UX

Como a interface PWA lida com a realidade do campo:

| Documento | Conteúdo |
|---|---|
| [**Páginas e Rotas**](./frontend/pages.md) | Mapa de caminhos e componentes principais. |
| [**Offline Sync**](./frontend/offline.md) | Estratégia de IndexedDB e Sincronização em background. |

---

## 🗄️ Database & Backend

A camada de persistência e lógica de servidor:

| Documento | Conteúdo |
|---|---|
| [**Schema do Banco**](./database/schema.md) | Diagrama ER, Tabelas principais e RLS. |
| [**Funções Postgres (RPCs)**](./database/rpcs.md) | Lógica de negócio encapsulada no banco de dados. |

---

## 🐳 Deploy & Operação

Instruções para subir o ambiente e gerenciar segredos:

| Documento | Conteúdo |
|---|---|
| [**Guia de Docker**](./deployment/docker.md) | Configuração de WPPConnect e Containers. |
| [**Variáveis de Ambiente**](./deployment/env_vars.md) | Centralização de todos os segredos do `.env`. |

---

## 📖 Guias Rápidos

| Documento | Conteúdo |
|---|---|
| [**Onboarding**](./guides/onboarding.md) | Primeiros passos para novos desenvolvedores. |
| [**Adicionar Novo Agente**](./guides/new-agent.md) | Como estender as capacidades de IA do sistema. |
| [**Auditoria Completa**](./research_audit.md) | O relatório técnico original que serviu de base para esta documentação. |

---

> [!TIP]
> Esta documentação é "viva". Se você encontrar alguma informação desatualizada ou incompleta, sinta-se à vontade para abrir um PR ou atualizar os arquivos correspondentes.
