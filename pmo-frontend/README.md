# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Architecture Note: Named Routes
The project uses a **Named Routes** system. Always use the `useAppNavigation` hook and `SCREENS` constants for navigation. Never use `useNavigate` or URL strings directly.

## Test Coverage

The project includes a comprehensive suite of unit tests for the Frontend components, specifically covering **all 18 sections** of the PMO Form (`Secao1_MUI` to `Secao18_MUI`).

### Running Tests

To execute the frontend tests using Vitest:

```bash
npm test
```

Tests allow verifying the logic of:
- Conditional rendering (Radio buttons toggling subsections)
- Data binding (Inputs updating the JSON structure correctly)
- Complex interactions (Internal CRUD tables, Modals, File Upload mocks)

---

## 🧪 Testes E2E com Playwright

### Pré-requisitos

1. **Criar usuário de teste no Supabase:**
   - Ir para: Dashboard → Authentication → Users
   - Clicar em "Add user"
   - Email: `teste-e2e@manejo-org.dev`
   - Senha: (gerar senha segura)
   - Copiar o UUID do usuário criado

2. **Configurar `.env.test`:**
   ```bash
   VITE_SUPABASE_URL=https://seu-projeto.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   E2E_TEST_USER_EMAIL=teste-e2e@manejo-org.dev
   E2E_TEST_USER_PASSWORD=sua-senha-segura
   ```

3. **Instalar Playwright:**
   ```bash
   npx playwright install
   ```

### Executar Testes

```bash
# Todos os testes E2E
npm run test:e2e

# Apenas ManualRecordDialog
npx playwright test e2e/manual-record-dialog

# Modo debug (com UI do browser)
npm run test:e2e:debug

# Interface gráfica do Playwright
npm run test:e2e:ui

# Relatório HTML
npx playwright show-report
```

### ⚠️ Notas Importantes

- Testes criam/deletam dados reais no Supabase
- Use projeto de **desenvolvimento**, NUNCA produção
- Usuário de teste deve ter permissões para CRUD em PMOs
- RLS policies devem permitir operações do usuário de teste
