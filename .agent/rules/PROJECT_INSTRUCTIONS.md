# 🌿 ManejoORG — Manifesto de Guardrails (AntiGravity)

Este ficheiro define as regras **always-on** para toda a IA que trabalhe neste repositório.
Leia e siga rigorosamente. Estas regras têm precedência sobre qualquer instrução genérica da ferramenta.

---

## 📦 Stack Canónica

### Frontend (`pmo-frontend/`)
| Camada | Tecnologia |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 6 |
| Estilo | **Tailwind CSS v4** (via `@tailwindcss/vite`) |
| Ícones | `lucide-react` (primário) |
| Validação | `zod` + hooks customizados |
| HTTP | `axios` via `services/` |
| Roteamento | `react-router-dom` v7 |
| DB Client | `@supabase/supabase-js` v2 |
| Notificações | `react-toastify` |

### Backend (`pmo_bot/`)
| Camada | Tecnologia |
|---|---|
| Framework | **FastAPI** |
| Scheduler | APScheduler |
| Task Queue | arq + Redis |
| DB | Supabase (client Python global — nunca criar conexões avulsas) |
| Config | Variáveis de ambiente via `os.getenv()` |

---

## 🚫 PROIBIÇÕES ABSOLUTAS (Hard Prohibitions)

### Frontend
```
❌ Importar de @mui/material para criar componentes NOVOS
❌ Usar a prop `sx` do MUI em código novo ou refatorado
❌ Usar <Button>, <IconButton>, <Dialog> do MUI em código novo
❌ Usar w-screen ou 100vw em qualquer elemento de layout
❌ Usar margens negativas (-mx-, -ml-, -mr-) sem compensação explícita
❌ Chamar Supabase diretamente num componente React (vai para services/)
❌ Usar `any` TypeScript em código novo (usar `unknown` + type guard)
❌ Usar alert() nativo em código novo (usar react-toastify)
❌ Adicionar dependencies sem aprovação explícita do Tech Lead
```

> **Nota sobre MUI:** `@mui/material` existe no `package.json` como dependência legada durante migração. Isso **não é autorização** para usá-la em código novo.

### Backend (Python)
```
❌ Usar Flask ou Gunicorn (stack migrada para FastAPI)
❌ Hardcodar chaves de API, tokens ou secrets no código
❌ Salvar textos com tags técnicas na BD (ex: "[ALERTA COMPLIANCE]\n", "[SISTEMA]")
❌ Usar asyncio.run() em contexto de worker APScheduler/arq
❌ Criar registros em caderno_campo sem pmo_id (dados órfãos)
```

---

## 🎨 Design System — SaaS Moderno ("Agro Tech Flat")

### Paleta de Cores
| Token | Tailwind | Hex | Uso |
|---|---|---|---|
| Primary | `green-700` | `#15803d` | Botão de ação principal |
| Primary Hover | `green-600` | `#16a34a` | Hover do primário |
| Page BG | `slate-100` | `#f1f5f9` | Fundo de página |
| Surface | `white` | `#ffffff` | Cards, modais |
| Border | `slate-200` | `#e2e8f0` | Separadores, bordas |
| Sidebar | `slate-800` | `#1e293b` | Navegação lateral |
| Text Primary | `slate-700` | `#334155` | Texto principal |
| Text Muted | `slate-500` | `#64748b` | Labels, secundário |

### Geometria & Elevação
- Buttons / Inputs: `rounded-md`
- Cards / Modais: `rounded-lg`
- **Sem sombras difusas** — usar `border border-slate-200` para delimitar espaços
- Sombra máxima permitida em elementos flutuantes (dropdowns, tooltips): `shadow-xl`
- Filosofia: Flat Design. Dados > Decoração. Alta densidade de informação.

---

## 🧩 Padrões de Componentes

### Botão Primário
```tsx
<button
  type="button"
  className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
>
  Ação Principal
</button>
```

### Botão Secundário / Ghost
```tsx
<button
  type="button"
  className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
>
  Cancelar
</button>
```

