# Estado Atual do Projeto (PMO Bot)

## 🎯 O que Concluímos até agora:

1. **Agentic Loop (Fase 1: Read-Only Tool Calling)**
   - Abandonámos o fluxo rígido de FSM (Máquina de Estados) no Orquestrador (`internal/state/orchestrator.go`).
   - Implementámos um ciclo autónomo (`for` com limite de turnos) capaz de interpretar chamadas de ferramentas (`ToolCalls`) e devolver os resultados ao LLM de forma dinâmica.
   - Adicionámos o "Bypass" para a intenção de `CHAT`, economizando iterações quando o utilizador apenas quer conversar.

2. **Ferramenta de RAG (`ConsultarLeiOrganica_RAG`)**
   - Ferramenta registada e conectada aos vetores reais de 3072 dimensões (Gemini) armazenados no Supabase.
   - Adicionámos validações rigorosas (Fallback) para evitar *panics* caso o LLM envie argumentos malformados na Tool Call.

3. **Arena de Modelos (Shootout)**
   - Construímos um teste automatizado (`benchmark_shootout_test.go`) para validar o Agentic Loop com vários modelos via OpenRouter.
   - **Resultados:** 
     - `tencent/hy3-preview`: Passou com sucesso.
     - `deepseek/deepseek-v4-flash`: Passou com sucesso.
     - `moonshotai/kimi-k2.6`: Falhou devido a um timeout extremo da API na geração da resposta base.

4. **Laboratório de Embeddings (Open-Source vs Gemini)**
   - Construímos um script 100% offline em NodeJS (`scratch/benchmark_os_local.js`) utilizando `Transformers.js`.
   - Validamos e migramos para o BGE-M3 (1024d), com 86% top-1 hit rate e eliminação de vendor lock-in.

5. **Refactoring do Pipeline de Áudio (MIME Type & Fallbacks)**
   - Extração e propagação ponta-a-ponta do `audioMimeType` a partir dos adapters de WhatsApp até o LLM e Groq.
   - Fallbacks duplos implementados (`LLMProviderAdapter` e `ProcessAudioMessage`).

6. **Correção do Bug de Embedding no RAG (Vetores 1024d BGE-M3 vs 3072d Gemini)**
   - Pipeline de escrita e busca unificado no BGE-M3 (1024d).
   - Fan-in batch com upsert atômico de chunks no `handler.go`.
   - Backfill e reindexação completa dos registros legados via `cmd/reindex/main.go`.

7. **Idempotência no PostgreSQL Staging (Fase 2.1 - DT-00)**
   - Criadas 4 RPCs idempotentes (`rpc_registrar_operacao_campo`, `rpc_registrar_compra_insumo`, `rpc_registrar_transacao_com_rateio`, `rpc_registrar_cota_produtor`).
   - Deduplicação atômica suportada por índices únicos parciais (`WHERE idempotency_key IS NOT NULL`).

8. **Agentic Loop & Batch Mutations com Two-Phase Commit HITL (Fase 2.2 - DT-09 a DT-12)**
   - **Two-Phase Commit:** Criada tabela `public.mutation_drafts` com status (`pending`, `approved`, `rejected`, `superseded`, `failed`, `expired`), TTL de 45 minutos e índice único parcial `idx_mutation_drafts_one_pending` para `(from_phone, pmo_id)`.
   - **Tool Polimórfica:** Registrada `propose_batch_mutations(operations: [...])` suportando mutações agrupadas de caderno de campo, compra de insumo, transações com rateio e cotas de produtores.
   - **RPCs Atômicas Concorrentes:**
     - `create_or_supersede_mutation_draft`: Trava via `SELECT ... FOR UPDATE`, marca rascunho anterior como `superseded` e cria novo atomicamente.
     - `commit_mutation_draft`: Trava via `SELECT ... FOR UPDATE`, valida multi-tenancy e TTL, itera sobre operações derivando chaves de idempotência (`<draft_id>-op-<idx>`), despacha para as 4 RPCs da Fase 2.1 e captura falhas em subtransação `BEGIN ... EXCEPTION` persistindo `status = 'failed'` + `error_detail` de forma terminal.
   - **Webhook & HITL Interceptor:**
     - Normalização determinística por palavras-chave (`ClassifyHITLResponse`) antes de qualquer chamada LLM.
     - Mensagens claras para rascunhos expirados, rejeitados, falhas parciais ou confirmações bem-sucedidas.
   - **Validação Automatizada:** Testes unitários e de integração real no PostgreSQL (`mutation_drafts_real_postgres_test.go`) cobrindo concorrência real com goroutines simultâneas e integridade transacional (100% PASS).

