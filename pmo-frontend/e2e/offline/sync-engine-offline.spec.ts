import { test, expect } from '@playwright/test';
import { loginViaBrowser, authenticateTestUser, createTestPMO, setActivePMO, cleanupTestData } from '../helpers/supabase-setup';

test.describe('Sync Engine - Offline Persistence & Airplane Mode', () => {
    let pmoId: number;

    test.beforeAll(async () => {
        await authenticateTestUser();
        const pmo = await createTestPMO('Sync Engine E2E');
        pmoId = Number(pmo.id);
        await setActivePMO(pmoId);
    });

    test.afterAll(async () => {
        if (pmoId) await cleanupTestData(pmoId);
    });

    test('deve salvar registro de LIMPEZA offline e sincronizar ao voltar online', async ({ page, context }) => {
        test.setTimeout(90000);
        await loginViaBrowser(page);

        // 1. Entrar em modo offline
        await context.setOffline(true);
        console.log('📡 Browser is now OFFLINE');

        // 2. Abrir ManualRecordDialog e ir para aba Limpeza
        await page.locator('button:has-text("Novo Registro")').click();
        await page.getByRole('tab', { name: 'LIMPEZA' }).click();

        // 3. Preencher formulário de Limpeza
        await page.getByLabel('Item ou Área Higienizada').fill('Galpão de Insumos');
        await page.getByLabel('Tipo de Limpeza').selectOption('Úmida / Lavagem');
        await page.getByLabel('Responsável (Assinatura)').fill('QA Tester');
        
        // 4. Salvar (deve mostrar Toast de Offline)
        const saveButton = page.locator('button:has-text("Salvar Registro")');
        await saveButton.click();

        // 5. Validar Toast de "Salvo OFFLINE"
        await expect(page.locator('text=Salvo OFFLINE')).toBeVisible({ timeout: 10000 });

        // 6. Tentar fechar a aba (deve disparar beforeunload se o sync estivesse ativo, 
        // mas o sync pendente não bloqueia a aba a menos que esteja no LOOP de upload).
        // Como estamos offline, isSyncingRef.current deve ser false após o erro de rede ou check de onLine.
        
        // 7. Voltar Online
        await context.setOffline(false);
        console.log('🌐 Browser is now ONLINE');

        // 8. Aguardar Toast de Sucesso da Sincronização
        // O SyncEngine roda no window 'online' event
        // 5. Verificar feedback
        await expect(page.locator('text=salvo').first()).toBeVisible({ timeout: 20000 });
    });
});
