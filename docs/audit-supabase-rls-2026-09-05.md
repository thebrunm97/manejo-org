# Auditoria Supabase RLS — 2026-09-05

- **Data:** 2026-09-05
- **Escopo:** `supabase/migrations/` (137 `CREATE POLICY`, 55+ `SECURITY DEFINER` functions verificadas), `supabase/seed.sql`
- **Método:** revisão por leitura de código dirigida (`CREATE POLICY`, `SECURITY DEFINER`, `GRANT`/`REVOKE`, `GRANT EXECUTE`); cada item confirmado em arquivo:linha antes de ser registrado. Nenhum item foi inventado. Itens já remediados (DT-46/62/65/70/20) são listados apenas como confirmados.
- **Resultado:** 4 vulnerabilidades **Críticas** (exploráveis por `anon` sem função pretendida), 4 **Altas** (atores escapam de seus authorizadores), 4 **Médias** (grants latentes/anti-patterns), 2 **Baixas** (higiene). Registrados como **DT-93..DT-105** em `pmo-bot-go/docs/debitos_tecnicos.md`.

---

## 1. Resumo executivo

| Severidade | Qtd | Tema dominante |
|------------|-----|----------------|
| 🔥 Crítica | 4 | `SECURITY DEFINER` com `EXECUTE` aberto a `PUBLIC` (anon incluído) |
| 🟠 Alta | 4 | Policy/UPDATE sem `WITH CHECK`, read cross-tenant, claim JWT errado |
| 🟡 Média | 4 | Grants nunca revogados (latentes), corpo RPC IDOR residual |
| 🟢 Baixa | 2 | Seed quebrado, bucket de storage público |

Padrão que se repete: **funções `SECURITY DEFINER` criadas sem `REVOKE ALL` + `GRANT` explícito** caem no default do Postgres (`EXECUTE TO PUBLIC`, que inclui `anon` e `authenticated`). O padrão seguro já praticado nas RPCs DT-18 (`SET search_path` + `auth.uid()` + ownership check + `REVOKE`/`GRANT`) deve ser aplicado retroativamente às funções abaixo.

---

## 2. Como ler cada item

```
[Severidade] ID — Título
Evidência   : arquivo:linha
Problema    : o que está errado
Impacto     : o que pode acontecer
Sugestão    : correção sugerida
```

Severidades:

- **Crítica** — explorável ao vivo sem a função pretendida (anon pode ler/escrever dado de outro tenant).
- **Alta** — ator autenticado pode acessar/escrever dados fora do seu tenant ou reatribuir ownership.
- **Média** — risco latente sob condição (erro futuro de policy) ou anti-pattern que permite escalação se re-grantado.
- **Baixa** — higiene, reproducibilidade, consistência.

---

## 3. Críticas (4)

### R1.**[Crítica]** `save_pmo_memory_cache` / `match_pmo_memory_cache` executáveis por `PUBLIC` (anon)
- **Evidência:** `supabase/migrations/20260905153000_b_create_pmo_memory_cache_rpc.sql:2,43` — `SECURITY DEFINER SET search_path = public`, parâmetros `p_user_id`/`p_pmo_id` fornecidos pelo chamador, **sem** `REVOKE`/`GRANT` em nenhuma migration (grep confirmou).
- **Problema:** `EXECUTE` default do Postgres = `PUBLIC` (`anon` + `authenticated`). A função não valida `auth.uid()` contra os ids recebidos.
- **Impacto:** qualquer chamador anônimo escreve/sobrescreve o cache de memória de qualquer PMO (`save`) e lê fragmentos de memória cross-tenant (`match`). Corrompe a memória persistente do agente.
- **Sugestão:** `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;` + `GRANT EXECUTE ... TO service_role` (o bot autentica com service role); ou adicionar check `auth.uid() = p_user_id` + validação de posse do `pmo_id` (padrão DT-18).