### Botão Icon (ação em tabela)
```tsx
// Editar
<button type="button" className="inline-flex items-center justify-center p-1.5 text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed">
  <PencilIcon size={16} />
</button>
// Excluir
<button type="button" className="inline-flex items-center justify-center p-1.5 text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed">
  <TrashIcon size={16} />
</button>
```

### Modal (estrutura obrigatória)
```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
  <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl flex flex-col max-h-full">
    {/* Header com border-b */}
    <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100">...</div>
    {/* Corpo scrollável */}
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">...</div>
    {/* Footer com border-t */}
    <div className="flex justify-end gap-3 p-4 border-t border-gray-100">...</div>
  </div>
</div>
```

### Tooltip CSS-only (sem biblioteca)
```tsx
<div className="relative group cursor-pointer inline-flex">
  <AlertTriangle className="w-5 h-5 text-amber-500" />
  <div className="absolute bottom-full right-0 sm:left-1/2 sm:-translate-x-1/2 mb-2 hidden group-hover:block group-active:block w-64 p-3 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg shadow-xl z-50 pointer-events-none">
    Conteúdo do tooltip
  </div>
</div>
```

---

## 📐 Responsividade & Layout (Mobile-First)

### Regras de Overflow — CRÍTICO
- **NUNCA** usar `w-screen` ou `width: 100vw` em elementos de layout
- **NUNCA** usar margens negativas (`-mx-`, `-ml-`, `-mr-`) sem compensar com padding no pai
- Todo container de página: `w-full` (nunca `w-screen`)
- Flex items com texto: adicionar `min-w-0` para prevenir overflow do pai
- Tabelas desktop: **sempre** envolver em `<div className="w-full overflow-x-auto">`
- Tooltips com posição absoluta: usar `overflow-visible` no TableCell pai quando necessário

### Breakpoints padrão
- Mobile só: `xs:` / sem prefixo
- Desktop só: `md:block hidden`
- Transição: `flex-col sm:flex-row`, `text-xs sm:text-sm`

---

## 🗣️ Tom de Voz do Sistema

### Alertas de Compliance (Frontend)
- Exibir via **tooltip CSS-only** com ícone `<AlertTriangle>` — nunca inline no texto da célula
- Tom consultivo, nunca acusatório

| ❌ Proibido | ✅ Correto |
|---|---|
| `⚠️ INSUMO PROIBIDO!` | `Atenção: este insumo pode não ser permitido na certificação orgânica. Consulte seu técnico.` |
| `[SISTEMA] ALERTA...` | Ícone âmbar com tooltip explicativo |

### Backend — Textos Salvos na BD
- O backend **NUNCA** deve concatenar tags técnicas nas strings salvas no banco
- Strings no campo `observacao_original` devem ser limpas e humanizadas
- Tags como `[ALERTA COMPLIANCE]`, `[SISTEMA]`, `\n---\n` **NUNCA entram no banco**
- Se um alerta precisa ser rastreável, usar uma coluna dedicada (ex: `compliance_flag`, `status`)

---

## ⚙️ Práticas de Código

### Frontend
- **Componentes:** Um componente por ficheiro; funcionais com Hooks
- **Lógica:** Extrair para `hooks/` — componentes são "burros" (só renderizam)
- **Serviços:** Toda chamada de API em `services/` — isolamento total
- **Tipos:** Interfaces de domínio em `types/` (ex: `CadernoTypes.ts`)
- **Estado global:** Context API — não introduzir Redux/Zustand sem aprovação

### Backend
- `webhook.py`: Apenas roteamento, validação e orquestração
- `modules/ai_processor.py`: IA, parsing, RAG context injection
- `modules/database_handlers.py`: Todas as leituras/escritas no Supabase
- **Antes de qualquer SQL/jsonpath:** ler `docs/PMO_DATA_STRUCTURE.md` (estrutura canônica do `form_data`)
- Datas: sempre UTC (ISO 8601)
- `pmo_id` é OBRIGATÓRIO em todo registro de `caderno_campo`
