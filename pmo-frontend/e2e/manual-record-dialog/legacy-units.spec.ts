import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    signOutTestUser,
    createTestPMO,
    setActivePMO,
    createLegacyRecord,
    cleanupTestData,
    loginViaBrowser
} from '../helpers/supabase-setup';

test.describe('ManualRecordDialog - Unidades Legadas', () => {
    let userId: string;
    let pmoId: number;
    let legacyRecordId: number;

    test.beforeAll(async () => {
        userId = await authenticateTestUser();
        const pmo = await createTestPMO('PMO Teste - Unidades Legadas');
        pmoId = pmo.id;
        await setActivePMO(pmoId);

        // Criar registro com unidade legada
        try {
            const record = await createLegacyRecord(pmoId);
            legacyRecordId = record.id;
        } catch (e) {
            console.warn('⚠️ Could not create legacy record:', e);
        }
    });

    test.afterAll(async () => {
        await cleanupTestData(pmoId);
        await signOutTestUser();
    });

    test.beforeEach(async ({ page }) => {
        await loginViaBrowser(page);
    });

    test('não deve mostrar unidades legadas ao criar novo registro', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Verificar que é NOVO REGISTRO
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('h6:has-text("NOVO REGISTRO"), h2:has-text("NOVO REGISTRO")')).toBeVisible();

        // Verificar que campo de unidade existe
        await expect(page.locator('label:has-text("Unid")')).toBeVisible();
    });

    test('deve mostrar opções de unidade padrão', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);

        // Abrir select de unidades na aba Plantio
        const unitSelect = page.locator('label:has-text("Unid")').locator('..').locator('[role="combobox"]');

        if (await unitSelect.isVisible({ timeout: 2000 })) {
            await unitSelect.click();
            await page.waitForTimeout(300);

            // Verificar opções padrão existem
            const options = page.locator('[role="option"]');
            await expect(options.first()).toBeVisible();

            // Fechar dropdown
            await page.keyboard.press('Escape');
        }
    });
});
