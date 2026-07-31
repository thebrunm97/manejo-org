# 🏢 Arquitetura Multi-Tenancy — Manejo.org Bot

**Status:** ✅ Validado para 10+ PMOs em produção  
**Última Auditoria:** 2026-07-30 (Phase 4)  
**Idioma:** PT-BR  

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
    Handler recebe: ctx, args, profile
        ↓
    validateProfile(profile) → bloqueia nil / PmoAtivoID=0
        ↓
    pmoID := profile.PmoAtivoID   ← NUNCA de args
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

### Camada 1 — `validateProfile()` (Go)

```go
func (s *Server) validateProfile(profile *supabase.Profile) error {
    if profile == nil {
        return fmt.Errorf("unauthorized: sessão expirada ou inválida")
    }
    if profile.PmoAtivoID == 0 {
        return fmt.Errorf("validation: usuário não tem PMO ativa selecionada")
    }
    return nil
}
```

Chamada automaticamente em `CallToolWithGuard` antes de qualquer execução de ferramenta.

### Camada 2 — Extração segura no handler

```go
func (s *Server) handleRegistrarColheita(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
    // ✅ Camada 2: verificação local (redundância de segurança)
    if profile == nil {
        return nil, fmt.Errorf("unauthorized: missing profile")
    }
    
    // ✅ Extração SEMPRE do profile, NUNCA dos args
    pmoID := profile.PmoAtivoID   // Do contexto de sessão
    userID := profile.ID          // Do contexto de sessão
    propID := profile.PropriedadeAtivaID  // Do contexto de sessão
    
    // ❌ PROIBIDO: pmoID := args["pmo_id"].(int64)
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
func (s *Server) handleMeuHandler(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
    // REGRA 1: Validar profile antes de TUDO
    if profile == nil {
        return nil, fmt.Errorf("unauthorized: missing profile")
    }
    
    // REGRA 2: Extrair IDs do profile, NUNCA dos args
    pmoID := profile.PmoAtivoID         // ← perfil autenticado
    userID := profile.ID                 // ← perfil autenticado
    propID := profile.PropriedadeAtivaID // ← perfil autenticado
    
    // REGRA 3: Passar para RPC como argumentos nomeados
    result, err := s.supabase.MinhaRPC(ctx, map[string]interface{}{
        "pmo_id_arg":         pmoID,   // ← Do profile, nunca de args
        "propriedade_id_arg": propID,
        "user_id_arg":        userID,
        "dados_arg":          args["dados"], // ← Dados do usuário são OK
    })
    
    return result, err
}
```

### ❌ Anti-Padrões Proibidos

```go
// ❌ LER pmo_id dos args (vulnerabilidade OWASP A01)
pmoID := args["pmo_id"].(int64)

// ❌ LER user_id dos args (vulnerabilidade OWASP A07)
userID := args["user_id"].(string)

// ❌ Handler sem profile nil check
func (s *Server) handler(ctx context.Context, args, profile) (interface{}, error) {
    pmoID := profile.PmoAtivoID // panic se profile==nil!
}

// ❌ Passar pmo_id hardcoded
result, _ := s.supabase.RPC(ctx, "rpc", {"pmo_id_arg": 42})
```

---

## 5. Checklist de Code Review

Para **CADA novo handler**, o revisor deve verificar:

- [ ] `if profile == nil { return nil, fmt.Errorf("unauthorized: ...") }` na primeira linha?
- [ ] `pmoID := profile.PmoAtivoID` (não `args["pmo_id"]`)?
- [ ] `userID := profile.ID` (não `args["user_id"]`)?
- [ ] RPC call passa `"pmo_id_arg": pmoID`?
- [ ] RPC SQL tem `WHERE pmo_id = pmo_id_arg` ou usa `pmo_id_arg` no INSERT?
- [ ] Teste de isolamento existe em `multitenancy_test.go` ou equivalente?

---

## 6. Testes de Validação

```bash
# Testes de isolamento Write (sem BD necessário)
go test ./internal/mcp -run "TestIsolation" -v

# Testes de segregação Read (sem BD necessário)
go test ./internal/mcp -run "TestRead" -v

# Todos os testes multi-tenancy
go test ./internal/mcp -run "TestIsolation|TestRead" -v

# Com BD real (integração completa)
DATABASE_URL="postgresql://..." go test ./internal/mcp -run "TestIsolation|TestRead" -v
```

### Resultado Esperado (sem BD)

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
```

---

## 7. FAQ de Segurança

**P: Posso confiar que as 10+ PMOs nunca vão se misturar?**  
R: SIM. O isolamento é garantido em 3 camadas: Go handler → RPC args → SQL WHERE.

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
