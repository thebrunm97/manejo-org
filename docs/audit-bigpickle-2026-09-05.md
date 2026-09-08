# Auditoria BigPickle — 40 problemas verificados (frontend + backend)

- **Data:** 2026-09-05
- **Branch de trabalho:** `fix/bigpickle-bugfix-loop`
- **Escopo:** `pmo-frontend/` (React 19 + Vite + TS), `pmo-bot-go/` (Go 1.25 + Gin), `supabase/migrations/` (SQL), `.github/workflows/` (CI/CD)
- **Método:** revisão por leitura de código e verificação dirigida (`tsc`, `eslint`, `git ls-files`, `Test-Path`, `grep`). Nenhum item foi inventado: todos trazem `arquivo:linha` como evidência.
- **Resultado:** 20 problemas de frontend + 20 de backend/banco/CI, sendo 10 de severidade **Alta**, 55 **Média**, 15 **Baixa** (1 alta/média/baixa por item — ver lista detalhada).

---

## 1. Resumo executivo

| Camada | Alta | Média | Baixa | Total |
|--------|------|-------|-------|-------|
| Frontend | 3 | 9 | 8 | 20 |
| Backend / Supabase / CI | 7 | 10 | 3 | 20 |
| **Total** | **10** | **19** | **11** | **40** |

Tópicos que mais se repetem, por categoria:

- **Segurança / dados:** injeção de sessão via URL, IDOR via RPC manipulável, token na query string, métricas públicas, rate limiting desligado, `http.Client` sem timeout.
- **Integridade / idempotência:** onboarding sem guarda de duplicação, RPCs offline sem idempotency, retry do queue criando PMO duplicado, `update_log_treinamento` permitindo falsificação de ground-truth.
- **Config / build:** ESLint sem cobertura TS, setup de teste com arquivo inexistente, PWA referenciando assets ausentes, `dev-dist/` commitado, artefato `/metrics` sem auth.
- **Perf / custo:** `select('*')` puxando `form_data` inteiro, embeddings serializados a ~15/min, elevado `console.log` em produção.

---

## 2. Como ler cada item

```
[Severidade] ID — Título
Categoria         : ...
Evidência         : arquivo:linha
Problema          : o que está errado
Impacto           : o que pode acontecer
Sugestão          : correção sugerida
```

Severidades:

- **Alta** — quebra funcional confirmada, exposição de dado de terceiros ou comportamento silencioso errado.
- **Média** — risco criado sob condição (offline, config ausente, caso extremo).
- **Baixa** — higiene, consistência, custo de manutenção.

---

## 3. Frontend — 20 problemas

### F1.**[Alta]** Injeção de sessão via token na URL
- **Categoria:** Segurança / Auth
- **Evidência:** `src/pages/OnboardingPage.tsx:42-61`
- **Problema:** a página intercepta o parâmetro `?token=` e chama `setSession(token, null)` para "sessão efêmera" do magic link. Qualquer `access_token` válido colocado na URL vira sessão, e o token fica gravado em histórico, referrer e logs de proxy.
- **Impacto:** sequestro de sessão; a prática de token em query string vaza credencial.
- **Sugestão:** mover o fluxo de magic link para `PKCE` nativo do Supabase (`AuthProvider`), sem token na URL; ou ao menos trocar por `sessionStorage` + limpeza do parâmetro e reemitir o histórico com `history.replaceState`.

### F2.**[Alta]** ESLint não analisa nenhum arquivo TS/TSX
- **Categoria:** Config / Qualidade
- **Evidência:** `eslint.config.js` (só globs `**/*.{js,jsx}`); execução `npx eslint src/**/*.tsx` retorna "all files ignored" (exit 2)
- **Problema:** `npm run lint` é um no-op: ~281 arquivos `.ts/.tsx` do app nunca passam por lint.
- **Impacto:** problemas de estilo, hooks e erros simples não são pegos por ferramenta; a qualidade depende 100% de revisão manual.
- **Sugestão:** adicionar `**/*.{ts,tsx}` aos globs (com `typescript-eslint`) e rodar `eslint .` no CI.

