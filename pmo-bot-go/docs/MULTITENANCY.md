# 🏢 Arquitetura Multi-Tenancy — Manejo.org Bot

**Status:** Isolamento por tipo (`TenantCtx`, DT-67) em produção para 10+ PMOs, com teste de vazamento real entre tenants (DT-66)
**Última Auditoria:** 2026-09-01 (DT-66/DT-67)
**Idioma:** PT-BR

> **Nota (2026-08-24, atualizada em 2026-09-01):** este documento descreve isolamento **por PMO** (na prática, por produtor), garantido pelo tipo `TenantCtx` no código Go — o banco não tem RLS para o bot, que autentica com `service_role` (ver DT-65). Não confundir com o conceito de **organização como tenant** (cooperativa, certificadora, consultoria), decidido em [ADR-010](../../docs/architecture/adr/010-multitenancy-por-organizacao.md), que propõe isolamento reforçado por RLS e migração do bot para JWT por usuário. A alegação "validado" apoiava-se numa suíte que nunca lia/escrevia um dado real de um tenant para verificar se vazava para outro (DT-66) — corrigido: `TestFinanceiroBalanco_CrossTenantIsolation_RealPostgreSQL` (`internal/mcp/cross_tenancy_real_postgres_test.go`) registra uma despesa real sob uma propriedade e confirma, pelo handler de produção, que outra propriedade não a enxerga. Corrigido também: `ToolHandler` trocou `*supabase.Profile` por `TenantCtx` (DT-67), tornando estruturalmente impossível um handler ler um id de tenant de outro lugar que não seja a sessão validada — os exemplos de código abaixo foram atualizados para refletir isso.

---

## 1. Visão Geral

O bot suporta **N PMOs** (Produtores/Cooperativas) operando simultaneamente no **mesmo banco de dados PostgreSQL (Supabase)**, com **isolamento total** de dados entre elas.

Cada PMO é identificada por um `pmo_id` (BIGINT) que é **sempre extraído da sessão autenticada** do usuário, nunca dos argumentos enviados pelo LLM.

---

## 2. Fluxo de Isolamento

```
WhatsApp Usuário (PMO A)
        ↓
    Webhook recebe mensagem
        ↓
    LoadProfile(phone) → supabase.Profile{PmoAtivoID: A}
        ↓
    buildTenantCtx(profile) → bloqueia nil / PmoAtivoID=0, constrói TenantCtx
        ↓
    Handler recebe: ctx, args, tenant TenantCtx   ← nunca *Profile
        ↓
    pmoID := tenant.PmoID   ← NUNCA de args, e não há mais outro campo de onde ler
        ↓
    RPC("registrar_colheita", {pmo_id_arg: A, ...})
        ↓
    Supabase: INSERT ... WHERE pmo_id = A
        ↓
    Resultado filtrado apenas para PMO A ✅
```

**Invariante de segurança:** `pmo_id` nunca transita no payload do LLM. O LLM não conhece IDs sensíveis.

---

## 3. Camadas de Proteção

### Camada 1 — `buildTenantCtx()` (Go)

```go
func buildTenantCtx(profile *supabase.Profile) (TenantCtx, error) {
    if profile == nil {
        return TenantCtx{}, fmt.Errorf("unauthorized: sessão expirada ou inválida")
    }
    if profile.PmoAtivoID == 0 {
        return TenantCtx{}, fmt.Errorf("validation: usuário não tem PMO ativa selecionada")
    }
    return TenantCtx{
        PmoID:         profile.PmoAtivoID,
        UserID:        profile.ID,
        PropriedadeID: profile.PropriedadeAtivaID,
        Telefone:      profile.Telefone,
    }, nil
}
```

Chamada automaticamente em `CallTool`/`CallToolWithGuard` antes de qualquer execução de ferramenta — é o único lugar do pacote que ainda toca `*supabase.Profile` para fins de tenant.

### Camada 2 — Assinatura do handler (DT-67)

```go
func (s *Server) handleRegistrarColheita(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
    // ✅ tenant já chegou validado e resolvido — não há *Profile aqui para
    // checar nil, e não há como ler um id de tenant de outro lugar.
    pmoID := tenant.PmoID           // Do contexto de sessão
    userID := tenant.UserID         // Do contexto de sessão
    propID := tenant.PropriedadeID  // Do contexto de sessão

    // ❌ IMPOSSÍVEL: não existe args["pmo_id"] a ser lido — tenant.PmoID é o
    // único valor com esse nome no escopo do handler.
    ...
}
```

