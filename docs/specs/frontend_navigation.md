# 🧭 SPA Routing & Navigation Protocol

Este documento define o padrão obrigatório para criação e manutenção de rotas no PMO Frontend.

## 🌵 O Problema: "Navigation Desert"
O maior risco de bugs de navegação neste projeto é o silêncio. Como utilizamos um hook centralizado (`useAppNavigation.ts`) para lidar com tipagem forte e parâmetros dinâmicos, o esquecimento de um dos passos de mapeamento resulta em um fallback para a rota raiz (`/`), que por sua vez redireciona para `/home`, confundindo o utilizador.

## ✅ Checklist Oficial de 4 Passos

Para cada nova tela/página, siga rigorosamente:

1. **Enum (`routeNames.ts`):** Registre a constante no objeto `SCREENS`. Isso garante que o TypeScript conheça a tela em todo o sistema.
2. **Mapeamento (`useAppNavigation.ts`):** Adicione a string do path físico em `ROUTE_PATHS`. Ex: `[SCREENS.MURAL]: '/mural'`.
3. **Registro (`App.tsx`):** Configure o componente `<Route>` dentro do layout apropriado (Private, Admin, Gestao, etc.).
4. **Parâmetros Dinâmicos:** Se a rota contiver tokens (ex: `:slug`), adicione o tratamento em `navigateTo` usando `generatePath`.

---

> [!IMPORTANT]
> **Dica de Debug:** Se um botão de navegação estiver te levando para a Home inesperadamente, verifique o Console do Navegador. O hook de navegação disparará um `console.warn` indicando que a rota não foi mapeada corretamente.
