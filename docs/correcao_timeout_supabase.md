# Histórico de Melhorias — Correção de Timeouts do Supabase no Worker de Fila

Este documento registra a análise técnica, o diagnóstico e a correção estrutural implementada em **29 de Agosto de 2026** para resolver os timeouts de banco de dados e o reenvio em loop de mensagens aos produtores rurais.

---

## 🚨 O Problema e seu Impacto
Durante o processamento de mensagens complexas (em especial áudios contendo dúvidas técnicas, como a dúvida do produtor **Ser Rio** sobre a germinação de sementes de Copaíba), o processamento acumulado das etapas de IA (Transcrição Groq Whisper + RAG + Geração de Áudio TTS + uploads de mídia) ultrapassava o timeout de 90 segundos do contexto de IA (`aiCtx`).

### Consequências:
1. O context expirava com o erro **`context deadline exceeded`**.
2. O worker de IA tentava usar esse mesmo `aiCtx` expirado para marcar o job como feito (`MarkDone`) ou atualizar o status do payload no Supabase (`UpdateRawPayloadStatus`).
3. As escritas no Supabase falhavam instantaneamente por timeout.
4. Sem o status atualizado para concluído, o serviço **Reaper** re-enfileirava a mensagem original após alguns minutos, provocando um **loop de reprocessamento** e fazendo o produtor receber a mesma resposta de áudio duplicada ou triplicada no WhatsApp.

---

## 🛠️ A Correção Estrutural

A correção consistiu em desacoplar o ciclo de vida do processamento de IA do ciclo de vida de persistência no banco de dados.

### Arquivo Modificado:
* [`pmo-bot-go/internal/queue/ai_worker.go`](file:///c:/Users/T-GAMER/Documents/DEV/manejo-org-app-clean/pmo-bot-go/internal/queue/ai_worker.go)

### Implementação:
1. **Centralização do Fechamento (`finalizeJob`):** Toda a finalização do job e a atualização de status de payload no Supabase foram encapsuladas em uma função auxiliar `finalizeJob`:
   ```go
   func (w *AIWorker) finalizeJob(
       job *Job,
       msg ports.IncomingMessage,
       success bool,
       reason string,
       latencyMs int64,
   )
   ```
2. **Contexto de Banco Isolado (`dbCtx`):** Dentro de `finalizeJob`, criamos um contexto limpo e independente de 15 segundos baseado em `context.Background()`:
   ```go
   dbCtx, dbCancel := context.WithTimeout(context.Background(), 15*time.Second)
   defer dbCancel()
   ```
   Todas as chamadas subsequentes ao Supabase (`MarkDone`, `MarkFailed` e `UpdateRawPayloadStatus`) passaram a utilizar esse `dbCtx`. Isso garante que, mesmo se o processamento principal estourar o limite de tempo da IA, as atualizações finais de banco de dados sempre persistam de forma resiliente.
3. **Limpeza do Linter:** O parâmetro `ctx` não utilizado na finalização do job foi removido para evitar alertas de "unused parameters".

---

## 🧪 Validação Técnica

A correção foi testada com sucesso e validada contra regressões através de duas suítes principais:

1. **Testes Unitários da Fila (Harness/Reaper/ResponseMode):**
   * **Comando:** `go test -v ./internal/queue/...`
   * **Resultado:** **PASS** (1.46s)
   * **Objetivo:** Garantiu que o fluxo de claim de mensagens, processamento e as regras do Reaper continuam funcionando sem regressões lógicas.
2. **Testes de Integração de Fluxo Completo:**
   * **Comando:** `go test -v ./tests/...`
   * **Resultado:** **PASS** (66.58s)
   * **Objetivo:** Validou a ingestão de PDFs de conhecimento, a geração de chunks, embeddings e a busca vetorial (RAG) integrada no Supabase.

---

## 🛡️ Auditoria de Sanidade (Post-Fix)
Fizemos uma varredura preventiva em [`media_worker.go`](file:///c:/Users/T-GAMER/Documents/DEV/manejo-org-app-clean/pmo-bot-go/internal/queue/media_worker.go) e confirmamos que ele está seguro contra o mesmo bug, pois opera utilizando o contexto principal do daemon do Harness (que não expira espontaneamente durante o ciclo normal de vida do container).
