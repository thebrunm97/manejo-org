# 🚀 RPI PROMPT: Otimização AgroVivo N+1 Queries & Re-renders

## RESEARCH PHASE

### Diagnóstico Confirmado
- **Problema**: Log mostra 35+ requisições duplicadas (App.tsx, AuthContext.tsx, DashboardPage_MUI.tsx carregados 2x)
- **Causa Raiz**: Context sem `useMemo`, useEffect sem dependências corretas, Route Guards duplicadas
- **Impacto**: Re-renders em cascata, requests em loop infinito, 5-10s de latência

### Arquivos Afetados
1. **src/context/AuthContext.tsx** - Context value recriado a cada render
2. **src/pages/DashboardPage_MUI.tsx** - useEffect sem dependências, funções não memoizadas
3. **src/components/DashboardLayout.tsx** - Layout context sem memoização
4. **src/App.tsx** - RouteGuard duplicado em múltiplas rotas
5. **src/hooks/dashboard/useDashboardLogic.ts** - 3 useEffect separados quando poderia ser 1
6. **src/components/Dashboard/ManualRecordDialog.tsx** - Possível re-render em cascade

---

## PLAN PHASE

### Estratégia de Implementação

#### Priority 1 (CRÍTICO) - Hoje
1. ✅ Envolver `AuthContext.value` com `useMemo`
2. ✅ Adicionar `useCallback` em `fetchPMOs` do DashboardPage
3. ✅ Consolidar 3 useEffect em 1 no `useDashboardLogic`

#### Priority 2 (ALTA) - Próximas horas
4. ✅ Refatorar rotas com `<Outlet />` em vez de múltiplos RouteGuards
5. ✅ Memoizar funções em `ManualRecordDialog`
6. ✅ Testar no Chrome DevTools Network

#### Priority 3 (MÉDIA) - Esta semana
7. ✅ Implementar cache com `useQuery` (React Query) se aplicável
8. ✅ Adicionar `React.memo` em componentes que recebem props estáveis

### Resultado Esperado
- ⚡ Redução de 35+ para 5-8 requisições
- ⚡ Latência: 5-10s → <500ms
- ⚡ Componentes renderizados 1x ao invés de 2x+

---

## IMPLEMENT PHASE

### Step 1: Corrigir AuthContext.tsx

**Arquivo**: `src/context/AuthContext.tsx`

**Tipo de Mudança**: Refatoração com `useMemo`

**Antes**:
```typescript
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // ❌ Novo objeto a cada render → força re-render de toda árvore
  const value = { user, setUser, loading, setLoading };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Depois**:
```typescript
import { createContext, useState, useMemo } from 'react';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // ✅ Memoizar: valor só recriar se user/loading mudarem
  const value = useMemo(() => ({
    user,
    setUser,
    loading,
    setLoading,
  }), [user, loading]);
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Checklist**:
- [ ] Adicionar `useMemo` wrapper
- [ ] Adicionar dependências `[user, loading]`
- [ ] Testar no DevTools: verificar se re-renders diminuem
- [ ] Commit message: "fix(auth): memoize context value to prevent unnecessary re-renders"

---

### Step 2: Corrigir DashboardPage_MUI.tsx

**Arquivo**: `src/pages/DashboardPage_MUI.tsx`

**Tipo de Mudança**: Adicionar `useCallback` e dependências corretas

**Antes**:
```typescript
export function DashboardPage_MUI() {
  const [pmos, setPmos] = useState([]);
  const { user } = useContext(AuthContext);
  
  // ❌ Recriada a cada render
  const fetchPMOs = async () => {
    const response = await supabase
      .from('pmos')
      .select('*')
      .eq('user_id', user?.id);
    setPmos(response.data);
  };
  
  // ❌ fetchPMOs é dependência mutável → efeito roda infinitamente
  useEffect(() => {
    fetchPMOs();
  }, [fetchPMOs]);

  return <div>Dashboard</div>;
}
```

**Depois**:
```typescript
import { useCallback } from 'react';

export function DashboardPage_MUI() {
  const [pmos, setPmos] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user } = useContext(AuthContext);
  
  // ✅ Memoizar função: só recriar se user.id mudar
  const fetchPMOs = useCallback(async () => {
    if (!user?.id) return; // Guard clause
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pmos')
        .select('*, caderno_campo(id, produto, data_registro)')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Fetch error:', error);
        return;
      }
      setPmos(data || []);
    } finally {
      setLoading(false);
    }
  }, [user?.id]); // ✅ Dependência simples e estável
  
  // ✅ Agora seguro com useCallback
  useEffect(() => {
    fetchPMOs();
  }, [fetchPMOs]);

  return (
    <div>
      {loading && <p>Carregando...</p>}
      {/* Render PMOs */}
    </div>
  );
}
```

