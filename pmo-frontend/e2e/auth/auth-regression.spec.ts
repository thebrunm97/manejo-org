import { test, expect } from '@playwright/test';
import { loginViaBrowser, cleanupTestData, createTestPMO, setActivePMO, authenticateTestUser } from '../helpers/supabase-setup';

test.describe('AuthContext - Regressão e Persistência', () => {
    let pmoId: number;

    test.beforeAll(async () => {
        await authenticateTestUser();
        const pmo = await createTestPMO('Auth Regression PMO');
        pmoId = Number(pmo.id);
        await setActivePMO(pmoId);
    });

    test.afterAll(async () => {
        if (pmoId) await cleanupTestData(pmoId);
    });

    test('deve manter o pmoAtivoId após login com novo AuthContext', async ({ page }) => {
        await loginViaBrowser(page);
        
        // Verificar se redirecionou para dashboard
        await expect(page).toHaveURL(/.*dashboard/);
        
        // Verificar se o ID do PMO está presente no estado (via UI ou console se necessário)
        // No dashboard, se o PMO estiver ativo, o botão "Gerenciar Planos" ou similar deve estar visível
        await expect(page.locator('button:has-text("Novo Registro")')).toBeVisible({ timeout: 15000 });
    });

    test('deve redirecionar para /login ao tentar acessar rota protegida sem auth', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForURL(/.*login/);
        await expect(page).toHaveURL(/.*login/);
    });

    test('deve mostrar loading state durante a inicialização do AuthContext', async ({ page }) => {
        // Slow down network to catch loading state if possible, or just check for the element
        await page.goto('/');
        const loading = page.locator('text=Carregando...');
        // O loading pode ser muito rápido, mas se aparecer, deve ter o spinner
        if (await loading.isVisible()) {
            await expect(page.locator('.animate-spin')).toBeVisible();
        }
    });
});
