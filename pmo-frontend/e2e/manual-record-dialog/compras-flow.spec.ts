import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    loginViaBrowser,
    createTestPMO,
    cleanupTestData,
    setActivePMO,
    waitForRecordInDatabase
} from '../helpers/supabase-setup';

test.describe('ManualRecordDialog - ComprasTab Flow', () => {
    let pmoId: number;

    test.beforeAll(async () => {
        await authenticateTestUser();
        const pmo = await createTestPMO('PMO Compras E2E');
        pmoId = Number(pmo.id);
        await setActivePMO(pmoId);
    });

    test.afterAll(async () => {
        if (pmoId) {
            await cleanupTestData(pmoId);
        }
    });

    test('deve preencher e salvar um registro de COMPRAS com sucesso', async ({ page }) => {
        test.setTimeout(60000);
        await loginViaBrowser(page);

        // 1. Abrir diálogo
        await page.locator('button:has-text("Novo Registro")').click();

        // 2. Ir para aba COMPRAS
        await page.getByRole('tab', { name: "COMPRAS" }).click();

        // 3. Preencher Campos de Compras
        const testProduto = `Fertilizante E2E ${Date.now()}`;
        await page.getByLabel('Produto Adquirido').fill(testProduto);
        
        await page.getByLabel('Fornecedor / Loja').fill('Agropecuária São João');
        await page.getByLabel('NF / Recibo (Opcional)').fill('NF 123456');
        
        await page.getByLabel('Quantidade Adquirida').fill('50');
        await page.getByLabel('Unidade').selectOption('kg');

        // 4. Salvar
        const saveButton = page.locator('button:has-text("Salvar Registro")');
        await saveButton.click();

        // 5. Verificar feedback (Toast)
        await expect(page.locator('text=salvo').first()).toBeVisible({ timeout: 20000 });
        
        // 6. Verificar no Banco de Dados (Supabase)
        const found = await waitForRecordInDatabase(pmoId, testProduto);
        expect(found).toBe(true);
    });
});
