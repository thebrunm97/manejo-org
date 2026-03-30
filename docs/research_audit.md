# Auditoria Técnica e Mapeamento do Sistema ManejoORG

Este documento fornece um inventário completo e técnico do ecossistema ManejoORG (Plano de Manejo Orgânico), abrangendo o Backend (Go), Frontend (React PWA) e Banco de Dados (Supabase).

---

## 1. Backend (`pmo-bot-go/`)

O backend é escrito em Go (v1.23+), focado em alta performance e orquestração de IA.

### 1.1 Estrutura de Arquivos e Entry Points
- **Entry Point:** `pmo-bot-go/cmd/server/main.go`. Inicializa o servidor Gin e os clientes Groq, Gemini e Supabase.
- **FSM (State Machine):** `pmo-bot-go/internal/state/fsm.go`. Core da lógica conversacional para o WhatsApp.
- **AI Routing:** `pmo-bot-go/internal/gemini/router.go`. Orquestrador que roteia mensagens entre especialistas de IA.
- **Supabase Client:** `pmo-bot-go/internal/supabase/client.go`. Interface para RPCs e Tabelas.
- **Prompts:** Localizados em `internal/gemini/prompts/` (`agronomist.md`, `db_operator.md`).

### 1.2 Fluxos de Processamento
1. **Deduplicação:** Implementada via `ProcessedMessages` no webhook handler.
2. **Transcrição:** Uso de Groq (Whisper-v3) para áudios do WhatsApp.
3. **Visão:** Uso de Gemini 2.0 Flash para análise agronômica de fotos.
4. **Extração NER:** Uso de Llama 3.3 (via Groq) para transformar texto informal em JSON estruturado.
5. **LoopGuard:** Limite de 5 iterações de ferramentas para evitar recursão infinita (custo/segurança).

---

## 2. Frontend (`pmo-frontend/`)

PWA moderno focado em visualização geográfica e suporte offline robusto.

### 2.1 Stack e Mapas
- **Stack:** React 19+, Vite, Tailwind CSS.
- **Mapas:** **MapLibre GL** integrado com tiles de satélite da **Esri**. 
- **Independência:** Não utiliza Google Maps API, o que elimina a necessidade de chaves de faturamento do Google Cloud.

### 2.2 Motor Offline (Sync Engine)
- **IndexedDB:** Persistência local via biblioteca `idb`.
- **Sync:** Hook `useSyncEngine` monitora conectividade e processa uma fila de sincronização com tratamento de erros e backoff.
- **IDs Temporários:** Objetos criados offline usam prefixo `offline_` até serem confirmados pelo banco.

---

## 3. Banco de Dados (Supabase)

Arquitetura **Fat Database** onde a lógica transacional pesada reside em RPCs.

### 3.1 Esquema e RPCs
- **Tabelas Críticas:** `profiles`, `pmos`, `talhoes`, `canteiros`, `caderno_campo`.
- **Busca Vetorial:** Realizada via `pgvector` na tabela `farm_documents`.
- **RPCs Principais:**
    - `rpc_registrar_operacao_campo`: Lógica polimórfica para registros de manejo.
    - `rpc_registrar_compra_insumo`: Registro atômico de aquisições.
    - `match_farm_documents`: Busca de similaridade para o RAG.

---

## 4. Infraestrutura (Docker)

O sistema é orquestrado via `docker-compose.yml` na pasta `pmo_bot/`:
- **wppconnect-server:** Gateway Node.js baseado em Puppeteer para automação do WhatsApp.
- **pmo-bot-go:** Backend compilado para container minimalista.
- **pmo-net:** Rede isolada para comunicação interna entre os serviços.

---

## 5. Compliance Orgânico
O sistema monitora automaticamente substâncias químicas proibidas (Glifosato, NPK, etc) e exige especificidade em registros de insumos genéricos, garantindo a rastreabilidade necessária para certificações (Lei 10.831).
