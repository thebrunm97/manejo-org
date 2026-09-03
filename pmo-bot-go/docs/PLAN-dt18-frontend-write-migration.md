# PLAN-dt18-frontend-write-migration

> **Status:** 🟡 **PLANEJADO, NÃO IMPLEMENTADO** — investigação completa em 2026-09-03,
> nenhuma linha de código ou migration criada ainda. **Achado principal: o épico DT-18
> já está ~85% resolvido** — o board descrevia um estado de agosto que não existe mais.
> O escopo real deste plano é bem menor do que a entrada original do DT-18 sugeria: 3
> caminhos de escrita quebrados, não 7 arquivos inteiros. · **Data:** 2026-09-03 ·
> **Rastreio:** DT-18 · **Componentes:** `pmo-frontend/src/components/PmoForm/Secao9.tsx`,
> `pmo-frontend/src/services/pmoService.ts`, `pmo-frontend/src/pages/PropertyProfilePage.tsx`,
> `supabase/migrations/`

## 🎯 Objetivo

Fechar os últimos 3 caminhos de escrita direta do `pmo-frontend` que sobreviveram ao
REVOKE de grants já aplicado em produção (`20260816030000_revoke_broad_grants.sql`,
reforçado por `20260819000000_hotfix_rollback_grants.sql`) — hoje eles falham
silenciosamente (retornam `{success:false, error}` sem lançar exceção, então o usuário
só percebe que "não salvou"). Trocar cada um por uma RPC `SECURITY DEFINER`, seguindo o
padrão já estabelecido em `create_canteiro`/`update_canteiro`/`delete_canteiro`
(DT-18, parte já aplicada em `20260818170000_create_misc_mutation_rpcs.sql`).

## 🛑 Problema

### O que o board dizia (desatualizado)

A entrada 🔴 do DT-18 cita 7 arquivos com escrita direta: `cadernoService.ts`,
`propriedadeService.ts`, `talhaoService.ts`, `pmoService.ts`, `TabelaDinamica.tsx`,
`VegetalImportDialog.tsx`, `Secao9.tsx`, e trata a migration de REVOKE como
`.sql.pending`, ainda não aplicada.

### O que é verdade hoje (confirmado ao vivo em produção + leitura do código atual)

- A migration de REVOKE **já está aplicada** (commitada sem o sufixo `.pending`, só o
  comentário de cabeçalho do arquivo ficou desatualizado). `anon`/`authenticated` têm
  hoje apenas `SELECT`/`REFERENCES`/`TRIGGER` nas tabelas do domínio de negócio — zero
  INSERT/UPDATE/DELETE, confirmado via grants ao vivo.
- Quatro migrations de 18/08 (`create_domain_mutation_rpcs`, `create_caderno_mutation_rpcs`,
  `create_pmo_mutation_rpcs`, `create_misc_mutation_rpcs`) já criaram o conjunto de RPCs
  `SECURITY DEFINER` que o DT-18 pedia, cobrindo `talhoes`, `caderno_campo`, `pmo_limpeza`,
  `pmos`, `pmo_manejo`/`pmo_propagacao`/`pmo_infraestrutura`/`pmo_maquinas` (via
  `upsert_pmo_relacoes`), `canteiros`, `analises_solo`, `demandas_coletivas`.
- **5 dos 7 arquivos citados já estão migrados ou nunca tiveram escrita direta**:
  `cadernoService.ts`, `propriedadeService.ts`, `talhaoService.ts` e `pmoService.ts` (nas
  rotas de PMO) já chamam RPC; `TabelaDinamica.tsx` e `VegetalImportDialog.tsx` são
  apresentacionais, nunca importaram `supabase` — a entrada do board sobre eles nunca
  refletiu a arquitetura real desses dois componentes.
- **Restam 3 caminhos de escrita direta reais, todos quebrados em produção agora**:

  1. **`Secao9.tsx`** (seção "Propagação Vegetal" do formulário PMO, roteada e ativa) —
     3 chamadas diretas em `pmo_propagacao`: `delete()` (linha 136), `update()` (linha
     165), `insert()` (linha 167). **Bug adicional, independente dos grants**: o payload
     do `insert` nunca define `pmo_id` — coluna `NOT NULL` sem default. Mesmo restaurando
     grants, esse insert quebraria por violação de constraint.
  2. **`pmoService.ts`** — 3 funções (`markSuggestionAsProcessed` linha 432,
     `logFeedback` linha 463, `saveRefinedSuggestion` linha 492) fazem `update()` direto
     em `logs_treinamento`. Não fazem parte do domínio original do DT-18 (a tabela nem é
     citada na entrada), mas é o mesmo padrão de risco e está quebrado agora.
  3. **`PropertyProfilePage.tsx`** (não citado na entrada original do DT-18) — `upsert()`
     direto em `limites_seguranca` (linha 166, aba "Segurança").