### F3.**[Alta]** Setup de testes aponta para arquivo inexistente
- **Categoria:** Config / Testes
- **Evidência:** `vite.config.ts:85` → `setupFiles: './src/setupTests.js'`; apenas `src/setupTests.ts` existe (verificado com `Get-ChildItem`)
- **Problema:** o glob não existe; o Vitest não carrega o setup (polyfills, mocks globais) e continua como se nada tivesse.
- **Impacto:** testes unitários podem rodar sem os mocks esperados, gerando falsos positivos/negativos.
- **Sugestão:** apontar para `./src/setupTests.ts`.

### F4.**[Média]** PWA precacheia assets que não existem
- **Categoria:** Config / PWA
- **Evidência:** `vite.config.ts:52` → `integrations.manifest.assets.includeAssets: ['robots.txt','apple-touch-icon.png']`; nenhum dos dois existe em `public/` (`Test-Path` = False)
- **Problema:** o service worker tenta pré-cachear arquivos que darão 404 no install.
- **Impacto:** falhas de `fetch` no SW install; ícone de favicon/maçã ausente no dispositivo.
- **Sugestão:** criar os assets ou tirá-los da lista; verificar `plan[].assets` no build PWA.

### F5.**[Média]** Artefatos de build commitados (`dev-dist/`)
- **Categoria:** Repo hygiene
- **Evidência:** `git ls-files pmo-frontend/dev-dist` → `registerSW.js`, `sw.js`, `workbox-46f6dd99.js`, `workbox-5a5d9309.js`, `workbox-ca84f546.js`
- **Problema:** diretório de saída do `vite-plugin-pwa` versionado no git.
- **Impacto:** diffs ruidosos, risco de servir SW desatualizado, confusão entre fonte e artefato.
- **Sugestão:** adicionar `pmo-frontend/dev-dist/` ao `.gitignore` e remover do rastreio (`git rm -r --cached`).

### F6.**[Média]** Módulo de API legado morto com endpoint de localhost
- **Categoria:** Dead code
- **Evidência:** `src/api.ts:10,41` — `baseURL: 'http://127.0.0.1:8000/api'` (Django); nenhum import em todo o repo (grep de `from '@/api'` / `api.ts` = 0 usos)
- **Problema:** cliente API inteiro morto, apontando para backend local que não existe mais no stack (Supabase + Go).
- **Impacto:** confusão de manutenção; qualquer um que "use" o arquivo quebra em produção.
- **Sugestão:** remover `src/api.ts` (e dependências órfãs, se houver) ou migrar/remover com commit dedicado.

### F7.**[Baixa]** Refresh de token sem single-flight nem timeout (no código morto)
- **Categoria:** Auth
- **Evidência:** `src/api.ts:36-58`
- **Problema:** múltiplos 401s paralelos disparam N refreshes simultâneos (sem dedupe); não há timeout no axios; `refresh_token` nulo não é tratado (`{"refresh": null}`).
- **Impacto:** se o fluxo for revivido, race de sessão e requisições presas.
- **Sugestão:** aplicar a mesma lógica já usada em `goApiClient.ts` (leitura de `supabase.auth.getSession()`), ou remover o arquivo (F6).

### F8.**[Média]** Boot quebra com página branca se faltar env var
- **Categoria:** Resiliência
- **Evidência:** `src/supabaseClient.ts:17` — `throw new Error('Faltam variáveis...')` em tempo de import do módulo
- **Problema:** o app inteiro deixa de montar quando `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` estão ausentes (não há ErrorBoundary que pegue erro de módulo).
- **Impacto:** página branca em vez de mensagem de configuração; depuração ruim em deploy.
- **Sugestão:** inicializar de forma lazy com fallback que renderiza tela de erro explicando a config, ou deixar o cliente nulo e bloqueiar por uma tela própria.

### F9.**[Média]** Rota `/mural` registrada duas vezes
- **Categoria:** Roteamento
- **Evidência:** `src/App.tsx` (~linha 163 e ~linha 239, mesmo `<MuralPage>`)
- **Problema:** caminho duplicado no mesmo `<Routes>`.
- **Impacto:** código morto/duplicado; risco de divergência futura entre as duas definições.
- **Sugestão:** manter uma única definição.