9. **Diagnóstico e Fix: Sidecar `clockwork` (NTP) quebrado — causa raiz de "hora errada" + áudio do WhatsApp não sendo processado (DT-23)**
   - **Sintoma relatado:** áudios enviados via WhatsApp não eram transcritos/entendidos pelo bot; suspeita de relação com horário incorreto.
   - **Investigação:** inspecionados os containers reais de produção (`pmo-prod-stack-*`, não os do Supabase local). Log do `pmo-bot-go` mostrou `"CRITICAL: Clock Drift detected! Drift is 2.94s. This will cause WhatsApp API 401 Signature Failures."`, seguido de 100% dos jobs de download de áudio falhando com `evolution-go` retornando `status 403` e indo para dead-letter após 3 tentativas.
   - **Causa raiz confirmada:** o sidecar `clockwork` (`docker-compose.prod.yml`) existe desde antes para corrigir drift via `ntpdate` a cada 30s, mas o pacote `ntpdate` foi **removido dos repositórios do `alpine:latest`** — `apk add ntpdate` falhava silenciosamente todas as vezes (`2>/dev/null || true` engolia o erro), então o sidecar nunca corrigiu nada e ninguém percebeu. Confirmado via `docker exec ... which ntpdate` → `not found`.
   - **Fix aplicado (código):** `command` do serviço `clockwork` em `docker-compose.prod.yml` trocado de `ntpdate` (pacote inexistente) para o applet `ntpd` já embutido no busybox do Alpine, sem depender de instalação via `apk`: `busybox ntpd -n -q -p time.google.com`. Erros agora vão para stdout (sem `2>/dev/null`) para que uma falha futura apareça nos logs.
   - **Resultado:** container recriado, `ntpd` voltou a executar e os downloads de áudio voltaram a funcionar (403 → 200, transcrição via Whisper OK).
   - **Ressalva importante:** a correção **não persiste**. Medição direta (`busybox ntpd -w -q`, query-only) mostra o relógio ainda ~4,06s atrasado, e o bot seguiu logando `CRITICAL: Clock Drift detected`. Provavelmente o WSL2/Docker Desktop reverte a alteração feita no container. O 403 pode voltar. Rastreado como `DT-26`.
   - **Nota:** o `audio_url` público em `caderno_campo` (bucket `audios_audit` do Supabase Storage) foi verificado e está correto (arquivo Opus/OGG válido, `Content-Type: audio/ogg`, CORS liberado) — não era o problema. A causa era exclusivamente o download inicial da mídia do WhatsApp falhando no bot.
   - Rastreado formalmente como `DT-23` em [docs/debitos_tecnicos.md](docs/debitos_tecnicos.md).

10. **Investigação de follow-up (2026-08-22): 3 problemas adicionais revelados pelos logs pós-fix**
   - **DT-25 — Container de produção defasado:** imagem `pmo-bot-go` buildada em 2026-08-16 vs. último commit em 2026-08-21 (`1b1b341`). O binário rodando não tem os fixes dos últimos 5 dias. Sintoma: `consultar_previsao_tempo` falhando 100% com `parâmetro 'propriedade_id' é obrigatório` — string removida em `1b1b341` e que **não existe mais no código-fonte**, o que confirmou o diagnóstico. Perfil no banco está íntegro (`propriedade_ativa_id = 5`). **Pendente: rebuild da imagem.**
   - **DT-26 — Clock drift persiste:** ver ressalva no item 9.
   - **DT-27 — `SendVoice` quebrado (bot nunca respondia em áudio):** o adapter falava o dialeto da Evolution API v2 (Node) — JSON com `media` (data URI) + `mediatype` — mas o fork `evolution-go` usado aqui exige `url` (buscada via `http.Get`, portanto sem suporte a base64) no caminho JSON, ou `file` + `type` no caminho multipart. Todo envio retornava `400 {"error":"URL is required"}` e caía no fallback de texto. **Corrigido** em `internal/adapter/evolution/adapter.go`: reescrito para `multipart/form-data`; o `evolution-go` converte para Opus e envia com `PTT=true` automaticamente. Requer rebuild para valer em produção.