- **Fora de escopo deste plano, registrado à parte**: `GeneralLogTable.tsx` também tem um
  `update()` direto em `caderno_campo` (linha 214), mas o componente é código morto —
  confirmado que não é importado por nenhuma rota. `update_caderno_registro` já existe
  como RPC candidata pronta, então a correção (se o componente for reativado um dia) é
  trivial — não vale abrir uma fatia de trabalho para código inalcançável hoje.

- **Achado à parte, já resolvido**: durante esta investigação foi encontrado e corrigido
  o **DT-70** — um IDOR de leitura/escrita não relacionado à falta de RPC (era policy de
  RLS permissiva demais em 4 tabelas). Ver DT-70 em 🟢 Concluído. Não faz parte deste
  plano.

## 🧭 Decisão de arquitetura

**Seguir exatamente o padrão já em produção**, não inventar um novo: RPC
`SECURITY DEFINER`, checagem de posse via `WHERE ... = auth.uid()` (direto ou via join
até `pmos`/`propriedades`), payload genérico `jsonb` para updates parciais quando a
tabela já segue esse estilo (`update_canteiro(p_id, p_payload jsonb)`).

**`Secao9.tsx` — RPCs de item único, não `upsert_pmo_relacoes`.** A RPC genérica
`upsert_pmo_relacoes(p_table, p_payload)` já existente faz *delete+insert em lote da
seção inteira* (semântica "substituir tudo") — é o que `pmoService.savePmoSection` usa
para as demais seções do formulário. `Secao9.tsx` não segue esse modelo: adiciona/edita/
remove um item de propagação por vez, com salvamento imediato por ação (`confirmDel`,
`saveModal`). Forçar essa tela a acumular estado e salvar em lote seria uma reescrita de
UX maior do que o problema pede. Alternativa descartada: usar `upsert_pmo_relacoes`
mesmo assim, mandando a lista inteira a cada ação — funcionaria, mas reenviaria N-1 itens
inalterados a cada clique só para mudar 1, e joga fora a garantia transacional de
"errou 1 item, os outros continuam salvos" que RPCs por item dão de graça. Decisão:
3 RPCs novas, mesmo molde de `create_canteiro`/`update_canteiro`/`delete_canteiro`.

**`logs_treinamento` — uma RPC de update genérico, não três.** As 3 funções do
`pmoService.ts` fazem updates parciais na mesma tabela, cada uma tocando colunas
diferentes (`processado`; campos de feedback; campos de sugestão refinada). Em vez de 3
RPCs estreitas, uma `update_log_treinamento(p_id, p_payload jsonb)` que aceita um
subconjunto de colunas permitidas (mesmo estilo `update_canteiro`) cobre as 3 chamadas
com uma função só, e qualquer novo campo de log futuro não exige nova RPC.

**`limites_seguranca` — upsert único**, já que o frontend já trata isso como upsert
(`onConflict: 'propriedade_id,pmo_id'`) — replicar a mesma chave de conflito na RPC.

**Gateway Go (DT-59) — fora de escopo desta fatia, de propósito.** As RPCs novas do
DT-18 nascem chamadas via `supabase.rpc()` direto, como a maioria das RPCs já existentes
(só 10 das ~30 RPCs de mutação passam pelo gateway hoje). Adicionar ao gateway depois é
uma mudança de 2 linhas (nome na allowlist TS + na allowlist Go), sem tocar a RPC em si
— não há custo de fazer isso depois em vez de agora, e misturar as duas fatias de
trabalho só dificulta revisar cada uma.

## ⚙️ Mecanismo

### Migration nova: `supabase/migrations/<timestamp>_create_dt18_remaining_mutation_rpcs.sql`