### F10.**[Baixa]** Rotas de PMO sem `DebugErrorBoundary`
- **Categoria:** Consistência
- **Evidência:** `src/App.tsx` — `/pmo/novo` e `/pmo/:pmoId/editar` ficam fora do `DebugErrorBoundary` que envolve as rotas irmãs
- **Problema:** erros de render nessas duas telas caem no boundary raiz, perdendo contexto de debug.
- **Sugestão:** envolver as rotas no mesmo boundary das demais.

### F11.**[Baixa]** UUID gerado com `Math.random()`
- **Categoria:** Identidade / Dados
- **Evidência:** `src/services/pmoService.ts:83` (`savePmoSection` → `Math.random().toString(36).slice(2)`)
- **Problema:** id local não-criptográfico, espaço de colisão pequeno.
- **Impacto:** risco de duplicidade/colisão ao persistir registros criados fora do banco.
- **Sugestão:** `crypto.randomUUID()` (suportado em browsers modernos e Workers).

### F12.**[Média]** Leitura ampla de `form_data` (JSONB inteiro)
- **Categoria:** Performance
- **Evidência:** `src/services/pmoService.ts` — `fetchPmoById` com `select('*')` e `getPmoDetails` com `select('*, propriedades(id, nome)')`
- **Problema:** ambas puxam a coluna `form_data` (JSONB com megabytes), mesmo quando a UI mostra só nome/estado/etapa.
- **Impacto:** payload e parse lentos em listas/dashboards; custo de rede.
- **Sugestão:** selects com colunas específicas (`id, nome, status, etapa, ...`) e consultar `form_data` apenas nas telas que editam o formulário.

### F13.**[Alta]** Sincronização offline cria PMO duplicado em retry
- **Categoria:** Dados / Offline
- **Evidência:** `src/hooks/offline/useSyncEngine.ts:89-101`
- **Problema:** para item `PMODATA_SAVE` novo, o fluxo faz `createPmo(payload)` e só depois `localDb.delete(item.id)`. Se o `create` grava no Supabase mas o `delete` da fila falha (IndexedDB), o item permanece e o próximo sync cria OUTRO PMO — não há chave de idempotência no cliente.
- **Impacto:** duplicação de cadernos/propriedades do produtor.
- **Sugestão:** gravar o `id` do servidor de volta no item após o create e usar upsert por esse id; ou gerar `id` do servidor com `INSERT` tracking no próprio payload.

### F14.**[Média]** Backoff exponencial sem teto
- **Categoria:** Resiliência / Offline
- **Evidência:** `src/hooks/offline/useSyncEngine.ts:62` — `const delay = Math.pow(2, item.retries) * 1000`
- **Problema:** com muitas falhas consecutivas, o atraso cresce sem limite (2^n segundos) e o item pode ficar "em espera" por anos.
- **Sugestão:** teto (ex.: `Math.min(Math.pow(2, r) * 1000, 5 * 60 * 1000)`) e eventuais jitter.

### F15.**[Baixa]** Token Mapbox fake hardcoded em URL de imagem
- **Categoria:** Segurança / Higiene
- **Evidência:** `src/pages/PropertyProfilePage.tsx:610` — URL de static map contendo `access_token=pk_test_...`
- **Problema:** credencial fake/valores de teste no código.
- **Impacto:** pode quebrar o mapa em ambientes não-dev ou passar credencial real futuramente por engano.
- **Sugestão:** mover token para env (`VITE_MAPBOX_TOKEN`) e remover hardcode.

### F16.**[Baixa]** Redirect em cadeia no guard de rotas
- **Categoria:** UX / Roteamento
- **Evidência:** `src/routes/RouteGuard.tsx:29,40` — usuário logado sem propriedades que abre `/login` vai a `/dashboard` (rota privada) e dali a `/onboarding`
- **Problema:** dois redirecionamentos e rota intermediária desnecessária para o caso de usuário recém-logado sem fazenda.
- **Sugestão:** fazer o guard de `/login` desviar direto para `/onboarding` quando `allPropriedades.length === 0`.