### Camada 3 — RPC SQL com isolamento

```sql
-- Supabase RPC (exemplo: registrar_operacao_campo_rpc)
CREATE OR REPLACE FUNCTION registrar_operacao_campo_rpc(
    pmo_id_arg BIGINT,
    user_id_arg TEXT,
    tipo_arg TEXT,
    payload_arg JSONB
) AS $$
BEGIN
    INSERT INTO public.operacoes_campo (pmo_id, user_id, tipo, ...)
    VALUES (pmo_id_arg, user_id_arg, tipo_arg, ...);
    -- WHERE pmo_id = pmo_id_arg → garante isolamento no BD
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Regras Obrigatórias para Novos Handlers

### ✅ Padrão Obrigatório

```go
func (s *Server) handleMeuHandler(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
    // REGRA 1: Extrair IDs do TenantCtx, NUNCA dos args — não há mais um
    // profile a validar aqui, buildTenantCtx já fez isso antes do handler
    // rodar (ver Camada 1).
    pmoID := tenant.PmoID         // ← sessão autenticada
    userID := tenant.UserID       // ← sessão autenticada
    propID := tenant.PropriedadeID // ← sessão autenticada

    // REGRA 2: Passar para RPC como argumentos nomeados
    result, err := s.supabase.MinhaRPC(ctx, map[string]interface{}{
        "pmo_id_arg":         pmoID,   // ← Do tenant, nunca de args
        "propriedade_id_arg": propID,
        "user_id_arg":        userID,
        "dados_arg":          args["dados"], // ← Dados do usuário são OK
    })
    
    return result, err
}
```

### ❌ Anti-Padrões Proibidos

```go
// ❌ LER pmo_id dos args (vulnerabilidade OWASP A01) — e hoje nem compila:
// não existe args["pmo_id"] retornando um id de tenant válido, só o que o
// LLM escreveu; TestNoHandlerReadsTenantIDsFromArgs (tenant_guard_test.go)
// varre estaticamente todo tools_*.go proibindo este padrão.
pmoID := args["pmo_id"].(int64)

// ❌ LER user_id dos args (vulnerabilidade OWASP A07)
userID := args["user_id"].(string)

// ❌ Aceitar *supabase.Profile na assinatura do handler — ToolHandler exige
// TenantCtx desde o DT-67, então isto nem compila mais.
func (s *Server) handler(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
    pmoID := profile.PmoAtivoID
}

// ❌ Passar pmo_id hardcoded
result, _ := s.supabase.RPC(ctx, "rpc", {"pmo_id_arg": 42})
```

---

## 5. Checklist de Code Review

Para **CADA novo handler**, o revisor deve verificar:

- [ ] Assinatura do handler recebe `tenant TenantCtx` (não `*supabase.Profile`)? Se receber `*supabase.Profile`, o código não compila — mas confirme que ninguém "resolveu" isso plugando um `TenantCtx{}` vazio ou fabricado.
- [ ] `pmoID := tenant.PmoID` (não `args["pmo_id"]`)?
- [ ] `userID := tenant.UserID` (não `args["user_id"]`)?
- [ ] RPC call passa `"pmo_id_arg": pmoID`?
- [ ] RPC SQL tem `WHERE pmo_id = pmo_id_arg` ou usa `pmo_id_arg` no INSERT?
- [ ] `go test ./internal/mcp/... -run TestNoHandlerReadsTenantIDsFromArgs` continua verde depois da mudança?
- [ ] Se o handler tem um par leitura/escrita novo (não só reaproveita uma tool existente), existe um teste real (`*_real_postgres_test.go`) que escreve como um tenant e confirma que outro não enxerga?

---

## 6. Testes de Validação

```bash
# Testes de isolamento Write (sem BD necessário)
go test ./internal/mcp -run "TestIsolation" -v

# Testes de segregação Read (sem BD necessário)
go test ./internal/mcp -run "TestRead" -v

# Guarda estática: nenhum handler pode ler id de tenant de args (DT-67)
go test ./internal/mcp -run "TestNoHandlerReadsTenantIDsFromArgs|TestAllRegisteredToolsAreWellFormed" -v

