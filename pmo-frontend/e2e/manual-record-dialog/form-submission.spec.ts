import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    loginViaBrowser,
    createTestPMO,
    cleanupTestData,
    setActivePMO,
    createInfrastructure,
    waitForRecordInDatabase
} from '../helpers/supabase-setup';

test.describe('ManualRecordDialog - Fluxo de Submissão', () => {
    let pmoId: number;

    test.beforeAll(async () => {
        // Setup inicial dos dados no Supabase
        await authenticateTestUser();
        const pmo = await createTestPMO('PMO Submissão E2E');
        pmoId = Number(pmo.id);
        await setActivePMO(pmoId);
        await createInfrastructure(pmoId, 'Gleba 1', 'Canteiro A');
    });

    test.afterAll(async () => {
        // Cleanup para não poluir o banco
        if (pmoId) {
            await cleanupTestData(pmoId);
        }
    });

    test('deve preencher e salvar um registro de PLANTIO com sucesso', async ({ page }) => {
        test.setTimeout(60000);
        await loginViaBrowser(page);

        // 1. Abrir diálogo (Aguardar dashboard carregar - pode haver skeleton)
        const openButton = page.locator('button:has-text("Novo Registro")');
        await expect(openButton).toBeVisible({ timeout: 15000 });
        await openButton.click();

        // Verificar se diálogo abriu
        await expect(page.getByRole('heading', { name: "Novo Registro" })).toBeVisible();

        // 2. Garantir que estamos na aba PLANTIO (padrão)
        const tabPlantio = page.getByRole('tab', { name: "Plantio" });
        // Se houver múltiplas abas, a ativa deve estar visível
        await expect(tabPlantio).toBeVisible();

        // 3. Preencher Produto
        const produtoInput = page.getByLabel(/Cultura|Produto/);
        const testProduto = `Alface E2E ${Date.now()}`;
        await produtoInput.fill(testProduto);

        // 4. Preencher Quantidade e Unidade
        const qtdInput = page.getByLabel('Quantidade');
        await qtdInput.fill('100');

        const unidadeSelect = page.getByLabel('Unid.', { exact: true });
        await unidadeSelect.selectOption('unid');

        // 5. Selecionar Localização
        const localizacaoButton = page.locator('text=Clique para selecionar Talhões ou Canteiros...');
        await localizacaoButton.click();

        // Diálogo de Locais
        await expect(page.locator('h3:has-text("Selecionar Locais")')).toBeVisible();

        // Clicar no canteiro (Gleba 1 > Canteiro A)
        // O checkbox tem o nome do canteiro
        const canteiroCheckbox = page.locator('span:has-text("Canteiro A")').first();
        await canteiroCheckbox.click();

        const confirmLocaisButton = page.locator('button:has-text("Confirmar")');
        await confirmLocaisButton.click();

        // Verificar se a seleção aparece (o botão de locais contém o nome do local selecionado)
        await expect(page.locator('span:has-text("Canteiro A")')).toBeVisible();

        // 6. Observações Adicionais
        const obsTextarea = page.getByLabel('Observações Adicionais');
        await obsTextarea.fill('Teste automatizado de submissão');

        // 7. Salvar
        const saveButton = page.locator('button:has-text("Salvar Registro")');
        await saveButton.click();

        // 8. Verificar feedback (Toast)
        // O toast agora tem um texto específico e emoji
        await expect(page.locator('text=sucesso').first()).toBeVisible({ timeout: 15000 });

        // 9. Verificar no Banco de Dados (Supabase)
        const found = await waitForRecordInDatabase(pmoId, testProduto);
        expect(found).toBe(true);
    });
});