### R2.**[Crítica]** `create_or_supersede_mutation_draft` / `commit_mutation_draft` executáveis por `PUBLIC` (anon)
- **Evidência:** `supabase/migrations/20260816010000_create_mutation_drafts.sql:44,121` — `SECURITY DEFINER SET search_path = public`, `p_user_id`/`p_pmo_id`/`p_draft_id` fornecidos pelo chamador, sem REVOKE.
- **Problema:** a RLS da tabela (`mutation_drafts`, SELECT por dono) protege leitura, mas as RPCs `SECURITY DEFINER` ignoram RLS e o `EXECUTE` está aberto.
- **Impacto:** anon (via PostgREST) pode criar e commitar rascunhos de mutação — gravando em `caderno_campo`, `transacoes_financeiras`, `cotas_produtores` como qualquer owner, sem nenhuma checagem.
- **Sugestão:** `REVOKE ALL` + `GRANT EXECUTE TO service_role` (o HITL roda no backend do bot) OU validar `auth.uid() = p_user_id` e posse do `pmo_id` no corpo.

### R3.**[Crítica]** `get_knowledge_role()` faz fallback para `user_metadata` (privilege escalation)
- **Evidência:** `supabase/migrations/20260721180000_knowledge_ops_panel.sql:14-21` — `COALESCE(app_metadata->>'knowledge_role', user_metadata->>'knowledge_role', 'none')`.
- **Problema:** `user_metadata` é editável pelo próprio usuário (Supabase permite o cliente atualizar `raw_user_meta_data`). Qualquer usuário autenticado pode se autodeclarar `knowledge_publisher`/`knowledge_editor` colocando o claim no `user_metadata`, e TODAS as policies `kd_*`/`kv_*`/`ij_*`/`rql_*`/`rf_*`/storage herdam essa decisão.
- **Impacto:** escalonamento para papel de editor, revisor ou publicador de conhecimento (upload, publish de versão, leitura de chunks). Nega a intenção do RBAC `knowledge_*`.
- **Sugestão:** ler **apenas** `app_metadata` (não-editável) ou derivar papel de tabela (ex.: `profiles.role` / tabela de permissões); nunca de `user_metadata`.

### R4.**[Crítica]** `claim_next_ingestion_job` / `publish_knowledge_version` executáveis por `PUBLIC` (anon)
- **Evidência:** `supabase/migrations/20260721180100_knowledge_ops_rpcs.sql:10,49` — `SECURITY DEFINER`, sem `SET search_path`, sem auth check, sem REVOKE (grep confirmou). `upsert_arena_models` (`20260723120000_update_rag_arena_models_sync.sql:14`) no mesmo padrão.
- **Problema:** `claim_next_ingestion_job` entrega uma linha da fila de ingestão para QUALQUER chamador que inventar um `worker_id`; `publish_knowledge_version` move qualquer versão para `live`; `upsert_arena_models` reescreve o catálogo de modelos da arena.
- **Impacto:** sequestro/quebra da fila de processamento (jobs marcados `extracting` e nunca concluídos), publicação arbitrária de versões de conhecimento, corrupção do catálogo de modelos do RAG.
- **Sugestão:** `REVOKE ALL` + `GRANT EXECUTE TO service_role` (worker roda com service role); adicionar `SET search_path` explícito.

---

## 4. Altas (4)

### A1.**[Alta]** `knowledge_chunks` — policy `USING (true)` para authenticated (read cross-tenant total)
- **Evidência:** `supabase/migrations/20260823110000_sync_prod_orphan_functions.sql:78-84` — `FOR SELECT TO authenticated USING (true)`; e `GRANT SELECT ... TO anon` na linha 84.
- **Problema:** qualquer usuário autenticado lê todos os chunks de conhecimento de todos os tenants; sem escopo por `pmo_id`/organização.
- **Impacto:** vazamento inter-tenant do conteúdo semântico ingestado (documentos de cada produtor/cooperativa).
- **Sugestão:** escopar por `pmo_id` (mesmo padrão das demais tabelas) ou por `get_knowledge_role()`; revogar o grant de `anon`.

