import { test, expect } from '@playwright/test';

test.describe('Autenticação', () => {
    test('deve realizar login com sucesso e redirecionar para o dashboard', async ({ page }) => {
        // 1. Navegar para login
        await page.goto('/login');

        // 2. Preencher credenciais (do .env.test)
        const email = process.env.E2E_TEST_USER_EMAIL;
        const password = process.env.E2E_TEST_USER_PASSWORD;

        if (!email || !password) {
            test.skip('Variáveis de ambiente E2E_TEST_USER_EMAIL ou E2E_TEST_USER_PASSWORD não definidas');
            return;
        }

        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);

        // 3. Submeter
        await page.click('button[type="submit"]');

        // 4. Verificar redirecionamento e elemento do dashboard
        await expect(page).toHaveURL(/\/dashboard/);

        // Verifica se o menu lateral ou header carregou
        await expect(page.getByRole('navigation')).toBeVisible();
    });
});
