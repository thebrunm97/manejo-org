# SPEC-DRIVEN PLAN: Migração PMO-Bot para Golang

## Fase 1: Fundação HTTP & WPPConnect ✅
- [x] Criar `cmd/server/main.go` com inicialização do servidor Gin.
- [x] Criar `internal/webhook/handler.go` com a `struct` exata do payload do WPPConnect.
- [x] Implementar middleware de autenticação (Token via query param ou Bearer header).
- [x] Implementar regra de ouro de Produção: devolver sempre HTTP 200 OK.

## Fase 2: O Novo Cérebro (Groq Integration) ✅
- [x] Criar `internal/groq/client.go` (HTTP nativo).
- [x] Definir modelo `ExtractionResult` (NER Brain).
- [x] Implementar JSON Schema forçado para a Groq.
- [x] Migrar docs para Skill `@groq-integration`.

## Fase 3: Estado & Persistência ✅
- [x] Criar `internal/state/fsm.go` (Substitui LangGraph).
- [x] Criar cliente nativo Supabase para `profiles` e `caderno_campo`.
- [x] Implementar fluxo assíncrono no webhook.

## Fase 4: Feedback Loop & Consultoria ✅
- [x] Integrar validação @AgronomoOrganico.
- [x] Implementar `gemini.Client` para respostas de especialista.
- [x] Configurar `system_prompt.md` externo.

## Fase 5: RAG & Knowledge Base ✅
- [x] Criar `cmd/knowledge_loader/main.go` para ingestão de PDFs.
- [x] Integrar Gemini File Search API no fluxo principal.
- [x] Implementar Rate Limit Protetivo (15s delay).

## Fase 6: Antigravity RPI Infrastructure ✅
- [x] Aplicar regra `always_use_rpi`.
- [x] Implementar workflows `/research`, `/plan`, `/implement`.
- [x] Padronizar arquitetura com `@golang-guerrilha`.

## Próximos Passos 🚀
- [ ] Monitoramento de erros 429 e Otimização de Custos (Gemini Flash).
- [ ] Implementar Testes de Stress / Carga no Webhook.
- [ ] Melhorar a lógica N:N de canteiros conforme Skill Guerrilha.