### A2.**[Alta]** `profiles` UPDATE sem `WITH CHECK` — `pmo_ativo_id` reatribuível pelo usuário
- **Evidência:** `supabase/migrations/20260401_create_profiles.sql:61-64` — policy `FOR UPDATE USING (id = auth.uid())` **sem** `WITH CHECK`. A coluna `pmo_ativo_id` (perfil, linha 11) autoriza acesso a tabelas financeiras (`transacoes_financeiras`, policies em `20260525_create_financial_ledger.sql`) e a RPC `update_profile` (`20260818140000_create_domain_mutation_rpcs.sql:8-37`) re-expõe o campo ao usuário.
- **Problema:** o usuário pode mudar seu próprio `pmo_ativo_id` para outro PMO e acessar o ledger/caderno desse tenant (tenant-shift por reatribuição de `pmo_ativo_id`), enquanto os policies financeiros confiam no campo.
- **Impacto:** leitura e escrita de dados financeiros de outro produtor apenas alterando o próprio perfil.
- **Sugestão:** adicionar `WITH CHECK (id = auth.uid())` e bloquear UPDATE de `pmo_ativo_id` via trigger (estender semântica de `trg_prevent_self_promotion`, `20260823110000...:258-274`).

### A3.**[Alta]** Massa de policies `FOR ALL` com `USING` e **sem** `WITH CHECK` (reaassigna/deleção em massa)
- **Evidência:** `20260402000000_create_core_app_tables.sql`: `propriedades:26`, `pmos:46`, `talhoes:83`, `canteiros:108`, `ciclos_cultivo:130`, `analises_solo:163`, `caderno_campo:211`, `caderno_campo_canteiros:231`, `culturas_anuais:247`, `lotes_rastreabilidade:294`, `pmo_culturas:316`, `pmo_manejo:337`, `pmo_pragas:352`, `pmo_equipamentos:372`, `pmo_insumos:392`, `pmo_propagacao:412`, `pmo_limpeza:433`, `pmo_clima:453`; também `categorias_financeiras:142-149` (`20260525_create_financial_ledger.sql`) e `conversations` admin ALL sem WITH CHECK (`20260825020000...:37-39`).
- **Problema:** `FOR ALL` engloba INSERT/UPDATE/DELETE com o mesmo `USING` de SELECT. Sem `WITH CHECK`, um UPDATE pode reatribuir `user_id`/`pmo_id` de uma linha para outro dono (a policy de UPDATE precisa de `USING` para a linha alvo, e `WITH CHECK` para os valores novos — sem o segundo, a reatribuição passa); e DELETE de listas inteiras é permitido.
- **Impacto:** reatribuição de ownership (ex.: mover `talhao` para outro usuário) e exclusões em massa silenciosas.
- **Sugestão:** trocar `FOR ALL` por policies separadas por operação, ou adicionar `WITH CHECK` replicando a condição de `USING`; coverso feito no DT-70 serve de referência.

### A4.**[Alta]** Policy de admin usa `auth.jwt() ->> 'role' = 'admin'` — sempre falsa para admins reais
- **Evidência:** `supabase/migrations/20260721230000_rag_judge_runs.sql:36-41`.
- **Problema:** o claim `role` do JWT é o papel do banco Postgres (`authenticated`), não o papel da aplicação (que vive em `profiles.role`). A condição é — na prática — sempre falsa para um usuário autenticado normal; admins ficam sem gerenciar `rag_run_judgments`, e o caminho de escrita fica restrito a `service_role`/supabase_admin.
- **Impacto:** sub-privilegiado (funcional), mas também um anti-pattern que confunde quem lê (parece um check de admin e não é). Ligado a `is_admin()` que confia em `profiles.role` (ver A2: sem `WITH CHECK` no perfil, toda a árvore admin fica fragilizada).
- **Sugestão:** usar `EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')`, o padrão já usado em ~40 policies do repo.

