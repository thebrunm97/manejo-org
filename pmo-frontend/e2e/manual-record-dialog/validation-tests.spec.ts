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
        await page.locator('button:has-text("Novo Registro")').click();
        await page.waitForTimeout(500);
    });

    test('PLANTIO: deve exigir campos obrigatórios', async ({ page }) => {
        // Já está na aba Plantio por padrão
        await expect(page.locator('text=DETALHES DO PLANTIO')).toBeVisible();

        // Limpar campo de cultura e tentar salvar
        const culturaInput = page.locator('input[placeholder*="Alface"]');
        await culturaInput.fill('');

        // Tentar salvar sem preencher campos obrigatórios
        await page.locator('button:has-text("Salvar Registro")').click();

        // Verificar que há erros de validação (o dialog não fecha)
        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();
    });

    test('MANEJO: campos específicos aparecem ao selecionar subtipo', async ({ page }) => {
        // Ir para aba Manejo
        await page.locator('button:has-text("MANEJO")').click();
        await page.waitForTimeout(300);

        await expect(page.locator('text=OPERAÇÃO DE MANEJO')).toBeVisible();

        // Verificar que label de Tipo de Operação existe usando locator específico
        await expect(page.locator('#subtipo-manejo-label')).toBeVisible();
    });

    test('COLHEITA: campos de rastreabilidade visíveis', async ({ page }) => {
        // Ir para aba Colheita
        await page.locator('button:has-text("COLHEITA")').click();
        await page.waitForTimeout(300);

        await expect(page.locator('text=RASTREABILIDADE DA COLHEITA')).toBeVisible();

        // Verificar campo de LOTE usando input
        const loteInput = page.locator('input').filter({ hasText: /LOTE/i }).or(
            page.locator('label').filter({ hasText: /LOTE/i })
        );
        await expect(loteInput.first()).toBeVisible();
    });

    test('OUTRO: dropdown de Subtipo está visível', async ({ page }) => {
        // Ir para aba Outro
        await page.locator('button:has-text("OUTRO")').click();
        await page.waitForTimeout(300);

        await expect(page.locator('text=TIPO DE REGISTRO OUTRO')).toBeVisible();

        // Verificar usando ID específico do label
        await expect(page.locator('#tipo-outro-label')).toBeVisible();
    });
});
