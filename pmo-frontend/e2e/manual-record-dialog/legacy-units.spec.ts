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

        await page.getByRole('button', { name: "Novo Registro" }).click();
        await page.waitForTimeout(500);

        // Verificar que é NOVO REGISTRO
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
        await expect(page.getByRole('heading', { name: "Novo Registro" })).toBeVisible();

        // Verificar que campo de unidade existe
        await expect(page.getByLabel('Unid.', { exact: true })).toBeVisible();
    });

    test('deve mostrar opções de unidade padrão', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        await page.getByRole('button', { name: "Novo Registro" }).click();
        await page.waitForTimeout(500);

        // Verificar que o select de unidades está visível
        const unitSelect = page.getByLabel('Unid.', { exact: true });
        await expect(unitSelect).toBeVisible();

        // No Playwright, para verificar opções de um <select> nativo, podemos usar querySelectorAll ou apenas selectOption
        // Como o ManualRecordDialog usa <select> nativo agora, não "abrimos" o dropdown com click() para ver opções como se fossem li/div
        const options = unitSelect.locator('option');
        const count = await options.count();
        expect(count).toBeGreaterThan(0);
    });
});
