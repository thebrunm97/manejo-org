# Roteador de agentes de IA

Decide o que fazer com a mensagem do produtor: registrar no banco,
responder uma dúvida agronômica, tratar assunto de cooperativa ou apenas
conversar.

## Classificação de intenção

`pmo-bot-go/internal/domain/intent.go` define `AudioIntentResult`
(`intent`, `transcription`, `status` ∈ {`ok`,`unclear`}, `confidence`), com
schema JSON derivado por reflexão e enviado ao provedor via
`GenerateStructured`. Há validação pós-hoc do enum: qualquer valor
inesperado é rebaixado a `unclear` para não desviar o roteamento silenciosamente.

> Existem **dois** contratos de classificação, propositalmente distintos:
> `domain.AudioIntentResult` (pipeline de áudio) e `llm.UnifiedIntentResult`
> (NER completo usado pela FSM legada). Os comentários no código alertam para
> não confundi-los.

## Duplo fallback de áudio

`pmo-bot-go/internal/domain/router.go` — `ProcessAudioMessage`:

1. `FORCE_GROQ_AUDIO=true` — kill-switch que ignora o primário.
2. **Erro técnico** — o provedor primário retorna erro.
3. **Erro de qualidade** — o provedor retorna `status: "unclear"`.

Em qualquer um dos casos, o Groq Whisper transcreve e o texto volta para
classificação. A metadata (`AudioProvider` vs `ModelUsed`) distingue a
decisão de roteamento do modelo que de fato respondeu — o primeiro serve à
auditoria do pipeline, o segundo à atribuição de custo.

## Agentes especialistas

Prompts versionados em `pmo-bot-go/internal/prompt/prompts/`
(e cópia em `internal/gemini/prompts/`):

| Prompt | Papel |
| --- | --- |
| `db_operator.md` | Extrai a operação e chama a RPC — alimenta [[registro-de-caderno]] |
| `agronomist.md` | Recomendação técnica ancorada em [[rag-e-base-de-conhecimento]] |
| `agronomist_vision.md` | Diagnóstico por imagem de folha |
| `coop_agent.md` | Assuntos de [[organizacao]] e [[demanda-coletiva]] |
| `system_prompt.md` | Persona e limites gerais |
| `meta_rag_judge.txt` | Avaliação automática de resposta |

## Máquina de estados

`pmo-bot-go/internal/state/` — `fsm.go`, `orchestrator.go`, `pre_router.go`,
`llm_router.go`, `tool_pipeline.go` e handlers por domínio
(`handlers_manejo.go`, `handlers_financeiro.go`, `handlers_limpeza.go`,
`handlers_coletivo.go`, `handlers_system.go`, `onboarding.go`).

Toda saída passa por [[compliance-de-insumos]] antes de virar escrita.

## Fontes

- `docs/architecture/adr/004-multi-llm.md`
- `pmo-bot-go/docs/architecture/001-llm-agnostico-fallback.md`
- `pmo-bot-go/docs/architecture/MULTI_AGENT_ARCHITECTURE.md`
