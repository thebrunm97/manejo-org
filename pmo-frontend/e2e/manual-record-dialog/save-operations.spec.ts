import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    signOutTestUser,
    createTestPMO,
    setActivePMO,
    cleanupTestData,
    loginViaBrowser,
    waitForRecordInDatabase
} from '../helpers/supabase-setup';

test.describe('ManualRecordDialog - Salvamento', () => {
    let userId: string;
    let pmoId: number;

    test.beforeAll(async () => {
        userId = await authenticateTestUser();
        const pmo = await createTestPMO('PMO Teste - Salvamento');
        pmoId = pmo.id;
        await setActivePMO(pmoId);
    });

    test.afterAll(async () => {
        await cleanupTestData(pmoId);
        await signOutTestUser();
    });

    test.beforeEach(async ({ page }) => {
        await loginViaBrowser(page);
    });

    test('deve abrir diálogo e mostrar botão Salvar Registro', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Abrir diálogo
        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Verificar que botão de salvar existe
        await expect(page.locator('button:has-text("Salvar Registro")')).toBeVisible();
    });

    test('deve mostrar seção de detalhes do PLANTIO', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // Abrir diálogo
        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Verificar seção Plantio
        await expect(page.locator('text=DETALHES DO PLANTIO')).toBeVisible();
    });

    test('deve navegar para aba MANEJO', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Ir para aba Manejo
        await page.locator('button:has-text("MANEJO")').click();
        await page.waitForTimeout(300);

        // Verificar conteúdo
        await expect(page.locator('text=OPERAÇÃO DE MANEJO')).toBeVisible();
    });

    test('deve navegar para aba COLHEITA', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Ir para aba Colheita
        await page.locator('button:has-text("COLHEITA")').click();
        await page.waitForTimeout(300);

        // Verificar conteúdo
        await expect(page.locator('text=RASTREABILIDADE DA COLHEITA')).toBeVisible();
    });
});