11. **TTS Agnóstico (`ports.TTSProvider`) + Piper auto-hospedado + resposta em áudio E texto (DT-28)**
   - **Fronteira criada:** `ports.TTSProvider` (`internal/ports/tts_ports.go`), seguindo exatamente a estratégia já usada em `LLMProvider` — o domínio depende do contrato, nunca do fornecedor. Assinatura: `GenerateSpeech(ctx, text) (audio []byte, mimeType string, err error)` + `Name()` (que, como o `modelUsed` do LLM, reflete o que de fato respondeu quando há fallback interno).
   - **`internal/tts` reorganizado:** o antigo `client.go` (um `Orchestrator` com `switch` por `Provider string`) foi substituído por implementações separadas:
     - `openai_compat.go` — cobre **Piper, Groq e OpenRouter** de uma vez, já que todos falam `POST /v1/audio/speech`. Evita três cópias do mesmo cliente HTTP.
     - `google_translate.go` — endpoint não-oficial do Google, mantido só como fallback de emergência.
     - `factory.go` — `NewFromEnv()` é o **único** ponto do sistema que instancia um fornecedor concreto.
   - **Desacoplamento comprovado:** as 40+ assinaturas que recebiam `*tts.Orchestrator` passaram a receber `ports.TTSProvider`. Os erros de compilação de "import não usado" que apareceram em `internal/state` e `internal/queue` foram justamente a evidência de que a lógica de negócio não conhece mais o pacote concreto.
   - **Piper adotado como padrão:** serviço no `docker-compose.prod.yml` + volume `piper_data` (cache das vozes do HuggingFace), voz `pt_BR-faber-medium`. Gratuito, sem cota, sem chave e sem depender de endpoint não-oficial. Vozes pt-BR disponíveis: faber, cadu, edresson, jeff. Trocar de fornecedor agora é só `TTS_PROVIDER=...` (aceita `piper`, `groq`, `openrouter`, `google`, `none`).
   - **Entrega áudio + texto:** o texto passou a ser o **canal garantido** (é ele que decide sucesso/retry) e o áudio um acréscimo **best-effort**, enviado uma única vez — não se repete se o texto precisar de retry. Falha de TTS deixou de ser caminho de erro: apenas degrada a experiência.
   - **Robustez:** `sniffAudioMIME` rejeita HTTP 200 cujo corpo não é áudio (erro em JSON/HTML mascarado de sucesso) — antes isso só falharia lá na frente, no WhatsApp, sem pista da causa.
   - **Cobertura:** 8 testes em `internal/tts` (incluindo fallback de modelo, `Name()` refletindo o modelo efetivo e rejeição de corpo não-áudio) e 5 em `internal/queue/delivery_test.go` (áudio+texto juntos, modo texto não sintetiza, falha de TTS ainda entrega texto, áudio não reenviado em retry, provider nil).
   - **Pendente:** preferência de formato por produtor (`DT-29`) — hoje ainda espelha a entrada, sem escolha persistida.

12. **Ajustes pós-validação real no WhatsApp (DT-31)**
   - O DT-28 subiu com build, vet e 13 testes verdes — e ainda assim três defeitos só apareceram no uso real. Vale como lição: TTS é uma feature que precisa de teste manual, porque a qualidade percebida não é expressável em asserção.
   - **Lia a formatação em voz alta:** o texto ia cru para o motor, que narrava "asterisco asterisco Consulta Técnica" e o nome de cada emoji. Criado `utils.SanitizeForSpeech`, que remove emoji/pictogramas, marcadores de lista, ênfase, cabeçalhos, blocos de código e URLs, preservando letras acentuadas, dígitos, pontuação e `° º ª %`. A mensagem escrita no WhatsApp **mantém** a formatação — só o áudio usa a versão limpa.
   - **Áudio perdido por timeout:** a resposta longa da previsão falhava com `context deadline exceeded`. Duas causas somadas: o WAV do Piper tem 554KB (sem compressão) e o teto era 30s. Migrado para **MP3** — medido 92KB na mesma resposta, ~6x menor — e timeouts elevados para 120s/150s.
   - **Ordem invertida:** o áudio ia antes do texto, então uma síntese de 25s deixava o produtor sem resposta nenhuma nesse intervalo — e sem nada quando o TTS falhava. Agora o **texto vai primeiro** nos dois caminhos (`queue/delivery.go` e `state/utils.go`), com teste de invariante de ordem. O áudio virou complemento que chega depois.
   - Corrigido também o comentário do contrato em `ports.TTSProvider`, que afirmava que o texto chegava pré-sanitizado — não chegava.

