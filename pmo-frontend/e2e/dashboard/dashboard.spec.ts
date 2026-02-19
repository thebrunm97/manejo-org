import { test, expect } from '@playwright/test';

test.describe('Dashboard (Visualização)', () => {
    test.beforeEach(async ({ page }) => {
        // Login programático ou via UI antes de cada teste
        // Para simplificar, vamos via UI por enquanto (ideal seria via API/Session saving)
        await page.goto('/login');
        await page.fill('input[name="email"]', process.env.E2E_TEST_USER_EMAIL ?? '');
        await page.fill('input[name="password"]', process.env.E2E_TEST_USER_PASSWORD ?? '');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('deve renderizar os widgets principais', async ({ page }) => {
        // Verificar cabeçalho com saudação
        await expect(page.getByText(/Resumo da produção em/i)).toBeVisible();

        // Verificar botões de ação
        await expect(page.getByRole('button', { name: 'Gerenciar Planos' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Novo Registro' })).toBeVisible();

        // Verificar Card do Assistente Inteligente
        await expect(page.getByText('Assistente Inteligente')).toBeVisible();

        // Verificar se o Weather Widget renderizou (pode estar carregando, então wait)
        // O WeatherWidget tem texto "LOCAL ATUAL"
        await expect(page.getByText('LOCAL ATUAL')).toBeVisible({ timeout: 10000 });
    });
});