```sql
-- pmo_propagacao: CRUD por item, mesmo molde de create_canteiro/update_canteiro/delete_canteiro
CREATE OR REPLACE FUNCTION create_propagacao_item(p_pmo_id bigint, p_payload jsonb)
RETURNS pmo_propagacao
SECURITY DEFINER
LANGUAGE plpgsql AS $$
DECLARE
  v_row pmo_propagacao;
BEGIN
  IF p_pmo_id NOT IN (SELECT id FROM pmos WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: PMO não pertence ao usuário.';
  END IF;

  INSERT INTO pmo_propagacao (pmo_id, tipo, especies, origem, quantidade, sistema_organico, data_compra, propriedade_id)
  VALUES (
    p_pmo_id,
    p_payload->>'tipo', p_payload->>'especies', p_payload->>'origem', p_payload->>'quantidade',
    (p_payload->>'sistema_organico')::boolean,
    (p_payload->>'data_compra')::date,
    (SELECT propriedade_id FROM pmos WHERE id = p_pmo_id)  -- derivado no servidor, não confiado do cliente
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION update_propagacao_item(p_id uuid, p_payload jsonb)
RETURNS void SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pmo_propagacao pp JOIN pmos ON pmos.id = pp.pmo_id
    WHERE pp.id = p_id AND pmos.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado ou item não encontrado.';
  END IF;

  UPDATE pmo_propagacao SET
    tipo = COALESCE(p_payload->>'tipo', tipo),
    especies = COALESCE(p_payload->>'especies', especies),
    origem = COALESCE(p_payload->>'origem', origem),
    quantidade = COALESCE(p_payload->>'quantidade', quantidade),
    sistema_organico = COALESCE((p_payload->>'sistema_organico')::boolean, sistema_organico),
    data_compra = COALESCE((p_payload->>'data_compra')::date, data_compra)
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION delete_propagacao_item(p_id uuid)
RETURNS void SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM pmo_propagacao pp
  USING pmos
  WHERE pp.id = p_id AND pmos.id = pp.pmo_id AND pmos.user_id = auth.uid();
  -- DELETE sem match não é erro (idempotente) -- mesmo estilo de delete_canteiro.
END;
$$;

-- logs_treinamento: update genérico por allowlist de colunas
CREATE OR REPLACE FUNCTION update_log_treinamento(p_id uuid, p_payload jsonb)
RETURNS void SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM logs_treinamento WHERE id = p_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado ou log não encontrado.';
  END IF;

  UPDATE logs_treinamento SET
    processado = COALESCE((p_payload->>'processado')::boolean, processado),
    validado = COALESCE((p_payload->>'validado')::boolean, validado),
    foi_editado = COALESCE((p_payload->>'foi_editado')::boolean, foi_editado),
    status_validacao = COALESCE(p_payload->>'status_validacao', status_validacao),
    json_corrigido = COALESCE(p_payload->'json_corrigido', json_corrigido),
    modelo_ia = COALESCE(p_payload->>'modelo_ia', modelo_ia)
  WHERE id = p_id;
END;
$$;

-- limites_seguranca: upsert por (propriedade_id, pmo_id)
CREATE OR REPLACE FUNCTION upsert_limites_seguranca(p_propriedade_id bigint, p_pmo_id bigint, p_payload jsonb)
RETURNS limites_seguranca SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_row limites_seguranca;
BEGIN
  IF p_propriedade_id NOT IN (SELECT id FROM propriedades WHERE user_id = auth.uid())
     OR p_pmo_id NOT IN (SELECT id FROM pmos WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  INSERT INTO limites_seguranca (propriedade_id, pmo_id, limite_transacao, limite_manejo)
  VALUES (p_propriedade_id, p_pmo_id, (p_payload->>'limite_transacao')::numeric, (p_payload->>'limite_manejo')::numeric)
  ON CONFLICT (propriedade_id, pmo_id) DO UPDATE SET
    limite_transacao = EXCLUDED.limite_transacao,
    limite_manejo = EXCLUDED.limite_manejo,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION create_propagacao_item, update_propagacao_item, delete_propagacao_item,
  update_log_treinamento, upsert_limites_seguranca TO authenticated;
```

*(SQL acima é o esqueleto para orientar a implementação — conferir nomes exatos de
coluna/tipo contra o schema vivo antes de aplicar; não copiar cegamente.)*

### Frontend

- `Secao9.tsx`: `confirmDel` → `supabase.rpc('delete_propagacao_item', { p_id })`;
  `saveModal` → `supabase.rpc('update_propagacao_item', ...)` quando `ei.id` existe,
  senão `supabase.rpc('create_propagacao_item', { p_pmo_id: pmoId, p_payload: rowTarget })`
  — isso também resolve o bug do `pmo_id` ausente, já que passa a ser parâmetro
  obrigatório da RPC em vez de campo esquecido no payload.