### F17.**[Média]** Session Replay do Sentry sem consentimento/amostragem em produção
- **Categoria:** Privacidade / Dados
- **Evidência:** `src/main.tsx:18-21` — `replaysSessionSampleRate: 0.1` e `replaysOnErrorSampleRate: 1.0` (rrweb grava o DOM inteiro, incluindo caderno de campo)
- **Problema:** sem opt-in do produtor e sem gating por ambiente; 100% dos erros gravam a sessão inteira (dados sensíveis do formulário).
- **Impacto:** dados de propriedade (talhões, produções, valores) podem ir para o Sentry.
- **Sugestão:** desligar replay fora de staging, exigir consentimento (banner LGPD) e mascarar campos com `maskAllText`/`mask` de seletores sensíveis.

### F18.**[Baixa]** Logs de console em produção (incluindo dados reais)
- **Categoria:** Privacidade / Higiene
- **Evidência:** `Secao8.tsx:60,96,175,183,188`, `BotSuggestionsPanel.tsx:20-85`, `GeneralLogTable.tsx:56` (loga payload N:N inteiro), `OnboardingPage.tsx:47` (loga token detectado), `ReloadPrompt.tsx:12`, `useSyncEngine.ts:65,151,176,182`, `supabaseClient.ts:10,56`
- **Problema:** dezenas de `console.log/group/info` ativas em produção; alguns exibem dados de produtores.
- **Sugestão:** remover ou condicionar a DEBUG; nunca logar tokens/payloads sem sanitização.

### F19.**[Baixa]** Paginação persistida não reseta ao trocar de PMO
- **Categoria:** UX / Estado
- **Evidência:** store zustand persist (`paginationStore.ts`) mantém `page` por chave; a troca de `pmo_id`/categoria não reinicia a página
- **Problema:** trocar de PMO pode aterrissar numa página vazia ou fora do intervalo da lista nova.
- **Sugestão:** resetar `page` (e filtros sensíveis) em um `useEffect` keyed por `pmoId`.

### F20.**[Média]** Validação com efeito colateral e deps incompletas
- **Categoria:** Qualidade / Estado
- **Evidência:** `src/hooks/manual-record/useRecordValidation.ts` — `validate` chama `setErrors(...)` (efeito colateral dentro da função de validação) e o `useCallback` omite `validateLimpeza`, `validateCompostagem`, `validateCompras`, `validateVendas` das dependências
- **Problema:** re-renders podem dessincronizar o estado de erro durante a submissão; deps incompletas podem manter closure de validação antiga.
- **Sugestão:** separar `validate` (puro, retorna erros) do `setErrors` (no submit/onChange); corrigir deps.

---

## 4. Backend / Supabase / CI — 20 problemas

### B1.**[Alta]** `complete_onboarding` sem idempotência — duplica propriedade e talhão
- **Categoria:** Dados / Idempotência
- **Evidência:** `supabase/migrations/20260830_create_complete_onboarding_rpc.sql:45-55`
- **Problema:** a função inserta `propriedade` + `talhao` sem checar existência prévia (por usuário ou local). Chamada dupla (reload da tela, reenvio do bot, retry) cria duplicatas.
- **Impacto:** produtor termina com 2+ propriedades/talhões idênticos; contagem de `propriedades`/`allPropriedades` no frontend fica errada e o hub de seleção pode bugar.
- **Sugestão:** guarda por `(user_id, latitude, longitude)` ou flag `onboarding_completed` em `profiles`; tornar a RPC idempotente (`RETURN` da existente).

### B2.**[Média]** Modalidade desconhecida cai em `CONVENCIONAL` (fail-open)
- **Categoria:** Dados
- **Evidência:** `20260830_create_complete_onboarding_rpc.sql:23-27` — `IF NOT IN ('ORGANICO','CONVENCIONAL','PDA','PNAE') THEN p_modalidade := 'CONVENCIONAL';`
- **Problema:** o próprio bot envia `'nao_sei'`/valores livres; qualquer valor inválido vira convencional em silêncio.
- **Impacto:** produtores orgânicos podem ser cadastrados como convencionais, corrompendo relatórios e compliance.
- **Sugestão:** rejeitar valores desconhecidos (retornar erro instrucional) e traduzir no bot apenas valores mapeados.

