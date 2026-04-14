# Especificação Técnica: Refatoração do HarvestDashboard

---
**Status:** ✅ Implementado  
**Data de Conclusão:** Janeiro 2026  
**Componentes Afetados:** `HarvestDashboard.tsx`, `HarvestTypes.ts`, `MetricCard.tsx`  
**Análise de Implementação:** Validação realizada em 16/01/2026

---

## 1. Definição de Tipos (TypeScript)

Para garantir a tipagem estrita e aproveitar a geração de tipos do Supabase, utilizaremos as seguintes definições.

### Interfaces

```typescript
import { Database } from '../../types/supabase';

// Tipo base da tabela caderno_campo
type CadernoCampoRow = Database['public']['Tables']['caderno_campo']['Row'];

/**
 * Interface para as propriedades do componente HarvestDashboard.
 */
export interface HarvestDashboardProps {
  pmoId: string;
}

/**
 * Interface estendida para os registros de colheita.
 * Garante que os campos críticos para o dashboard estejam tipados.
 */
export interface HarvestRecord extends CadernoCampoRow {
  id: string;
  pmo_id: string; // Foreign Key UUID
  data_registro: string; // ISO String
  
  // Dados Quantitativos
  quantidade_valor: number | null;
  quantidade_unidade: string | null; // ex: 'kg', 'ton', 'cx'
  
  // Metadados
  tipo_atividade: string | null; // Deve ser 'Colheita'
  produto: string | null;
  talhao_canteiro: string | null; // Localização legada ou formatada
  
  // JSONB Flexível
  detalhes_tecnicos: {
    [key: string]: any;
    observacoes?: string;
  } | null;
}

/**
 * Estrutura de dados para o card de Resumo (Carrossel).
 * Agrupa totais por produto.
 */
export interface SummaryData {
  [produto: string]: {
    total: number;
    unidade: string;
  };
}
```

## 2. Estratégia Realtime (Live Update)

A atualização em tempo real é crítica para evitar dados obsoletos (_stale data_) quando colheitas são registradas simultaneamente em outros dispositivos.

### Implementação do Hook `useEffect`

O componente deve subscrever às mudanças no banco de dados assim que montado ou quando o `pmoId` mudar.

**Lógica de Subscrição:**
1.  **Evento:** Escutar `postgres_changes` com `event: '*'`. Isso captura `INSERT`, `UPDATE` e `DELETE`.
2.  **Tabela:** `caderno_campo`.
3.  **Filtro:** `pmo_id=eq.{pmoId}`. Isso garante que o cliente só receba eventos do plano de manejo atual, economizando banda.
4.  **Callback:** Ao receber qualquer evento, invocar `fetchColheitas()`. Adotaremos a estratégia de _invalidate and refetch_ para garantir que o cálculo do resumo (soma total) esteja sempre 100% correto com o estado do servidor.

**Exemplo de Implementação (Pseudocódigo):**

```typescript
useEffect(() => {
  if (!pmoId) return;

  // 1. Busca inicial dos dados
  fetchColheitas();

  // 2. Configuração do canal Realtime
  const channel = supabase
    .channel(`harvest_dashboard_live_${pmoId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'caderno_campo',
        filter: `pmo_id=eq.${pmoId}`
      },
      (payload) => {
        // Log opcional para debug
        console.log('Realtime update detected:', payload);
        
        // Atualiza a lista completa para garantir consistência dos totais
        fetchColheitas();
      }
    )
    .subscribe();

  // 3. Cleanup: Remove o canal ao desmontar
  return () => {
    supabase.removeChannel(channel);
  };
}, [pmoId]);
```

## 3. Migração & Refatoração

Passo a passo para converter e refatorar o componente existente.

1.  **Renomeação:**
    *   Renomear o arquivo `src/components/Dashboard/HarvestDashboard.jsx` para `HarvestDashboard.tsx`.

2.  **Ajuste de Imports:**
    *   Manter `React` e hooks (`useEffect`, `useState`).
    *   Importar tipos definidos acima (ou diretamente de `supabase.ts`).
    *   Se `supabaseClient.js` não tiver tipos, considerar fazer _type casting_ ou migrar o client (fora do escopo imediato, mas `as any` ou tipagem manual do client pode ser necessária temporariamente).

3.  **Refatoração do Estado e Fetch:**
    *   Tipar o estado `colheitas`: `const [colheitas, setColheitas] = useState<HarvestRecord[]>([]);`.
    *   Tipar o estado `resumo`: `const [resumo, setResumo] = useState<SummaryData>({});`.
    *   Adicionar tratamento de erro ao hook `fetchColheitas`.

4.  **Tratamento de Nulos (Null Safety):**
    *   Durante o cálculo do resumo (`calcularResumo`):
        *   Usar *Nullish Coalescing* para valores numéricos: `const qtd = Number(item.quantidade_valor) || 0;`.
        *   Garantir fallback para produto: `const prod = item.produto?.toUpperCase() || 'NÃO IDENTIFICADO';`.

5.  **Interface de Usuário (JSX -> TSX):**
    *   Tipar corretamente callbacks de eventos (ex: `onClick={() => navigate(...)}`).
    *   Manter a lógica visual dos Cards e Chips.
    *   Resolver qualquer erro de tipo do Material UI (geralmente relacionados a props de estilo ou variantes).

6.  **Verificação Final:**
    *   Garantir que não existam erros de compilação TS.
    *   Verificar se o TypeScript reconhece corretamente os campos do objeto `row` no `.map()`.