- `pmoService.ts`: as 3 funções trocam `supabase.from('logs_treinamento').update(...)`
  por `supabase.rpc('update_log_treinamento', { p_id: logId, p_payload: {...} })`.
- `PropertyProfilePage.tsx`: `handleSave` (aba segurança) troca o `upsert()` por
  `supabase.rpc('upsert_limites_seguranca', { p_propriedade_id, p_pmo_id, p_payload })`.

## 📋 Plano de implementação

**Fase 1 — Migration.** Escrever a migration com as 5 RPCs acima, revisando contra o
schema vivo (nomes de coluna, tipos). Testar em Postgres local: inserir/editar/remover
um item de propagação, um log de treinamento, e um registro de limites de segurança,
confirmando que a RPC recusa acesso de um usuário que não é dono (teste negativo) e
aceita do dono (teste positivo) — mesmo padrão de verificação usado no DT-46/DT-66.

**Fase 2 — Frontend.** Trocar as 3 chamadas de `Secao9.tsx`, as 3 de `pmoService.ts`, e
a de `PropertyProfilePage.tsx` pelas RPCs correspondentes. Rodar `npx tsc --noEmit` e
testar manualmente os 3 fluxos na UI (adicionar/editar/remover propagação; marcar
sugestão de treinamento como processada; salvar limites de segurança).

**Fase 3 — Aplicar em produção.** Só depois da Fase 2 validada localmente, e com
confirmação explícita antes de tocar o banco de produção (mesmo padrão desta sessão).

**Fase 4 — Fechar o board.** Reescrever a entrada do DT-18 refletindo o estado real
(a maior parte já estava feita antes desta sessão), registrar o que foi corrigido agora,
mover para 🟢 Concluído.

**Fora desta fatia, registrado para o futuro:**
- `GeneralLogTable.tsx` (código morto) — trivial de corrigir se o componente for
  reativado (`update_caderno_registro` já existe), não vale abrir trabalho agora.
- `upsert_pmo_relacoes` referencia `pmo_maquinas`/`pmo_infraestrutura`, tabelas que
  **não existem** no banco — código morto/aspiracional dentro da RPC. Uma chamada real
  com essas tabelas quebraria em runtime. Vale um item de limpeza próprio (achado, não
  corrigido aqui).
- Rotear as RPCs novas pelo gateway Go (DT-59) — decisão adiada de propósito, ver acima.

## ⚠️ Riscos e mitigações

- **Payload de `Secao9.tsx` hoje manda campos que a RPC pode não esperar** (ex.: campos
  de UI que não existem na tabela) — a RPC só lê chaves conhecidas do `jsonb`, ignora o
  resto silenciosamente. Verificar na Fase 2 se isso esconde algum campo que o usuário
  espera ver persistido.
- **`update_log_treinamento` genérico demais pode mascarar um bug futuro** — se uma 4ª
  função um dia precisar tocar uma coluna fora da allowlist, ela vai falhar em silêncio
  (a chave é ignorada, não dá erro). Preferível a criar uma 4ª RPC estreita, mas vale um
  comentário no código da RPC listando exatamente quais colunas são editáveis.
- **`limites_seguranca` tem duas FKs `NOT NULL`** (`propriedade_id` e `pmo_id`) — a RPC
  exige os dois parâmetros; confirmar que `PropertyProfilePage.tsx` sempre tem ambos os
  IDs disponíveis no momento do save (deveria, já que a página já opera no contexto de
  uma propriedade+PMO ativos).

## 🔗 Relacionados

- **DT-18** — item de rastreio deste plano.
- **DT-70** — achado e corrigido durante a investigação deste plano; IDOR de RLS,
  escopo de leitura, não de RPC ausente. Já fechado, não depende deste plano.
- **DT-59** — gateway Go; decisão de deixar as RPCs novas fora do gateway por agora,
  documentada acima.
- **DT-46** — mesmo padrão de `SECURITY DEFINER` com checagem de posse; usar como
  referência de estilo e de como esta sessão já testou acesso negado/permitido antes.
- **20260818170000_create_misc_mutation_rpcs.sql** — molde direto para as 3 RPCs de
  `pmo_propagacao` (mesmo formato de `create_canteiro`/`update_canteiro`/`delete_canteiro`).