---

## 5. Médias (4)

### M1.**[Média]** `messages` — `GRANT SELECT, INSERT, UPDATE, DELETE` a `anon` + `authenticated` nunca revogado
- **Evidência:** `supabase/migrations/20260610120000_evolve_messages_table.sql:116`.
- **Problema:** grant amplo concedido e **nunca revogado**. Hoje a RLS segura `anon` e autenticados veem só o próprio; mas qualquer erro futuro de policy (ou re-grant) em `messages` expõe mensagens de todos instantaneamente — camada abaixo da RLS, latente.
- **Impacto:** superfície de risco residual; viola o princípio do menor privilégio.
- **Sugestão:** `REVOKE ALL ON public.messages FROM anon;` e, se aplicável, `authenticated` (o backend/UI deve usar RPCs).

### M2.**[Média]** `knowledge_chunks` / `invalid_auth_token` com grants a `anon` latentes
- **Evidência:** `20260823110000_sync_prod_orphan_functions.sql:84-86` (`knowledge_chunks` → authenticated read-all + `GRANT SELECT` a anon) e `20260823110100_add_n8n_invalid_auth_token.sql:46-47`.
- **Problema:** grants a `anon` para tabelas sensíveis; hoje bloqueados pelas policies (target `authenticated`), mas qualquer policy futura que mire `anon` expõe tudo.
- **Sugestão:** `REVOKE ALL ... FROM anon` nessas tabelas.

### M3.**[Média]** `rpc_registrar_compra_insumo` — corpo continua IDOR, protegido só por grants
- **Evidência:** `20260607_fase2_ledger_rateio.sql:5,24` + `20260609002200_add_raw_payload_to_rpcs.sql:241` — `SECURITY DEFINER` sem `SET search_path`; acesso hoje restrito a `service_role` via `20260824140000_revoke_dt65_gen1_rpc_grants.sql:22-25`.
- **Problema:** o corpo segue aceitando `user_id`/`propriedade_id` do chamador sem validar posse (IDOR). O `REVOKE` para service_role é a única coisa em pé; qualquer re-grant acidental reabre o IDOR silenciosamente.
- **Impacto:** risco residual de escalação se o grant mudar; padrão divergente do DT-65 (que reescreveu `rpc_registrar_transacao_com_rateio` com `auth.uid()`).
- **Sugestão:** reescrever o corpo para derivar `user_id` de `auth.uid()` + validação de posse (padrão usado no DT-65 para `rpc_registrar_transacao_com_rateio`).

### M4.**[Média]** `seed.sql` quebrado — colunas inexistentes em `profiles`
- **Evidência:** `supabase/seed.sql:4` — `INSERT INTO public.profiles (id, user_id, full_name, role)`; o schema (`20260401_create_profiles.sql:6-16`) tem `id, nome, telefone, role, pmo_ativo_id, bonus_credits, bonus_expires_at`; `user_id`/`full_name` **não existem**.
- **Problema:** `supabase db reset` aplica as migrations mas falha no seed; o ambiente local fica sem dados de exemplo e quem tenta resetar recebe `ERROR: column "user_id" of relation "profiles" does not exist`.
- **Impacto:** on-boarding de devs e `supabase test db` quebrados; a suíte de testes SQL (DT-91) nem roda por isso também.
- **Sugestão:** alinhar `seed.sql` ao schema (usar colunas `(id, nome, telefone, role, ...)` e POMs/talhões legítimos) para o reset funcionar de ponta a ponta.

---

## 6. Baixas (2)

