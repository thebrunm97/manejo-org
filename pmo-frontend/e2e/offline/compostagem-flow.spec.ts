import { test, expect } from '@playwright/test';

test.describe('Fluxo do Módulo de Compostagem', () => {
    test.beforeEach(async ({ page }) => {
        // Assume user is already authenticated via setup or similar before this runs
        await page.goto('/dashboard');
    });

    test('Deve abrir o Modal de Registro e preencher uma Nova Pilha de Compostagem', async ({ page }) => {
        // Click New Record floating action button
        await page.click('button[aria-label="New Record"], button:has-text("Novo Reg")');

        // Verify dialog opens
        await expect(page.locator('h3:has-text("Novo Registro")')).toBeVisible();

        // Navigate to Compostagem Tab by role/label
        await page.click('button[role="tab"]:has-text("COMPOSTO")');

        // Fill Data Hora is usually pre-filled, so we focus on the specific fields
        await page.fill('input[placeholder="Ex: Pilha 01"]', 'Pilha de Teste Automático E2E');

        // Select "Nova Pilha"
        await page.selectOption('select', 'Nova Pilha');

        // Fill ingredients
        await page.fill('textarea[placeholder*="Esterco bovino"]', 'Restos orgânicos, palha, folhas secas');

        // Fill Reponsavel
        await page.fill('input[placeholder="Nome do responsável"]', 'E2E Worker');

        // Save
        await page.click('button:has-text("Salvar Registro")');

        // Verify Success Toast
        await expect(page.locator('.Toastify__toast--success')).toContainText('Registro salvo com sucesso', { timeout: 10000 });
    });
});