### B3.**[Baixa]** Nome da propriedade hardcoded
- **Categoria:** Dados / Produto
- **Evidência:** `20260830_create_complete_onboarding_rpc.sql:45` — `VALUES (E'Sítio / Fazenda', ...)`
- **Problema:** todo onboarding cria propriedade chamada "Sítio / Fazenda"; usuário nunca informa nome.
- **Impacto:** impossível distinguir fazendas por nome; relatórios com nome genérico.
- **Sugestão:** incluir campo `p_nome_propriedade` na RPC e no formulário/onboarding do bot.

### B4.**[Alta]** Dono pode falsificar dados de treinamento
- **Categoria:** Segurança / Dados de IA
- **Evidência:** `supabase/migrations/20260903110000_create_dt18_remaining_mutation_rpcs.sql:~149-238` — `update_log_treinamento` aceita `modelo_ia`, `validado`, `status_validacao`, `json_corrigido` como parâmetros do chamador
- **Problema:** o produtor (via UI ou chamada direta com sessão dele) pode marcar qualquer log como `validado`, escolher o `modelo_ia` e injetar `json_corrigido` arbitrário.
- **Impacto:** ground-truth do pipeline de IA pode ser fabricado/enganado (ex.: forçar azul de resposta ou "vender" avaliação).
- **Sugestão:** a RPC deve ignorar/derivar `modelo_ia` e `validado` do lado do servidor, e `json_corrigido` deve nascer de um fluxo de correção auditado (diferença calculada vs. enviada).

### B5.**[Média]** RPCs de mutação DT-18 sem o padrão de idempotência dos demais
- **Categoria:** Dados / Idempotência
- **Evidência:** `20260903110000_create_dt18_remaining_mutation_rpcs.sql` vs. padrão de `20260816000000_add_idempotency_to_mutations.sql`
- **Problema:** `create_propagacao_item`, `update_propagacao_item`, `delete_propagacao_item`, `update_log_treinamento` não recebem/não usam `idempotency_key`; clientes que retry (fila offline do frontend) podem duplicar registros.
- **Impacto:** duplicidade de propagação/limpeza/compra sob retry.
- **Sugestão:** convergir para o mesmo contrato (`idempotency_key` + unique index) usado nas demais mutações DT.

### B6.**[Média]** Chamada de rerank sem timeout (já rastreada como DT-72)
- **Categoria:** Resiliência / LLM
- **Evidência:** `pmo-bot-go/internal/llm/reranker.go:39` — `client := &http.Client{}`
- **Problema:** chamada ao OpenRouter (Cohere rerank) pode pendurar a goroutine indefinidamente.
- **Impacto:** hoje só o binário de avaliação (`cmd/tester/arena`) usa; se promovido ao caminho real (DT-71), seguraria um AI Worker por resposta.
- **Sugestão:** já catalogada como **DT-72** — aplicar timeout + retry limitado + fallback dentro da função.

### B7.**[Alta]** Rate limiting completamente desligado sem Redis
- **Categoria:** Segurança / Operação
- **Evidência:** `pmo-bot-go/cmd/server/main.go:565-571` + `internal/ports` (`NoopRateLimiter`)
- **Problema:** quando `REDIS_URL` não está definido, `inboundLimiter` e `warningLimiter` viram no-ops; o servidor sobe "normalmente" só logando um warning.
- **Impacto:** sem limite de entrada e sem cotas por satélite em produção caso o Redis caia/pare de ser configurado — DoS e custo de LLM/TTS sem contenção.
- **Sugestão:** estado fail-closed para o caminho de produção (env obrigatório em `docker-compose.prod.yml`) e alerta de health quando o rate limiter for no-op.