### B1.**[Baixa]** `rag_experiments` / `rag_experiment_runs` — observers leem snapshots de qualquer tenant
- **Evidência:** `20260721221610_playground_benchmarks.sql:48-96` — policies gateiam por `get_knowledge_role()` (vulnerado pelo R3) e **não escopam por `pmo_id`**; `retrieved_chunks_snapshot` fica legível por qualquer observer.
- **Impacto:** menor (conteúdo de avaliação/benchmark), mas agrava R3 e expõe dados de experimentos entre tenants.
- **Sugestão:** escopar por `pmo_id` nas duas tabelas.

### B2.**[Baixa]** Bucket de storage `audios_audit` público (fora de SQL)
- **Evidência:** comentado em `20260822160000_create_audit_vault.sql` (linhas ~18-21, 62) como P0-1; a tabela `audios_audit` (via `20260822170000_audios_audit_signed_url_policy.sql`) é exemplar (FORCE RLS, titular-only), mas o bucket storage correspondente permanece público e sem política de assinatura.
- **Impacto:** áudios de auditoria potencialmente acessíveis sem assinatura se a URL for conhecida.
- **Sugestão:** tornar o bucket privado e aplicar políticas de signed URL sob demanda (padrão já aplicado em `audioSigningService.ts` para áudios do bot).

---

## 7. Confirmados como remediados (não são achados novos)

| Item | Status |
|------|--------|
| DT-70 — policies permissivas em `canteiros`/`analises_solo`/`culturas_anuais`/`pmo_propagacao` | ✅ `20260903100000_fix_dt70_permissive_rls_policies.sql` |
| DT-46 — 7+ `SECURITY DEFINER` do lote órfão abertas a anon | ✅ `20260901150000_fix_dt46_security_definer_functions.sql` |
| DT-65 — RPCs gen1 `*_arg` com `EXECUTE` público | ✅ `20260824140000_revoke_dt65_gen1_rpc_grants.sql` |
| DT-20 — IDOR em `setup_initial_profile` | ✅ `20260817195000_fix_idor_setup_initial_profile.sql` |
| DT-62 — `view_conversas_recentes` sem `security_invoker` + grant anon | ✅ `20260901140000_fix_view_conversas_recentes_rls_bypass.sql` (segurança_invoker + REVOKE anon) — **vigiar regressão em recriações da view** |
| DT-18 — RPCs novas seguem padrão seguro (`SET search_path` + `auth.uid()` + ownership + REVOKE/GRANT) | ✅ |

---

## 8. Ordem sugerida de ataque

1. **REVOKE + GRANT** para R1, R2, R3, R4 (`save_pmo_memory_cache`, `match_pmo_memory_cache`, `create_or_supersede_mutation_draft`, `commit_mutation_draft`, `get_knowledge_role`, `claim_next_ingestion_job`, `publish_knowledge_version`, `upsert_arena_models`) — migrations de 5 minutos, neutralizam os vetores críticos.
2. **R3** — reescrever `get_knowledge_role()` para ler só `app_metadata` (ou tabela); derruba toda a árvore `knowledge_*`.
3. **A2 + A3** — `WITH CHECK` nas policies `profiles` e nas `FOR ALL` do core; estender `trg_prevent_self_promotion` para proteger `pmo_ativo_id`.
4. **A1 / M1 / M2** — escopar `knowledge_chunks` e `REVOKE ALL FROM anon` em `messages`, `knowledge_chunks`, `invalid_auth_token`.
5. **M3** — reescrever corpo de `rpc_registrar_compra_insumo` (padrão DT-65).
6. **A4 / M4 / B1 / B2** — policy admin via `profiles.role`, arrumar `seed.sql`, escopar experimentos por `pmo_id`, bucket de áudios privado.

## 9. Vínculo com o rastreio existente

- Itens novos registrados como **DT-93 a DT-105** em `pmo-bot-go/docs/debitos_tecnicos.md` (fonte única de verdade para débitos do serviço).
- Method de verificação reproduzível: `grep "SECURITY DEFINER"`, `grep "CREATE POLICY"`, `grep "GRANT EXECUTE\|REVOKE"`, `grep "USING (true)"` em `supabase/migrations/`.