# Prova real de isolamento (DT-66) — requer `supabase start` local
# (127.0.0.1:54321) ou SUPABASE_TEST_URL/SUPABASE_TEST_SERVICE_KEY para
# staging; FALHA (não pula) sem um Postgres real disponível
go test ./internal/mcp -run "RealPostgreSQL" -v

# Todos os testes multi-tenancy
go test ./internal/mcp -run "TestIsolation|TestRead|RealPostgreSQL" -v
```

### Resultado Esperado

```
--- PASS: TestIsolation_NilProfileRejected
--- PASS: TestIsolation_ZeroPmoRejected
--- PASS: TestIsolation_ValidateProfile_NilReturnsUnauthorized
--- PASS: TestIsolation_ValidateProfile_ValidPasses
--- PASS: TestIsolation_CrossPMOWrite_ArgsInjectionIgnored
--- PASS: TestIsolation_TenPMOs_Concurrent
--- PASS: TestIsolation_PMOIDs_AreDistinct
--- PASS: TestRead_PMO_A_CannotSeePMO_B_Boundary
--- PASS: TestRead_ValidateProfile_BlocksAllReadBeforeDB
--- PASS: TestRead_FinancialBalance_RequiresProfile
--- PASS: TestNoHandlerReadsTenantIDsFromArgs
--- PASS: TestAllRegisteredToolsAreWellFormed
--- PASS: TestFinanceiroBalanco_CrossTenantIsolation_RealPostgreSQL   (requer Postgres real)
```

---

## 7. FAQ de Segurança

**P: Posso confiar que as 10+ PMOs nunca vão se misturar?**  
R: SIM, com uma prova real por trás desde 2026-09-01: `TestFinanceiroBalanco_CrossTenantIsolation_RealPostgreSQL` registra uma despesa de verdade sob uma propriedade e confirma, pelo handler de produção, que outra propriedade não a enxerga — antes do DT-66, a suíte só comparava dois IDs entre si, sem nunca ler/escrever um dado real. O isolamento em si é garantido em 3 camadas: Go handler (`TenantCtx`, tipo que torna impossível ler tenant de `args`) → RPC args → SQL WHERE.

**P: E se o LLM alucinar e passar `pmo_id` nos args?**  
R: O handler ignora completamente. Usa sempre `profile.PmoAtivoID`. Verificado nos testes `TestIsolation_CrossPMOWrite_ArgsInjectionIgnored`.

**P: Mas e se o atacante manipular o WhatsApp e enviar uma mensagem com `pmo_id=999`?**  
R: O `pmo_id` nos args é ignorado — é apenas um campo no JSON que o LLM poderia inferir. O sistema usa exclusivamente o profile carregado do banco via número de telefone autenticado.

**P: Quando um novo handler não segue as regras?**  
R: O `AUDIT-REPORT.md` documenta o processo. Code review obrigatório usando este checklist.

**P: Como adicionar uma nova PMO ao sistema?**  
R: Criar o registro no banco. O isolamento é automático via `pmo_id` — sem código adicional necessário.

---

## 8. Histórico de Auditoria

| Data | Evento | Resultado |
|------|--------|-----------|
| 2026-07-30 | Phase 4 — Multi-Tenancy Audit | ✅ 3 vulnerabilidades críticas corrigidas |
| 2026-07-30 | `handleRegistrarLote` — sem profile check | ✅ Corrigido |
| 2026-07-30 | `handleAdicionarInsumoPMO` — lendo pmo_id de args | ✅ Corrigido |
| 2026-07-30 | `handleSalvarMemoria` — lendo pmo_id de args | ✅ Corrigido |
| 2026-09-01 | DT-67 — `handleConsultarBalancoFinanceiro` lendo `propriedade_id` de `args`; `ToolHandler` trocou `*supabase.Profile` por `TenantCtx` em todos os handlers | ✅ Corrigido |
| 2026-09-01 | DT-66 — suíte de multitenancy nunca lia/escrevia dado real para provar isolamento; adicionado `TestFinanceiroBalanco_CrossTenantIsolation_RealPostgreSQL` | ✅ Corrigido |
| 2026-09-01 | DT-69 — achado ao escrever o teste do DT-66: `rpc_get_balanco_ia` comparava `tipo` em maiúsculo, mas a escrita normaliza para minúsculo desde 2026-08-16 — balanço financeiro retornava sempre zero em produção | ✅ Corrigido |