13. **Cadeia de fallback do LLM, guardrails e observabilidade (DT-32, DT-35, DT-41, DT-33)**
   - **Fallback do Gemini estava morto em três camadas somadas (DT-32):** `CallGoogle` fixava `c.Config.Model` e ignorava o modelo recebido, então "escalar" reexecutava o primário que acabara de falhar; o modelo de fallback `gemini-1.5-flash` havia sido **descontinuado** (0 ocorrências em `/v1beta/models`); e a escalada herdava o contexto já expirado, retornando em ~0,5ms sem abrir conexão. Corrigidos os três. Primário migrado para o GA `gemini-3.1-flash-lite` e `OPENROUTER_MODEL` alinhado ao **mesmo** modelo — falha de infraestrutura se resolve trocando de *provedor*, não de modelo.
   - **Stall ≠ sobrecarga (DT-41):** `context deadline exceeded` era classificado como erro de sobrecarga e disparava retry, custando 25s+2s+25s+2s+25s ≈ **79s** de repetição no mesmo endpoint mudo antes de escalar. Criado `isStallError` separado: stall escala de imediato; 429/503 mantêm backoff, onde ele faz sentido. Custo do stall: **79s → 25s**.
   - **Output Judge bloqueava respostas legítimas (DT-35):** só reconhecia RAG como fonte, então previsão do tempo vinda de API real era acusada de `ALUCINACAO_DADOS` — bloqueando **toda** consulta de clima e acionando "especialista" à toa. Criado o sinal `FONTE_EXTERNA` (qualquer ferramenta de consulta), separado de `FONTE_RAG`; ferramentas de **escrita** deliberadamente não contam. Bug secundário achado pelo próprio teste: a checagem usava `"rag"` minúsculo e a ferramenta real é `ConsultarLeiOrganica_RAG` — `FONTE_RAG` era **sempre** "não".
   - **DT-33 fechado com dado — duas hipóteses refutadas.** Instrumentação em 3 níveis + simulador de carga + agregador. Amostra de 121 chamadas: distribuição **bimodal** (69% < 3s, 85% < 10s, 7% travam até morrer no timeout, **zero** entre 24–24,9s) — assinatura de conexão travada, não de processamento lento. E o payload **não** explica: chamadas **sem ferramentas** tiveram média 6.477ms e 23% acima de 10s, contra **3.749ms e 9%** das com 29 ferramentas (44KB). As leves são mais lentas que as pesadas. Com payload idêntico, latência variou 45x (789ms → 35.261ms).
   - **Consequência prática:** o corte de ferramentas (DT-37) foi **rebaixado** — não resolve performance, só custo por token. E a matriz de uso real mostrou `registrar_colheita`/`registrar_limpeza` sendo invocadas sob intent **RAG**, confirmando que cortar DBWrite de RAG quebraria registros legítimos. Foi exatamente o risco que motivou medir antes de agir.
   - **Lição registrada:** duas propostas minhas foram derrubadas pelo próprio dado (canal *preview* como causa; baixar `attemptTimeout` para 12s — que mataria 7 das 13 respostas legítimas entre 8s e 25s). Medir antes de concluir deixou de ser recomendação e virou prática.

---

## 🚀 Próximos Passos & Gestão de Débitos:

1. **Próxima Frente Ativa (Fase 3):**
   - Rotação da `service_role` key do Supabase (`DT-01`).
   - Limpeza e descomissionamento de interfaces legadas (`DT-02`, `DT-03`, `DT-04`, `DT-06`).
   - Consolidação do pipeline de ingestão Docling Go (`DT-07`).

2. **📋 Débitos Técnicos & Pendências:**
   - O rastreio formal de dívidas técnicas e pendências é centralizado no board: [docs/debitos_tecnicos.md](file:///c:/Users/T-GAMER/Documents/DEV/manejo-org-app-clean/pmo-bot-go/docs/debitos_tecnicos.md).
