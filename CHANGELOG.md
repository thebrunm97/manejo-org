# Changelog ManejoORG

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [0.16.0] - 2026-04-09 - "Resiliência e IA Multiprovedor 🧬"

### ✨ Funcionalidades (Features)
* **Backend (pmo-bot-go):** Implementação de arquitetura de LLM agnóstica com suporte a fallback automático para OpenRouter/OpenAI em caso de falha no provedor principal (Gemini).
* **Orquestração:** Novo `ExecuteAgenticLoop` resiliente com suporte a injeção de Reasoning Tokens e histórico de conversa comum entre provedores.

### 🛠 Refatorações e Performance (Chores/Refactors)
* **LLM:** Introdução de `FerramentaAgnostica` e adapters dedicados para cada provedor, desacoplando o negócio dos SDKs proprietários.
* **Estado:** Limpeza de handlers redundantes e centralização da lógica de decisão no Orquestrador.

## [0.15.0] - 2026-04-08 - "Blindagem de Tipos e Evolução do Cérebro IA 🧠"

## [0.14.0] - 2026-04-04 - "A Era da Gestão Analítica e Consultoria IA 📈"

### ✨ Funcionalidades (Features)
* **Marketplace B2B2C:** Implementação do Mural de Demandas para Produtores e Torre de Controle para Gestores de Cooperativas.
* **Dashboard Financeiro:** Lançamento do motor de visualização de performance (DRE, Lucro/Prejuízo por Talhão).
* **Rastreabilidade Pública:** Adicionada rota pública (Mobile-First) acessível via QR Code para o consumidor final (em conformidade com INC 02/2018).

### 🛠 Refatorações e Performance (Chores/Refactors)
* **Frontend (React):** Modularização completa do `ManualRecordDialog` em sub-formulários independentes, resolvendo gargalos de renderização e facilitando manutenção futura (resolução de `DEBT-01`).
* **Backend (Go/Gemini):** Refatoração estrita do mapeamento de JSON Schema do Gemini (Function Calling) com conversão recursiva e injeção dummy, solucionando definitivamente falhas persistentes de `googleapi: Error 400`. Implementado bypass inteligente do SDK ChatSession para ferramentas MCP visando estabilidade térmica.
* **Banco de Dados (Supabase/SQL):** Otimizações ativas de consulta por meio da criação de índices otimizados (GIN/B-Tree) para buscas textuais e relacionamentos de integridade, além de blindagem de RLS para painéis administrativos B2B. Implementação dos novos procedimentos RPC do Engine Agronômico de NPK.