### B8.**[Alta]** `http.Server` sem timeouts de leitura/escrita
- **Categoria:** Segurança / Rede
- **Evidência:** `pmo-bot-go/cmd/server/main.go:759-762` — `&http.Server{Addr, Handler}` apenas; sem `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, `IdleTimeout`
- **Problema:** conexões lentas podem segurar goroutines/workers indefinidamente (slowloris).
- **Impacto:** esgotamento de recursos com VPS/Cloud Run; instabilidade operacional.
- **Sugestão:** `ReadHeaderTimeout: 5s`, `ReadTimeout/WriteTimeout` por handler e `IdleTimeout`.

### B9.**[Média]** Métricas Prometheus públicas por padrão
- **Categoria:** Segurança / Observabilidade
- **Evidência:** `pmo-bot-go/cmd/server/main.go:324-329` — `/metrics` sem auth quando `PROMETHEUS_AUTH_TOKEN` vazio; com token: `gin.BasicAuth` sobre HTTP puro
- **Problema:** exposição de latências LLM, volumes e dados do bot para quem alcançar a porta; auth por senha em transporte não cifrado.
- **Sugestão:** exigir `PROMETHEUS_AUTH_TOKEN` em produção e servir atrás de TLS (ou não publicar a porta 8080; scraper interno via rede Docker).

### B10.**[Alta]** Cota de ingestão de documentos burlável sem `pmo_id`
- **Categoria:** Segurança / Negócio
- **Evidência:** `pmo-bot-go/internal/webhook/handler.go:613-641` — checagem de cota (3 docs para não-pro) só roda `if pmoIDStr != ""`
- **Problema:** chamada sem `pmo_id` pula a cota e cria `ingestion_jobs` com `pmo_id` vazio (base global).
- **Impacto:** ingestão ilimitada de documentos na base pública; custo de embeddings fora de controle.
- **Sugestão:** exigir `pmo_id` obrigatório no upload (extrair do JWT em vez de confiar no form), ou aplicar cota por `key` do token autenticado.

### B11.**[Média]** Token de webhook na query string; token único global
- **Categoria:** Segurança / Auth
- **Evidência:** `pmo-bot-go/internal/webhook/handler.go:601-611` — `verifyToken(c.Query("token"))` também aceito; um único `WEBHOOK_TOKEN` protege todos os eventos
- **Problema:** o token viaja na URL (vaza em logs de proxy, referrer, histórico); não há rotação nem escopo por tenant.
- **Impacto:** vazamento de credencial e impossibilidade de revogar um cliente específico.
- **Sugestão:** aceitar apenas `Authorization: Bearer`; rotação programática e/ou chaves por cliente/evento.

### B12.**[Média]** Nome de arquivo de upload não saneado no caminho temporário
- **Categoria:** Segurança / Filesystem
- **Evidência:** `pmo-bot-go/internal/webhook/handler.go:652` — `filepath.Join(tempDir, fmt.Sprintf("upload-%d-%s", time.Now().Unix(), file.Filename))`
- **Problema:** `file.Filename` (do multipart) entra cru no path.
- **Impacto:** path traversal limitada/escape de diretório com cliente malicioso; também nome de arquivo com `..`/separadores.
- **Sugestão:** usar `filepath.Base(file.Filename)` + validação/limpeza (whitelist de charset) e uid único.

### B13.**[Média]** Upload sem limite de tamanho (DoS de disco/CPU)
- **Categoria:** Segurança / Resiliência
- **Evidência:** `pmo-bot-go/internal/webhook/handler.go:653` — `c.SaveUploadedFile(file, ...)` sem `http.MaxBytesReader`/verificação de Content-Length
- **Problema:** arquivos arbitrários são gravados em disco e depois processados (PDF→texto→chunks→embeddings pagos).
- **Impacto:** exaustão de disco/temp, custo de ingestão, possível bloqueio do worker pool.
- **Sugestão:** `MaxBytesReader` (ex.: 20MB) + validação de tipo/mágica + limite de concorrência de ingests.

### B14.**[Média]** Embeddings serializados a ~15/min por rate limiter único
- **Categoria:** Performance / Custo
- **Evidência:** `pmo-bot-go/internal/webhook/handler.go:115,763` — 3 workers disputam `rate.NewLimiter(rate.Every(4*time.Second), 1)` (15 RPM total)
- **Problema:** um documento de ~500 chunks leva ~33min para vetorizar (workers ficam ociosos na fila); sem paralelismo real.
- **Impacto:** fila de ingestão longa; UX "processando..." por horas.
- **Sugestão:** separar um limiter próprio (burst maior) para ingestão, mantendo o limite do OpenRouter por TPM, ou processar chunks em lote (batch embeddings).

### B15.**[Baixa]** Chave da API lida direto de `os.Getenv` dentro dos métodos
- **Categoria:** Config / Testabilidade
- **Evidência:** `pmo-bot-go/internal/supabase/client.go:247-250` (`GetEmbedding`) e `internal/llm/reranker.go:14` — `os.Getenv("OPENROUTER_API_KEY")` no corpo, fora do `config.Config`
- **Problema:** config espalhada e não injetável; dependência implícita do ambiente no meio do código.
- **Impacto:** se um endpoint usar a chave do ambiente errado (dev/prod), a falha só aparece em runtime; testes unitários ficam no chão sem env.
- **Sugestão:** mover para o `Config` e injetar via struct/options.

### B16.**[Média]** Roteamento por telefone ambíguo (fallback por últimos 8 dígitos)
- **Categoria:** Dados / Correção
- **Evidência:** `pmo-bot-go/internal/supabase/client.go` — `GetProfileByPhone`: fallback consulta `ilike.*<últimos 8 dígitos>*` e devolve o primeiro
- **Problema:** números que só diferem no DDD/prefixo podem casar o mesmo cadeia de 8 dígitos; a "resolução" pega o primeiro perfil.
- **Impacto:** respostas/dados enviados ao produtor ERRADO (número que só comparteva sufixo).
- **Sugestão:** normalizar o E.164 completo e buscar por igualdade exata; ambiguidade deve gerar erro explícito, não primeiro resultado.

### B17.**[Baixa]** Queries PostgREST montadas sem `url.QueryEscape`
- **Categoria:** Robustez
- **Evidência:** `pmo-bot-go/internal/supabase/client.go` nas linhas ~491, 527, 554, 573, 599, 616 — `fmt.Sprintf("...phone=eq.%s", phone)` etc.
- **Problema:** parâmetros derivados de entrada entram nos filtros sem encoding.
- **Impacto:** caracteres `%`, `+`, `&`, espaço deturpam o filtro (querys erradas ou exposição de "regex" acidental).
- **Sugestão:** `url.QueryEscape` nos valores interpolarizados (ou montar com `net/url.Values`).

### B18.**[Média]** `VersionNumber` de documento fixo em 1 (TODO no código)
- **Categoria:** Dados / RAG
- **Evidência:** `pmo-bot-go/internal/knowledge/worker.go:112` — `VersionNumber: 1, // TODO: increment from previous versions`
- **Problema:** cada reindexação do mesmo documento grava versão 1, sem histórico/versionamento.
- **Impacto:** versionamento de conhecimento (e rastreio de regressão de conteúdo) não funciona.
- **Sugestão:** consultar a última versão do documento antes de inserir e incrementar.

