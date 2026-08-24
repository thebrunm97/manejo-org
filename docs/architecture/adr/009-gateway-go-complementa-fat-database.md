# ADR-009: Gateway REST no Go — complementa o ADR-002, não o substitui

## Status: Aceito

## Contexto
O DT-59 nasceu como "Centralização do Backend em Go (Evitar Vendor Lock-in)": o frontend acessa o banco direto via SDK do Supabase (PostgREST + RLS), o que descentraliza a autorização e deixa a validação de identidade fora do controle do backend Go. A formulação original do débito técnico propunha "cancelar a dependência do PostgREST" e mover as transações de banco para o Go.

Essa formulação literal contradiz o **ADR-002 (Fat Database)**, que decide o oposto — lógica de negócio transacional em RPCs PL/pgSQL, com o Go como camada fina de orquestração — e que já avaliou e aceitou o lock-in parcial com o Postgres, com mitigação documentada (funções em SQL padrão, migráveis para outro provedor Postgres).

Ao dimensionar o trabalho (2026-08-24), dois fatos mudaram o desenho:

1. **As RPCs de escrita do produtor já são `SECURITY DEFINER` e derivam o dono do registro de `auth.uid()`** — a claim `sub` do JWT que o PostgREST recebe (confirmado lendo `create_talhao`, `update_talhao`, `delete_talhao` em `supabase/migrations/20260818140000_create_domain_mutation_rpcs.sql`). Ou seja, a autorização por usuário **já é garantida pelo banco**, não pelo frontend nem por RLS de tabela.
2. **O problema real não era "o Postgres decide demais"**, e sim que nenhuma dessas escritas deixava rastro fora do próprio banco, e que não havia ponto único para aplicar, no futuro, as mesmas guardrails que o bot do WhatsApp já aplica (blacklist de insumos químicos, HITL) também ao caminho web — hoje elas só existem do lado do bot.

## Decisão
O Go passa a ser um **gateway REST com allowlist**, não um substituto das RPCs. Para um conjunto fechado de RPCs de escrita do produtor (`create_talhao`, `update_talhao`, `delete_talhao`, `create_caderno_registro`, `update_caderno_registro`, `delete_caderno_registro`, `rpc_update_propriedade`, `create_pmo`, `update_pmo`, `delete_pmo`), o frontend chama `POST /api/v1/rpc/:name` no Go em vez de `supabase.rpc(nome)` direto no PostgREST.

O Go:
- Valida o JWT do produtor (`internal/middleware`, ADR-anterior desta mesma frente).
- Recusa qualquer nome de RPC fora do allowlist com 404, antes de qualquer chamada ao banco.
- Reencaminha a chamada ao PostgREST com o **mesmo token do produtor**, nunca a chave de serviço — `auth.uid()` dentro da RPC resolve exatamente como resolve hoje quando o frontend chama direto.
- Registra um log estruturado central da chamada (`event=gateway_rpc_call`).

Implementação: `internal/gateway/rpc_proxy.go`.

## Por que não a leitura literal do DT-59
Reescrever as RPCs para receber um `user_id` explícito do Go, em vez de derivá-lo de `auth.uid()`, trocaria autorização garantida pelo banco por autorização confiada ao chamador — e faria exatamente o que o ADR-002 decidiu evitar: mover regra de negócio (inclusive a de "de quem é este registro") para fora do Postgres. O ganho declarado do DT-59 (auditoria central, ponto único de controle) não depende disso — o proxy entrega os dois sem tocar em onde a autorização vive.

## Justificativa
- **Preserva a atomicidade do ADR-002**: nenhuma RPC foi reescrita; a transação continua inteira dentro do Postgres.
- **Preserva a autorização por linha que já existia**: `auth.uid()` continua sendo a fonte de verdade de quem pode escrever o quê — o Go não introduz uma segunda lógica de autorização para divergir da primeira.
- **Resolve o problema real**: toda escrita de produtor passa a ter log central (`event=gateway_rpc_call`), algo que não existia quando o frontend ia direto ao PostgREST.
- **Abre o caminho para paridade de guardrails**: o ponto de entrada único é onde, no futuro, as mesmas checagens que o bot do WhatsApp aplica (blacklist de insumos, HITL) podem passar a valer também para o caminho web, sem duplicar a lógica em dois lugares.
- **Allowlist, não proxy aberto**: um nome de RPC fora da lista fechada nunca chega ao PostgREST — o gateway não vira uma porta genérica para qualquer função do banco.

## Exemplos
- `POST /api/v1/rpc/create_talhao` → `internal/gateway/rpc_proxy.go` → `POST {SUPABASE_URL}/rest/v1/rpc/create_talhao` com `Authorization: Bearer <jwt do produtor>`.

## Consequências
- (+) Nenhuma RPC foi tocada; zero risco de regressão na lógica transacional existente.
- (+) Log de auditoria central para escritas que antes não deixavam rastro fora do Postgres.
- (+) O allowlist é a única superfície nova de decisão de segurança, pequena e explícita, em vez de 37 RPCs livres.
- (-) Um salto de rede a mais (frontend → Go → PostgREST) em vez de frontend → PostgREST direto, para as 10 RPCs migradas.
- (-) O allowlist em `internal/gateway/rpc_proxy.go` precisa ser atualizado manualmente a cada nova RPC de escrita que o frontend passe a usar via gateway — não é automático.
- **Escopo desta fatia**: só as 10 RPCs de escrita listadas foram migradas (e, no frontend, só `talhaoService.ts` foi trocado como referência). Leitura pura (dashboards, `get_dre_mensal`, rastreabilidade pública) e as demais RPCs de escrita continuam indo direto ao PostgREST — não é onde estava o risco, e migrar as 35 tabelas/37 RPCs de uma vez, sem teste ao vivo de cada tela, seria maior risco do que o problema que o DT-59 resolve.
