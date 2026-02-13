import { test, expect } from '@playwright/test';
import {
    authenticateTestUser,
    signOutTestUser,
    createTestPMO,
    setActivePMO,
    cleanupTestData,
    loginViaBrowser,
    createRecord,
    supabase
} from '../helpers/supabase-setup';

test.describe('ManualRecordDialog - Operações de Edição', () => {
    let userId: string;
    let pmoId: number;

    const saveWithJustification = async (page: any, justificativa = 'Edição automatizada E2E') => {
        await page.getByRole('button', { name: 'Salvar Edição' }).click();
        await expect(page.locator('text=Motivo da Edição')).toBeVisible();
        await page.getByLabel('Justificativa').fill(justificativa);
        await page.getByRole('button', { name: 'Confirmar Edição' }).click();
    };

    test.beforeAll(async () => {
        userId = await authenticateTestUser();
        // Usar um nome único para evitar colisões se rodar em paralelo
        const pmo = await createTestPMO(`PMO Edit Tests ${Date.now()}`);
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

    test('1. Editar registro de PLANTIO existente', async ({ page }) => {
        // 1. Criar registro via API
        const produto = `Alface Americana ${Date.now()}`;
        await createRecord(pmoId, {
            tipo_atividade: 'PLANTIO',
            produto: produto,
            quantidade_valor: 100,
            quantidade_unidade: 'Mudas',
            detalhes_tecnicos: { metodo_propagacao: 'Semeadura direta' }
        });

        // 2. Ir para página de caderno de campo com pmoId explícito
        await page.goto(`/caderno?pmoId=${pmoId}`);

        // Aguardar loading sumir
        await expect(page.getByRole('progressbar')).toHaveCount(0);

        // Localizar a linha que contém o produto
        const row = page.locator('tr').filter({ hasText: produto });
        await expect(row).toBeVisible();

        // Clicar no botão de editar
        await row.locator('button').filter({ has: page.locator('svg[data-testid="EditIcon"]') }).click();

        // 4. Modificar campos
        await expect(page.locator('text=Editar Registro')).toBeVisible();

        // Verificar valor inicial
        const inputQuantidade = page.getByLabel('Quantidade', { exact: false }).first();
        await expect(inputQuantidade).toHaveValue('100');

        await inputQuantidade.fill('150');

        // Alterar outro campo se possível (ex: Observação)
        const obsInput = page.getByLabel('Observações', { exact: false }).first();
        await obsInput.fill('Editado via E2E');

        // 5. Salvar com justificativa
        await saveWithJustification(page);

        // 6. Verificar atualização
        await expect(page.locator('text=Registro atualizado com sucesso')).toBeVisible();

        // Verificar no banco
        const { data: updatedRecord } = await supabase
            .from('caderno_campo')
            .select('*')
            .eq('pmo_id', pmoId)
            .eq('produto', produto)
            .single();

        expect(updatedRecord.quantidade_valor).toBe(150);
        expect(updatedRecord.observacao_original).toContain('Editado via E2E');
    });

    test('2. Editar registro de MANEJO com subtipo', async ({ page }) => {
        const produto = `Calcario ${Date.now()}`;
        await createRecord(pmoId, {
            tipo_atividade: 'MANEJO',
            produto: 'Manejo do Solo',
            detalhes_tecnicos: {
                tipo_manejo: 'Adubação',
                subtipo: 'AplicacaoInsumo',
                insumo: produto,
                dosagem: '500kg'
            },
            observacao_original: 'Manejo inicial'
        });

        await page.goto(`/caderno?pmoId=${pmoId}`);
        await expect(page.getByRole('progressbar')).toHaveCount(0);

        const row = page.locator('tr').filter({ hasText: produto });
        await expect(row).toBeVisible();
        await row.locator('button').filter({ has: page.locator('svg[data-testid="EditIcon"]') }).click();

        await expect(page.locator('text=Editar Registro')).toBeVisible();

        // Verificar se subtipo é mantido
        const insumoInput = page.getByLabel('Insumo', { exact: false });
        await expect(insumoInput).toBeVisible();
        await expect(insumoInput).toHaveValue(produto);

        // Editar insumo
        const novoInsumo = `Gesso ${Date.now()}`;
        await insumoInput.fill(novoInsumo);

        await saveWithJustification(page);

        await expect(page.locator('text=Registro atualizado com sucesso')).toBeVisible();

        // Verificar no banco
        const { data: updatedRecord } = await supabase
            .from('caderno_campo')
            .select('*')
            .eq('pmo_id', pmoId)
            .contains('detalhes_tecnicos', { insumo: novoInsumo })
            .single();

        expect(updatedRecord).toBeTruthy();
        expect(updatedRecord.detalhes_tecnicos.subtipo).toBe('AplicacaoInsumo');
    });

    test('3. Editar registro de COLHEITA', async ({ page }) => {
        const produto = `Morango ${Date.now()}`;
        await createRecord(pmoId, {
            tipo_atividade: 'COLHEITA',
            produto: produto,
            quantidade_valor: 10,
            quantidade_unidade: 'kg',
            detalhes_tecnicos: { lote: 'Lote A' }
        });

        await page.goto(`/caderno?pmoId=${pmoId}`);
        await expect(page.getByRole('progressbar')).toHaveCount(0);

        const row = page.locator('tr').filter({ hasText: produto });
        await expect(row).toBeVisible();
        await row.locator('button').filter({ has: page.locator('svg[data-testid="EditIcon"]') }).click();

        await expect(page.locator('text=Editar Registro')).toBeVisible();

        const qtdInput = page.getByLabel('Quantidade', { exact: false }).first();
        await qtdInput.fill('20');

        await saveWithJustification(page);

        await expect(page.locator('text=Registro atualizado com sucesso')).toBeVisible();

        const { data: updatedRecord } = await supabase
            .from('caderno_campo')
            .select('*')
            .eq('pmo_id', pmoId)
            .eq('produto', produto)
            .single();
        expect(updatedRecord.quantidade_valor).toBe(20);
    });

    test('4. Cancelar edição sem salvar', async ({ page }) => {
        const produto = `Rúcula ${Date.now()}`;
        await createRecord(pmoId, {
            tipo_atividade: 'PLANTIO',
            produto: produto,
            quantidade_valor: 50
        });

        await page.goto(`/caderno?pmoId=${pmoId}`);
        await expect(page.getByRole('progressbar')).toHaveCount(0);

        const row = page.locator('tr').filter({ hasText: produto });
        await expect(row).toBeVisible();
        await row.locator('button').filter({ has: page.locator('svg[data-testid="EditIcon"]') }).click();

        await expect(page.locator('text=Editar Registro')).toBeVisible();
        const produtoInput = page.getByLabel('Produto / Cultura', { exact: false });
        await produtoInput.fill('Agrião Alterado');

        // Clicar em Cancelar
        await page.getByRole('button', { name: 'Cancelar' }).click();

        // Verificar que diálogo fechou
        await expect(page.locator('text=Editar Registro')).not.toBeVisible();

        // Verificar que NÃO mudou no banco
        const { data: record } = await supabase
            .from('caderno_campo')
            .select('*')
            .eq('pmo_id', pmoId)
            .eq('produto', produto) // Busca pelo original
            .single();

        expect(record).toBeTruthy();
        expect(record.produto).toBe(produto);
    });

    test('5. Validações em modo de edição', async ({ page }) => {
        const produto = `Cenoura ${Date.now()}`;
        await createRecord(pmoId, {
            tipo_atividade: 'PLANTIO',
            produto: produto,
            quantidade_valor: 200
        });

        await page.goto(`/caderno?pmoId=${pmoId}`);
        await expect(page.getByRole('progressbar')).toHaveCount(0);

        const row = page.locator('tr').filter({ hasText: produto });
        await expect(row).toBeVisible();
        await row.locator('button').filter({ has: page.locator('svg[data-testid="EditIcon"]') }).click();

        // Limpar campo obrigatório (Produto)
        const produtoInput = page.getByLabel('Produto / Cultura', { exact: false });
        await produtoInput.fill('');

        // Tentar salvar (clique inicial)
        await page.getByRole('button', { name: 'Salvar Edição' }).click();

        // O modal de justificativa NÃO deve aparecer
        await expect(page.locator('text=Motivo da Edição')).not.toBeVisible();

        // O formulário de edição deve continuar aberto (ou mensagens de erro visíveis)
        await expect(page.locator('text=Editar Registro')).toBeVisible();
    });
});
