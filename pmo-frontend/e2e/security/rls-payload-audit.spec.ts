import { test, expect } from '@playwright/test';
import { loginViaBrowser, authenticateTestUser, createTestPMO, setActivePMO, cleanupTestData } from '../helpers/supabase-setup';

test.describe('RLS Payload Audit - Security Verification', () => {
    let pmoId: number;

    test.beforeAll(async () => {
        await authenticateTestUser();
        const pmo = await createTestPMO('RLS Audit PMO');
        pmoId = Number(pmo.id);
        await setActivePMO(pmoId);
    });

    test.afterAll(async () => {
        if (pmoId) await cleanupTestData(pmoId);
    });

    test('NÃO deve enviar user_id ou pmo_id no payload de caderno_campo (POST)', async ({ page }) => {
        await loginViaBrowser(page);

        // 1. Interceptar chamadas POST para a tabela caderno_campo
        let payloadIntercepted = false;
        await page.route('**/rest/v1/caderno_campo*', async (route) => {
            const request = route.request();
            if (request.method() === 'POST') {
                const postData = request.postDataJSON();
                console.log('🕵️ Payload Audit (Caderno):', postData);
                
                // Assert: user_id e pmo_id NÃO devem estar no corpo
                expect(postData).not.toHaveProperty('user_id');
                expect(postData).not.toHaveProperty('pmo_id');
                
                payloadIntercepted = true;
            }
            await route.continue();
        });

        // 2. Preencher e Salvar um registro
        await page.locator('button:has-text("Novo Registro")').click();
        await page.getByLabel(/Cultura|Produto/).fill('Auditoria RLS');
        await page.getByLabel('Quantidade').fill('10');
        await page.locator('button:has-text("Salvar Registro")').click();

        // 3. Aguardar Toast de Sucesso para garantir que o POST aconteceu
        await expect(page.locator('text=salvo').first()).toBeVisible({ timeout: 15000 });
        expect(payloadIntercepted).toBe(true);
    });

    test('NÃO deve enviar user_id ou pmo_id no payload de pmo_limpeza (POST)', async ({ page }) => {
        let payloadIntercepted = false;

        await page.route('**/rest/v1/pmo_limpeza*', async (route) => {
            const request = route.request();
            if (request.method() === 'POST') {
                const payload = request.postDataJSON();
                console.log('Intercepted pmo_limpeza POST payload:', payload);

                // ASSERT: Campos sensíveis NÃO devem estar no body
                expect(payload.user_id).toBeUndefined();
                expect(payload.pmo_id).toBeUndefined();
                payloadIntercepted = true;
            }
            await route.continue();
        });

        // 2. Preencher e Salvar Limpeza
        await page.locator('button:has-text("Novo Registro")').click();
        await page.getByRole('tab', { name: 'LIMPEZA' }).click();
        await page.getByLabel('Item ou Área Higienizada').fill('Área Auditoria');
        await page.getByLabel('Tipo de Limpeza').selectOption('Desinfecção');
        await page.getByLabel('Responsável (Assinatura)').fill('Audit Agent');
        await page.locator('button:has-text("Salvar Registro")').click();

        // 3. Validar
        await expect(page.locator('text=salvo').first()).toBeVisible({ timeout: 15000 });
        expect(payloadIntercepted).toBe(true);
    });
});