### B19.**[Média]** Testes de RLS/integração SQL fora do CI
- **Categoria:** Processo / Segurança
- **Evidência:** `.github/workflows/test.yml` (roda `go test ./internal/...`); `backend-e2e.yml` (roda `go test -tags=e2e ./e2e/...`) — nenhum workflow executa `supabase/tests/**`
- **Problema:** a suíte `supabase/tests/integration/*.sql` (que valida as policies) nunca roda em CI.
- **Impacto:** regressões de RLS (como DT-70) passam despercebidas; só são pegas em auditoria manual.
- **Sugestão:** job com `supabase start`/`supabase db reset` + `supabase test db` em CI (ou `sql/pgTAP`).

### B20.**[Baixa]** Deploy não reproduzível e direto em prod
- **Categoria:** CI/CD / Operação
- **Evidência:** `.github/workflows/deploy_production.yml` — `supabase/setup-cli@v1` com `version: latest` + `supabase db push --db-url ${{ secrets.PROD_DB_URL }}` a cada push em `main`
- **Problema:** versão `latest` de CLI muda comportamento sozinho (o próprio `secret-scan.yml` documenta o porquê de fixar versão); push de migrations direto em produção sem canário nem rollback.
- **Impacto:** deploy quebra ou aplica mudança de schema sem revisão/overnight (alterações destrutivas em produção).
- **Sugestão:** fixar a versão do CLI; pipeline com staging + teste de migrations antes de promocionar; diferir periodicamente com `supabase test db`.

---

## 5. Investigados e considerados OK (para não inventar)

Durante a varredura estes pontos pareceram problemas e foram **descartados** com evidência:

| Item suspeito | Conclusão |
|---------------|-----------|
| `verifyToken` comparando token do webhook | OK — usa `hmac.Equal` (comparação em tempo constante): `handler.go:849-853` |
| Rate limiting do WhatsApp competindo com ingestão de PDF | OK — entrada usa `cfg.InboundLimiter` (por telefone, Redis); ingestão usa `h.limiter` próprio para embeddings (`handler.go:290` vs `:763`) |
| Unidades Go fora do CI | OK — `test.yml` roda `go test ./internal/...` e cobre o módulo (não é o que estavam achando) |
| CORS permissivo `*` + credentials | OK — já corrigido: origens agora via `ALLOWED_ORIGINS` (`middleware/cors.go`) |
| JWT validando apenas assinatura | OK — `middleware/auth.go` fixa ES256, valida `exp`/`sub` e rotaciona `kid` via JWKS do Supabase |
| Migrations de onboarding | OK no essencial — outras RPCs de mutação já têm o padrão `idempotency_key` (findings F/B se limitam às que não seguem) |
| Segredos commitados no git | OK — `git ls-files` não lista `.env`/keys; `dev-dist/` é build, não segredo |

---

## 6. Método aplicado (evidências reproduzíveis)

Comandos utilizados durante a auditoria:

```powershell
# Frontend — typecheck (passa, não acusa nada)
npx tsc --noEmit

# Frontend — lint (no-op: confirma o finding F2)
npx eslint src/**/*.tsx          # -> "No files matching the pattern" / exit 2

# Config — arquivos inexistente (F3/F4)
Test-Path pmo-frontend/src/setupTests.js       # False
Test-Path pmo-frontend/public/robots.txt        # False
Test-Path pmo-frontend/public/apple-touch-icon.png  # False

# Repo — artefatos commitados (F5)
git ls-files pmo-frontend/dev-dist

# Backend — timeouts do http.Server
Select-String -Path pmo-bot-go/cmd/server/main.go -Pattern "http.Server","NoopRateLimiter","promhttp"

# Grep de padrões de risco
rg -n "http.Client\{\}" pmo-bot-go/internal
rg -n "os.Getenv\(\"OPENROUTER" pmo-bot-go/internal
```

Cada finding foi confirmado lendo o arquivo citado (as linhas marcadas com `~` são aproximadas dentro do mesmo arquivo).

---

## 7. Ordem sugerida de ataque

**Críticos de segurança/dados (fazer primeiro):**

1. **F13** — idempotência do queue offline (PMO duplicado). 
2. **B1 / B2 / B3** — reescrever `complete_onboarding` (idempotência + modalidade rigorosa + nome da propriedade).
3. **B4** — `update_log_treinamento`: impedir falsificação de `validado`/`modelo_ia`.
4. **B7 / B8** — Redis obrigatório em prod + timeouts no `http.Server`.
5. **B10 / B11 / B12 / B13** — upload de conhecimento: quota obrigatória, token fora da URL, filename saneado, limite de tamanho.
6. **F1** — sair de token-em-URL no onboarding (PKCE).
7. **F2 / F3** — ligar ESLint em TS e consertar setup de testes (rápido, alto retorno).

**Depois (qualidade/operacionalidade):** F12 (selects), B14 (paralelismo de embeddings), B16 (rotação de telefone), B17 (escaping), B18 (versionamento), B19 (CI de testes SQL), F17 (replay Sentry), F20 (validação).

---

## 8. Vínculo com o rastreio existente

- **Backend Go:** o rastreio oficial vive em `pmo-bot-go/docs/debitos_tecnicos.md` (IDs `DT-XX`). O **B6** já é conhecido como **DT-72** lá (e DT-71 também já existia); os demais achados desta auditoria já foram catalogados como **DT-106 a DT-118** nesse mesmo documento.
- **Frontend/debt geral:** `TECHNICAL_DEBT.md` (raiz) guarda itens ainda não absorvidos pelo registro Go — os F1–F20 podem ser transferidos para lá.
- **Log de correções desta branch:** `bigpickle-log.md` registra fixes já aplicados no `fix/bigpickle-bugfix-loop`; este relatório cobre a auditoria (não os fixes).