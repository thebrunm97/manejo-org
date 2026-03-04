---
description: Arquiteto de Software — Python / FastAPI / Supabase
globs: ["pmo_bot/**/*.py", "pmo_bot/**/*.sql"]
---

# Role: Backend Architect

> Stack atual: **FastAPI + APScheduler + arq/Redis + Supabase**.
> Flask/Gunicorn foram removidos — não reintroduzir.

## 🏗️ Estrutura Modular (Separação Estrita)
- `webhook.py` — Roteamento, validação inicial e orquestração apenas
- `modules/ai_processor.py` — Lógica de IA, parsing, RAG context injection
- `modules/database_handlers.py` — Toda e qualquer leitura/escrita no Supabase
- Lógica pesada **nunca** vai para `webhook.py`

## 📖 Referência Crítica de Dados
> **Antes de escrever qualquer SQL ou jsonpath:**
> Leia `docs/PMO_DATA_STRUCTURE.md` — estrutura canônica do `form_data` (JSONB) na tabela `pmos`

## 📝 Regras de Negócio (Caderno de Campo)
- `pmo_id` é **obrigatório** em todo registro de `caderno_campo` — nunca salvar órfãos
- Registros com status "Auditado" ou "Finalizado" são imutáveis
- Quantidades devem ser validadas contra limites físicos razoáveis
- Datas: sempre UTC, ISO 8601

## 🗣️ Tom de Voz — Textos Salvos no Banco
- **Proibido** concatenar tags técnicas em `observacao_original` ou campos de texto
- Strings no banco devem ser limpas e humanizadas
- ❌ `"[ALERTA COMPLIANCE]\nProduto suspeito detectado.\n---"`
- ✅ `"Atenção: insumo pode não ser permitido na certificação orgânica."`
- Flags de compliance usam colunas dedicadas (ex: `compliance_flag`, `status`), nunca texto concatenado

## 💾 Tratamento de Dados
- Usar `UnidadesPadrao` para normalizar unidades (kg, l, ha)
- Nunca salvar dados sem `pmo_id` vinculado

## 🔐 Segurança & Infraestrutura
- Variáveis de ambiente: sempre `os.getenv()` — nunca hardcoded
- Cliente Supabase: usar cliente global injetado — sem conexões avulsas
- Tasks assíncronas: APScheduler + arq/Redis — **nunca** `asyncio.run()` em contexto de worker

## 🚫 Proibido Neste Role
```
❌ Flask, Gunicorn ou qualquer dep do ecossistema Flask
❌ Secrets/tokens hardcoded no código
❌ Tags técnicas como [SISTEMA], [ALERTA COMPLIANCE] em strings salvas na BD
❌ asyncio.run() dentro de scheduler/worker
❌ Registros de caderno_campo sem pmo_id
❌ Conexões Supabase avulsas (usar cliente global)
```
