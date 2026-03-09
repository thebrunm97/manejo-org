import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    signOutTestUser,
    createTestPMO,
    setActivePMO,
    cleanupTestData,
    loginViaBrowser
} from '../helpers/supabase-setup';

test.describe('ManualRecordDialog - Validações', () => {
    let userId: string;
    let pmoId: number;

    test.beforeAll(async () => {
        userId = await authenticateTestUser();
        const pmo = await createTestPMO('PMO Teste - Validações');
        pmoId = pmo.id;
        await setActivePMO(pmoId);
    });

    test.afterAll(async () => {
        await cleanupTestData(pmoId);
        await signOutTestUser();
    });

    test.beforeEach(async ({ page }) => {
        await loginViaBrowser(page);
        await page.waitForLoadState('networkidle');
        await page.getByRole('button', { name: "Novo Registro" }).click();
        await page.waitForTimeout(500);
    });

    test('PLANTIO: deve exigir campos obrigatórios', async ({ page }) => {
        // Já está na aba Plantio por padrão
        await expect(page.locator('text=Detalhes do Plantio')).toBeVisible();

        // Limpar campo de cultura e tentar salvar
        const culturaInput = page.getByLabel(/Cultura|Produto/);
        await culturaInput.fill('');

        // Tentar salvar sem preencher campos obrigatórios
        await page.getByRole('button', { name: "Salvar Registro" }).click();

        // Verificar que há erros de validação (o dialog não fecha)
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
    });

    test('MANEJO: campos específicos aparecem ao selecionar subtipo', async ({ page }) => {
        // Ir para aba Manejo
        await page.getByRole('tab', { name: /Manejo/i }).click();
        await page.waitForTimeout(300);

        await expect(page.locator('text=Operação de Manejo')).toBeVisible();

        // Verificar que label de Tipo de Operação existe via getByLabel
        await expect(page.getByLabel('Tipo de Operação')).toBeVisible();
    });

    test('COLHEITA: campos de rastreabilidade visíveis', async ({ page }) => {
        // Ir para aba Colheita
        await page.getByRole('tab', { name: /Colheita/i }).click();
        await page.waitForTimeout(300);

        await expect(page.locator('text=Rastreabilidade da Colheita')).toBeVisible();

        // Verificar campo de LOTE
        await expect(page.getByLabel(/LOTE/i)).toBeVisible();
    });

    test('OUTRO: dropdown de Subtipo está visível', async ({ page }) => {
        // Ir para aba Outro
        await page.getByRole('tab', { name: /Outro/i }).click();
        await page.waitForTimeout(300);

        await expect(page.locator('text=Tipo de Registro Outro')).toBeVisible();

        // Verificar usando label
        await expect(page.getByLabel('Subtipo')).toBeVisible();
    });
});