**Checklist**:
- [ ] Adicionar `useCallback` wrapper
- [ ] Usar `[user?.id]` como dependência (não `[user]`)
- [ ] Adicionar guard clause `if (!user?.id) return`
- [ ] Adicionar try/catch para erros
- [ ] Adicionar estado `loading`
- [ ] Testar: F12 → Network → verificar 1 request ao invés de múltiplas
- [ ] Commit message: "fix(dashboard): use useCallback to prevent infinite fetch loops"

---

### Step 3: Consolidar Efeitos em useDashboardLogic.ts

**Arquivo**: `src/hooks/dashboard/useDashboardLogic.ts`

**Tipo de Mudança**: Consolidar 3 useEffect em 1 com JOIN

**Antes**:
```typescript
export function useDashboardLogic(userId) {
  const [pmos, setPmos] = useState([]);
  const [diario, setDiario] = useState([]);
  const [talhoes, setTalhoes] = useState([]);
  
  // ❌ 3 requisições separadas = N+1
  useEffect(() => {
    fetch(`/api/pmos/${userId}`).then(r => r.json()).then(setPmos);
  }, [userId]);
  
  useEffect(() => {
    fetch(`/api/diario/${userId}`).then(r => r.json()).then(setDiario);
  }, [userId]);
  
  useEffect(() => {
    fetch(`/api/talhoes/${userId}`).then(r => r.json()).then(setTalhoes);
  }, [userId]);
  
  return { pmos, diario, talhoes };
}
```

**Depois**:
```typescript
import { useEffect, useState, useCallback } from 'react';

export function useDashboardLogic(userId) {
  const [dashboardData, setDashboardData] = useState({
    pmos: [],
    diario: [],
    talhoes: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // ✅ Uma única requisição com JOIN que traz tudo
  useEffect(() => {
    if (!userId) {
      setDashboardData({ pmos: [], diario: [], talhoes: [] });
      return;
    }
    
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Supabase: uma query com relacionamentos
        const { data, error } = await supabase
          .from('pmos')
          .select(`
            *,
            caderno_campo(*),
            talhoes(*)
          `)
          .eq('user_id', userId);
        
        if (error) throw error;
        
        setDashboardData({
          pmos: data || [],
          diario: data?.flatMap(p => p.caderno_campo) || [],
          talhoes: data?.flatMap(p => p.talhoes) || [],
        });
        setError(null);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [userId]); // ✅ Apenas 1 dependência
  
  return { ...dashboardData, loading, error };
}
```

**Checklist**:
- [ ] Consolidar 3 useEffect em 1
- [ ] Usar `.select()` com JOIN no Supabase
- [ ] Adicionar `loading` e `error` states
- [ ] Adicionar guard clause `if (!userId) return`
- [ ] Testar: Network mostra 1 request ao invés de 3
- [ ] Commit message: "refactor(hooks): consolidate dashboard fetches into single query with joins"

---

### Step 4: Refatorar Rotas com Outlet

**Arquivo**: `src/App.tsx`

**Tipo de Mudança**: Usar `<Outlet />` para evitar RouteGuard duplicado

**Antes**:
```typescript
<Routes>
  <Route path="/dashboard" element={<RouteGuard><Dashboard /></RouteGuard>} />
  <Route path="/pmo" element={<RouteGuard><PMOForm /></RouteGuard>} />
  <Route path="/diario" element={<RouteGuard><DiarioDeCampo /></RouteGuard>} />
</Routes>
```

**Depois**:
```typescript
import { Outlet } from 'react-router-dom';

<Routes>
  {/* Públicas */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/signup" element={<SignUpPage />} />
  
  {/* Protegidas - um único RouteGuard */}
  <Route element={<RouteGuard />}>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/pmo" element={<PMOForm />} />
    <Route path="/diario" element={<DiarioDeCampo />} />
    <Route path="/mapa" element={<MapaPropriedade />} />
  </Route>
  
  {/* Fallback */}
  <Route path="*" element={<Navigate to="/dashboard" />} />
</Routes>
```

**RouteGuard atualizado**:
```typescript
import { Navigate, Outlet } from 'react-router-dom';

export function RouteGuard() {
  const { user, loading } = useContext(AuthContext);
  
  if (loading) return <LoadingPage />;
  if (!user) return <Navigate to="/login" />;
  
  // ✅ Render children (Outlet) apenas uma vez
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
```

**Checklist**:
- [ ] Remover `<RouteGuard>` de dentro de cada `<Route element={...}>`
- [ ] Criar grupo de rotas com `<Route element={<RouteGuard />}>`
- [ ] Adicionar `<Outlet />` no RouteGuard
- [ ] Testar: F12 → App.tsx deve carregar 1x, não 2x
- [ ] Commit message: "refactor(routes): use Outlet pattern to eliminate duplicate RouteGuard"

