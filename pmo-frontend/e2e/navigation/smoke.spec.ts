import { test, expect } from '@playwright/test';

test.describe('Navegação (Smoke Test)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="email"]', process.env.E2E_TEST_USER_EMAIL ?? '');
        await page.fill('input[name="password"]', process.env.E2E_TEST_USER_PASSWORD ?? '');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('deve navegar para a lista de planos', async ({ page }) => {
        await page.click('text=Gerenciar Planos');
        await expect(page).toHaveURL(/\/planos/);
        await expect(page.getByText('Planos de Manejo')).toBeVisible();
    });

    test('deve navegar para o caderno de campo', async ({ page }) => {
        // Navegar via URL direta ou menu (se houver menu visivel)
        // O Dashboard tem um Card "Plano Atual" com botão "Ver". Vamos tentar usar ele se existir.
        // Ou navegar direto:
        await page.goto('/caderno');
        await expect(page).toHaveURL(/\/caderno/);
        await expect(page.getByText('Diário de Campo')).toBeVisible();
    });

    test('deve abrir o diálogo de novo registro', async ({ page }) => {
        await page.click('text=Novo Registro');
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText('Novo Registro de Atividade')).toBeVisible();
    });

    test('deve navegar para a página de culturas', async ({ page }) => {
        await page.goto('/culturas');
        await expect(page.getByText('Minhas Culturas')).toBeVisible();
    });
});
