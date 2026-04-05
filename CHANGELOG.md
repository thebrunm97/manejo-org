# Changelog ManejoORG

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [0.14.0] - 2026-04-04 - "A Era da Gestão Analítica e Consultoria IA 📈"

### ✨ Funcionalidades (Features)
* **Marketplace B2B2C:** Implementação do Mural de Demandas para Produtores e Torre de Controle para Gestores de Cooperativas.
* **Dashboard Financeiro:** Lançamento do motor de visualização de performance (DRE, Lucro/Prejuízo por Talhão).
* **Rastreabilidade Pública:** Adicionada rota pública (Mobile-First) acessível via QR Code para o consumidor final (em conformidade com INC 02/2018).

### 🛠 Refatorações e Performance (Chores/Refactors)
* **Frontend (React):** Modularização completa do `ManualRecordDialog` em sub-formulários independentes, resolvendo gargalos de renderização e facilitando manutenção futura (resolução de `DEBT-01`).
* **Backend (Go/Gemini):** Refatoração estrita do mapeamento de JSON Schema do Gemini (Function Calling) com conversão recursiva e injeção dummy, solucionando definitivamente falhas persistentes de `googleapi: Error 400`. Implementado bypass inteligente do SDK ChatSession para ferramentas MCP visando estabilidade térmica.
* **Banco de Dados (Supabase/SQL):** Otimizações ativas de consulta por meio da criação de índices otimizados (GIN/B-Tree) para buscas textuais e relacionamentos de integridade, além de blindagem de RLS para painéis administrativos B2B. Implementação dos novos procedimentos RPC do Engine Agronômico de NPK.
