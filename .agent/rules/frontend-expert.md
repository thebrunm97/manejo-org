---
description: Especialista em React, Vite e Tailwind CSS (SaaS Moderno)
globs: ["pmo-frontend/**/*.jsx", "pmo-frontend/**/*.tsx", "pmo-frontend/**/*.ts"]
---

# Role: Frontend Expert — Padrão SaaS Moderno

> ⚠️ **Atenção:** As antigas instruções sobre Material UI foram **revogadas**.
> O padrão oficial é **Tailwind CSS + HTML nativo**. Consulte `PROJECT_INSTRUCTIONS.md` para o Design System completo.

## 🛠️ Stack Obrigatória
- **React 19 + TypeScript** — componentes funcionais com Hooks
- **Tailwind CSS v4** — única fonte de estilo em código novo
- **lucide-react** — biblioteca de ícones primária
- **@supabase/supabase-js** — acessado exclusivamente via `services/`
- **react-toastify** — notificações (desprecado: `alert()` nativo)
- **zod** — validação de schema

## 🎨 Padrões de UI/UX
- **Botões:** HTML nativo `<button type="button">` com classes Tailwind. Ver `PROJECT_INSTRUCTIONS.md`
- **Modais:** Estrutura `fixed inset-0 z-50`. Ver `PROJECT_INSTRUCTIONS.md`
- **Tooltips:** CSS-only via `group-hover`. Ver `PROJECT_INSTRUCTIONS.md`
- **Ícones:** `lucide-react` — ex: `import { Trash2, Edit, AlertTriangle } from 'lucide-react'`
- **Bordas:** `rounded-md` em inputs/botões, `rounded-lg` em cards/modais
- **Sombras:** Flat design — sem sombras difusas. `border border-slate-200` delimita espaços
- **Cor primária:** `green-600` / `green-700` para ações principais

## 📐 Layout & Responsividade
- Mobile-first — o app é usado no campo
- **NUNCA** usar `w-screen` ou `100vw`
- **NUNCA** usar margens negativas (`-mx-`, `-ml-`) sem compensação
- Tabelas: sempre envolver em `<div className="w-full overflow-x-auto">`
- Flex items com texto: `min-w-0` para prevenir overflow

## 🔐 Segurança & Dados
- **Rotas:** Usar `ProtectedRoute` para áreas logadas
- **Estado:** Context API para estado global (Auth, Theme)
- **API:** Todas as chamadas ao Supabase passam pela camada `services/`
- **TypeScript:** Sem `any` em código novo

## 🧪 Testes
- Manter testes E2E (Playwright) atualizados ao mudar fluxos críticos (Login, Cadastro PMO, ManualRecordDialog)

## 🚫 Proibido Neste Role
```
❌ Importar de @mui/material para código novo
❌ Usar prop `sx` do MUI
❌ Usar <Button>, <IconButton>, <Dialog>, <TextField> do MUI em código novo
❌ Usar w-screen ou 100vw
❌ Margens negativas não compensadas
❌ Chamar Supabase diretamente no componente
```
