# 🌿 Manejo Orgânico - PMO Bot 🤖

![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

Plataforma de **Inteligência Artificial de Grau Enterprise** para automação e gestão do manejo orgânico. O ecossistema integra um assistente inteligente via WhatsApp, um motor de processamento robusto em GoLang e um Dashboard administrativo moderno para visualização e compliance.

---

## 📐 Visão Geral da Arquitetura

O sistema utiliza uma arquitetura distribuída e baseada em eventos, garantindo alta disponibilidade e respostas em tempo real.

```mermaid
graph TD
    User([Produtor/Usuário]) <-->|WhatsApp| WPP[WPPConnect Gateway]
    WPP <-->|Webhook/REST| BE[Backend GoLang - PMO Bot]
    BE <-->|FSM & Roteamento| LLM[Motor Cognitivo - Groq/Gemini]
    BE <-->|Persistência| DB[(Supabase - PostgreSQL)]
    FE[Frontend React PWA] <-->|Real-time App| DB
    FE <-->|Offline Sync| IDB[(IndexedDB)]
```

### O Fluxo de Inteligência
1. **Frontend PWA**: Interface principal do usuário para gestão de talhões, canteiros e registros manuais. Opera em modo *Offline-first*.
2. **WhatsApp Bot**: Interface conversacional para agilidade no campo (textos e áudios).
3. **Backend GoLang**: O "Cérebro" do sistema. Orquestra sessões, gerencia a Máquina de Estados (FSM) e executa o roteamento cognitivo.
4. **LLMs & MCP**: 
   - **Groq (Llama 3)**: Responsável pelo roteamento cognitivo ultrarrápido de intenções.
   - **Gemini**: Utilizado para *Tool Calling* rigoroso e integração baseada em **MCP (Model Context Protocol)** para criação de infraestrutura.

---

## 📦 Módulos do Sistema

### 🖥️ Frontend (PWA)
Desenvolvido com **React 19 + Vite**, focado em performance e usabilidade no campo.
- **Offline-first**: Sincronização robusta via `idb` (IndexedDB) e Workbox.
- **Geolocalização**: Mapas interativos via **Leaflet** com estratégia de *GeoJSON Placeholder* para visualização precisa de talhões e canteiros.
- **Design System**: UI premium baseada na estética moderna com Tailwind CSS v4.

### ⚙️ Backend (GoLang)
Motor de alta performance substituindo a arquitetura Python legada.
- **FSM (Finite State Machine)**: Controle rigoroso dos estados da conversa, garantindo fluxos lineares e sem perda de contexto.
- **Roteamento Cognitivo**: Camada de inteligência via Groq que decide entre consultas técnicas, registro de atividades ou configuração de infraestrutura.
- **Ferramentas MCP**: Automação técnica para criação em lote de talhões e canteiros diretamente via prompt de comando.

### 📊 Auditoria e Telemetria
- **Rigor Financeiro**: Logs de consumo detalhados por PMO ID e User ID.
- **Monitoramento**: Rastreabilidade total de tokens utilizados e tempos de resposta das LLMs.
- **Compliance**: Validação automática de insumos contra as normas de certificação orgânica.

---

## 🛠️ Setup Local (Orquestração Docker)

Para rodar o ecossistema completo localmente, siga os passos abaixo:

### 1. Pré-requisitos
- Docker & Docker Compose v2+
- Variáveis de ambiente configuradas (`.env` no backend e frontend)

### 2. Inicialização

Os serviços de infraestrutura e o motor Go estão centralizados no diretório `pmo_bot`.

```bash
# Navegue até o diretório do motor
cd pmo_bot

# Derrube qualquer instância anterior e limpe volumes se necessário
docker-compose down

# Suba os containers com rebuild forçado
docker-compose up -d --build
```

### 3. Serviços Disponíveis
- **API (pmo-bot-go)**: `http://localhost:8080/health`
- **WPPConnect Gateway**: `http://localhost:21465` (Porta do webhook central)
- **Frontend (Dev)**: `cd pmo-frontend && npm run dev`

---

## 📄 Licença e Uso

Este projeto é de uso restrito e privado. Todos os direitos reservados.

---
**Desenvolvido com 💚 para o Futuro do Manejo Orgânico.**
