# Changelog ManejoORG

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

## [0.14.0] - 2026-04-02 - "A Era da Gestão Analítica"

### ✨ Funcionalidades (Features)
* **Marketplace B2B2C:** Implementação do Mural de Demandas para Produtores e Torre de Controlo para Gestores de Cooperativas.
* **Dashboard Financeiro:** Lançamento do motor de visualização de performance (DRE, Lucro/Prejuízo por Talhão).
* **Rastreabilidade Pública:** Adicionada rota pública (Mobile-First) acessível via QR Code para o consumidor final (em conformidade com INC 02/2018).

### 🛠 Refatorações e Performance (Chores/Refactors)
* **Frontend:** Modularização completa do `ManualRecordDialog` em 8 formulários independentes. Resolução do débito técnico `DEBT-01` e melhoria brutal de performance `PERF-01`.
* **Backend (Go):** Modularização do FSM (Finite State Machine) no bot de WhatsApp para mitigar falhas de memória e acelerar o tempo de resposta da LLM.
