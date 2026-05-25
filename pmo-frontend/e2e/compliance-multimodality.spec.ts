import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    signOutTestUser,
    loginViaBrowser
} from './helpers/supabase-setup';

test.describe('E2E Compliance & Multimodality Guardrails', () => {
    let userId: string;

    test.beforeAll(async () => {
        // Authenticate via Supabase SDK to acquire a valid session
        userId = await authenticateTestUser();
    });

    test.afterAll(async () => {
        await signOutTestUser();
    });

    test('Caso 1 (E2E-01 - Bloqueio de Rota): Convencional-Only redirect to dashboard with toast', async ({ page }) => {
        test.setTimeout(45000);

        // 1. Intercept network requests before any navigation to force a Conventional-only profile
        await page.route('**/rest/v1/propriedades*', async (route) => {
            if (route.request().method() === 'GET') {
                const mockPropriedades = [
                    {
                        id: 9999,
                        nome: "Fazenda Convencional E2E",
                        area_total_ha: 150,
                        tem_producao_paralela: false,
                        modalidade_predominante: "CONVENCIONAL",
                        user_id: userId,
                        created_at: new Date().toISOString()
                    }
                ];
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockPropriedades)
                });
            } else {
                await route.continue();
            }
        });

        await page.route('**/rest/v1/profiles*', async (route) => {
            if (route.request().method() === 'GET') {
                const mockProfile = {
                    id: userId,
                    nome: "Produtor Convencional E2E",
                    avatar_url: null,
                    pmo_ativo_id: null,
                    role: "user",
                    plan_tier: "free",
                    propriedade_ativa_id: 9999,
                    telefone: null
                };
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockProfile)
                });
            } else {
                await route.continue();
            }
        });

        // 2. Perform web login via browser flow
        await loginViaBrowser(page);
        await page.waitForLoadState('networkidle');

        // 3. Attempt direct navigation to restricted route /planos
        console.log('Navigate to /planos directly...');
        await page.goto('/planos');

        // 4. Asserts: Redirected to /dashboard, URL matching dashboard, toast message matches
        await page.waitForURL(url => url.pathname.includes('dashboard') || url.pathname === '/', { timeout: 10000 });
        expect(page.url()).not.toContain('/planos');

        const toastElement = page.locator('text=Acesso restrito a áreas Orgânicas/Transição.');
        await expect(toastElement).toBeVisible({ timeout: 10000 });
    });

    test('Caso 2 (E2E-03 - Bloqueio de Insumo no Form): 100% Organico gets client-side validation error and disabled submit button', async ({ page }) => {
        test.setTimeout(45000);

        // 1. Intercept network requests to force a 100% Organic profile
        await page.route('**/rest/v1/propriedades*', async (route) => {
            if (route.request().method() === 'GET') {
                const mockPropriedades = [
                    {
                        id: 8888,
                        nome: "Fazenda Orgânica E2E",
                        area_total_ha: 80,
                        tem_producao_paralela: false,
                        modalidade_predominante: "ORGANICO",
                        user_id: userId,
                        created_at: new Date().toISOString()
                    }
                ];
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockPropriedades)
                });
            } else {
                await route.continue();
            }
        });

        await page.route('**/rest/v1/profiles*', async (route) => {
            if (route.request().method() === 'GET') {
                const mockProfile = {
                    id: userId,
                    nome: "Produtor Orgânico E2E",
                    avatar_url: null,
                    pmo_ativo_id: 12345,
                    role: "user",
                    plan_tier: "free",
                    propriedade_ativa_id: 8888,
                    telefone: null
                };
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockProfile)
                });
            } else {
                await route.continue();
            }
        });

        // Mock pmos list
        await page.route('**/rest/v1/pmos*', async (route) => {
            if (route.request().method() === 'GET') {
                const mockPmos = [
                    {
                        id: 12345,
                        nome_identificador: "Plano de Manejo Orgânico E2E",
                        status: "Em andamento",
                        version: "1.0",
                        created_at: new Date().toISOString()
                    }
                ];
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockPmos)
                });
            } else {
                await route.continue();
            }
        });

        // Mock organic talhões
        await page.route('**/rest/v1/talhoes*', async (route) => {
            if (route.request().method() === 'GET') {
                const mockTalhoes = [
                    {
                        id: 777,
                        pmo_id: 12345,
                        propriedade_id: 8888,
                        nome: "Talhão Orgânico A",
                        area_hectares: 10,
                        modalidade_producao: "ORGANICO",
                        user_id: userId
                    }
                ];
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(mockTalhoes)
                });
            } else {
                await route.continue();
            }
        });

        await page.route('**/rest/v1/canteiros*', async (route) => {
            if (route.request().method() === 'GET') {
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([])
                });
            } else {
                await route.continue();
            }
        });

        // 2. Perform web login
        await loginViaBrowser(page);
        await page.waitForLoadState('networkidle');

        // 3. Open manual record dialog
        const novoRegistroBtn = page.locator('button:has-text("Novo Registro")');
        await expect(novoRegistroBtn).toBeVisible({ timeout: 15000 });
        await novoRegistroBtn.click();

        const dialog = page.locator('[role="dialog"]');
        await expect(dialog).toBeVisible();

        // 4. Select "Manejo" activity type
        const tabManejoSelect = page.getByRole('button', { name: 'Manejo', exact: true });
        await tabManejoSelect.click();

        // 5. Select "Aplicação de Insumos" subtype
        const selectSubtype = page.locator('#subtipo-manejo-select');
        await selectSubtype.selectOption('APLICACAO_INSUMO');

        // 6. Select location "Talhão Orgânico A"
        const selectLocalBtn = page.locator('text=Toque para selecionar Talhões ou Canteiros...');
        await selectLocalBtn.click();

        const talhaoCheckbox = page.locator('span:has-text("Área Total")').first();
        await talhaoCheckbox.click();

        const confirmLocaisBtn = page.locator('button:has-text("Confirmar")');
        await confirmLocaisBtn.click();

        // 7. Fill prohibited input "Glifosato"
        const insumoInput = page.locator('#insumo-input');
        await insumoInput.fill('Glifosato');

        // 8. Fill dosage
        const dosagemInput = page.locator('#dosagem-input');
        await dosagemInput.fill('5 Litros');

        // 9. Click save to trigger validation
        const saveButton = page.locator('button:has-text("Salvar Registro")');
        await saveButton.click();

        // 10. Assert validation warning message on screen
        const validationError = page.locator('text=⛔ PROIBIDO: Herbicida sintético (Lei 10.831).');
        await expect(validationError).toBeVisible({ timeout: 5000 });

        // 11. Assert save button is disabled
        await expect(saveButton).toBeDisabled();
    });
});