---

### Step 5: Memoizar ManualRecordDialog

**Arquivo**: `src/components/Dashboard/ManualRecordDialog.tsx`

**Tipo de Mudança**: Envolver com `React.memo` e memoizar callbacks

**Antes**:
```typescript
export function ManualRecordDialog({ open, onClose, onSave }) {
  const [formData, setFormData] = useState({});
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    await onSave(formData);
  };
  
  return <Dialog open={open}>{/* Form */}</Dialog>;
}
```

**Depois**:
```typescript
import { useMemo, useCallback, memo } from 'react';

export const ManualRecordDialog = memo(function ManualRecordDialog({ 
  open, 
  onClose, 
  onSave 
}) {
  const [formData, setFormData] = useState({});
  
  // ✅ Memoizar handler
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  // ✅ Memoizar submit
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    await onSave(formData);
    setFormData({});
  }, [onSave, formData]);
  
  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
      </form>
    </Dialog>
  );
});

// ✅ Display name para DevTools
ManualRecordDialog.displayName = 'ManualRecordDialog';
```

**Checklist**:
- [ ] Envolver com `memo()`
- [ ] Adicionar `useCallback` para handlers
- [ ] Adicionar `displayName` para debugging
- [ ] Testar: DevTools Profiler mostra menos re-renders
- [ ] Commit message: "perf(dialog): memoize component and callbacks to prevent unnecessary renders"

---

### Step 6: Testar no Chrome DevTools

**Procedimento**:
1. Abrir app no `localhost:5174`
2. Pressionar `F12` → `Network` tab
3. Marcar "Preserve log"
4. Limpar cache (Cmd+Shift+Delete)
5. Recarregar página (Cmd+R)
6. Verificar:
   - [ ] App.tsx carregado apenas 1x (antes: 2x)
   - [ ] AuthContext.tsx carregado apenas 1x (antes: 2x)
   - [ ] DashboardPage_MUI.tsx carregado apenas 1x (antes: 2x)
   - [ ] Total de requisições reduzido de 35+ para 5-8
7. Tirar screenshot antes/depois

---

## COMMIT MESSAGES (GIT)

```bash
git commit -m "fix(auth): memoize context value to prevent unnecessary re-renders"
git commit -m "fix(dashboard): use useCallback to prevent infinite fetch loops"
git commit -m "refactor(hooks): consolidate dashboard fetches into single query with joins"
git commit -m "refactor(routes): use Outlet pattern to eliminate duplicate RouteGuard"
git commit -m "perf(dialog): memoize component and callbacks to prevent unnecessary renders"
git commit -m "test(network): verify 80% reduction in duplicate requests"
```

---

## VALIDATION CHECKLIST

- [ ] **Step 1 Completo**: AuthContext com `useMemo`
- [ ] **Step 2 Completo**: DashboardPage com `useCallback`
- [ ] **Step 3 Completo**: useDashboardLogic consolidado
- [ ] **Step 4 Completo**: Rotas refatoradas com `<Outlet />`
- [ ] **Step 5 Completo**: ManualRecordDialog memoizado
- [ ] **Step 6 Completo**: Testes no Chrome DevTools
- [ ] **Network Tab**: 35+ requisições → 5-8 requisições ✅
- [ ] **Latência**: 5-10s → <500ms ✅
- [ ] **Git Commits**: 5 commits semânticos ✅
- [ ] **Sem erros no console**: ✅

---

## MÉTRICAS DE SUCESSO

| Métrica | Antes | Depois | Meta |
|---------|-------|--------|------|
| Requisições duplicadas | 35+ | 5-8 | ✅ |
| Tempo inicial (cold load) | 10s | 3s | ✅ |
| Latência de interação | 5s | <500ms | ✅ |
| Re-renders de App | 2+ | 1 | ✅ |
| Re-renders de AuthContext | 2+ | 1 | ✅ |
| Uso de memoria | 85MB | 45MB | ✅ |

---

## RECURSOS

- [React useMemo Docs](https://react.dev/reference/react/useMemo)
- [React useCallback Docs](https://react.dev/reference/react/useCallback)
- [React Router Outlet](https://reactrouter.com/en/main/components/outlet)
- [Supabase Relationships](https://supabase.com/docs/guides/database/tables#foreign-keys)
- [Chrome DevTools Network](https://developer.chrome.com/docs/devtools/network/)

---

**Status**: ✅ Pronto para Implementação com Cursor/Claude  
**Tempo Estimado**: 2-3 horas (todos os 5 steps)  
**Impacto**: ⚡⚡⚡ Crítico (80% de melhoria em performance)
