# 🏛️ Architecture Decision Records (ADR)

Este diretório contém o registro das decisões arquiteturais significativas tomadas durante o desenvolvimento do ManejoORG. Cada ADR descreve o contexto, a decisão, a justificativa e as consequências de uma escolha técnica de alto nível.

## Índice de Decisões

| ID | Título | Status | Data |
|---|---|---|---|
| [**ADR-001**](./001-go-over-python.md) | Go sobre Python para o Backend | Aceito | Mar/2026 |
| [**ADR-002**](./002-fat-database.md) | Fat Database — Lógica no PostgreSQL | Aceito | Fev/2026 |
| [**ADR-003**](./003-offline-first.md) | Offline-First PWA via IndexedDB | Aceito | Jan/2026 |
| [**ADR-004**](./004-multi-llm.md) | Multi-LLM — Gemini + Groq | Aceito | Mar/2026 |
| [**ADR-005**](./005-open-meteo-migration.md) | Open-Meteo — API de Clima sem chave | Aceito | Abr/2026 |
| [**ADR-006**](./006-pdf-extraction-engine.md) | Motor de Extração de PDFs (Docling) | ~~Aceito~~ → Supersedido | Jun/2026 |
| [**ADR-007**](./007-pdf-extraction-pymupdf.md) | Migração para PyMuPDF (regressão de encoding) | **Aceito** | Jul/2026 |
| [**ADR-008**](./008-ponytail-orchestrator-cleanup.md) | Ponytail Orchestrator Cleanup | Aceito | Ago/2026 |
| [**ADR-009**](./009-gateway-go-complementa-fat-database.md) | Gateway REST no Go — complementa o ADR-002, não substitui | Aceito | Ago/2026 |
| [**ADR-010**](./010-multitenancy-por-organizacao.md) | Multitenancy por Organização — cooperativa, certificadora, consultoria e produtor | Proposto | Ago/2026 |
| [**ADR-011**](./011-abstracao-de-canal-de-chat.md) | Abstração de Canal de Chat — WhatsApp e app como adaptadores | Proposto | Ago/2026 |

---

## O que é um ADR?
Um ADR (Architecture Decision Record) é um documento curto que captura uma decisão arquitetural, juntamente com seu contexto e consequências. Eles são essenciais para manter a memória técnica do projeto e ajudar novos desenvolvedores a entender o "porquê" por trás das escolhas de infraestrutura e design.
