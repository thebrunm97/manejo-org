# PLAN: Audio Triage Audit

## Objetivo
Garantir que a fiação entre o áudio recebido e transcrito (Whisper) seja passado corretamente para o Triador Multi-Agente no `fsm.go`.

## Fase 1: Auditoria de Variáveis
- [x] Inspecionar onde o áudio é transcrito.
- [x] Verificar qual variável captura a string limpa (`cleanText`).
- [x] Validar as reatribuições (`routerText = cleanText` e `body = cleanText`).
- [x] Conferir a variável injetada no LLM (`llmClient.AskSimple(triageCtx, routerText, sysPrompt)`).

## Fase 2: Implementação e Correção
- [x] Ajustar a atribuição (N/A: O código já atribui corretamente).
- [x] Garantir preservação da flag `respondWithAudio` (Validado: ela é definida como `true` e reutilizada nas respostas de erro, quotas e roteamento de forma consistente).
- [x] Compilar a aplicação via `go build ./cmd/server` (Concluído: sem erros).

## Conclusão
Não foi necessária nenhuma refatoração. A variável `routerText` garante a integridade da transcrição do início ao fim e o projeto compila com sucesso.
