import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    signOutTestUser,
    createTestPMO,
    setActivePMO,
    cleanupTestData,
    loginViaBrowser
} from '../helpers/supabase-setup';

test.describe('ManualRecordDialog - Abertura', () => {
    let userId: string;
    let pmoId: number;

    test.beforeAll(async () => {
        // Autenticar via SDK para criar dados de teste
        userId = await authenticateTestUser();
        const pmo = await createTestPMO('PMO Teste - Abertura Diálogo');
        pmoId = pmo.id;
        await setActivePMO(pmoId);
    });

    test.afterAll(async () => {
        await cleanupTestData(pmoId);
        await signOutTestUser();
    });

    test.beforeEach(async ({ page }) => {
        // Login via browser em cada teste
        await loginViaBrowser(page);
    });

    test('deve abrir diálogo ao clicar em "Novo Registro"', async ({ page }) => {
        // Aguardar dashboard carregar
        await page.waitForLoadState('networkidle');

        // Clicar no botão de adicionar
        const novoRegistroBtn = page.locator('button:has-text("Novo Registro")');
        await expect(novoRegistroBtn).toBeVisible({ timeout: 10000 });
        await novoRegistroBtn.click();

        // Verificar que o diálogo abriu
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        // Verificar título no dialog (usando locator dentro do dialog)
        await expect(dialog.locator('h3:has-text("Novo Registro")')).toBeVisible();
    });

    test('deve mostrar 4 abas (Plantio, Manejo, Colheita, Outro)', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Abrir o diálogo
        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Verificar existência das abas (com exatidão para não pegar labels internos)
        await expect(page.getByRole('tab', { name: /Plantio/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Manejo/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Colheita/i })).toBeVisible();
        await expect(page.getByRole('tab', { name: /Outro/i })).toBeVisible();
    });

    test('deve fechar diálogo ao clicar em Cancelar', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Abrir o diálogo
        await page.locator('button:has-text("Novo Registro")').click();

        // Verificar que abriu
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        // Clicar em cancelar
        await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

        // Verificar que o diálogo fechou
        await expect(dialog).not.toBeVisible();
    });

    test('abas devem estar clicáveis e mudar o conteúdo', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Clicar na aba MANEJO
        await page.getByRole('tab', { name: /Manejo/i }).click();
        await expect(page.locator('text=Operação de Manejo')).toBeVisible();

        // Clicar na aba COLHEITA
        await page.getByRole('tab', { name: /Colheita/i }).click();
        await expect(page.locator('text=Rastreabilidade da Colheita')).toBeVisible();

        // Clicar na aba OUTRO
        await page.getByRole('tab', { name: /Outro/i }).click();
        await expect(page.locator('text=Tipo de Registro Outro')).toBeVisible();

        // Voltar para PLANTIO
        await page.getByRole('tab', { name: /Plantio/i }).click();
        await expect(page.locator('text=Detalhes do Plantio')).toBeVisible();
    });
});
