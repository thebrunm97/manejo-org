import { createClient } from '@supabase/supabase-js';
import { Page } from '@playwright/test';

// Validações de segurança
if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ E2E tests cannot run in production environment!');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const testUserEmail = process.env.E2E_TEST_USER_EMAIL;
const testUserPassword = process.env.E2E_TEST_USER_PASSWORD;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.test');
}

if (!testUserEmail || !testUserPassword) {
    throw new Error('Missing E2E_TEST_USER_EMAIL or E2E_TEST_USER_PASSWORD in .env.test');
}

// Cliente Supabase com anon key (respeitará RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Autentica como usuário de teste via SDK
 * Usado para operações de setup/cleanup de dados
 */
export async function authenticateTestUser(): Promise<string> {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: testUserEmail!,
        password: testUserPassword!,
    });

    if (error) {
        throw new Error(`Failed to authenticate test user: ${error.message}`);
    }

    if (!data.user) {
        throw new Error('Authentication succeeded but no user returned');
    }

    console.log(`✅ Authenticated as test user: ${data.user.email}`);
    return data.user.id;
}

/**
 * Login via Browser (formulário web)
 * Deve ser chamado em cada teste para autenticar no browser
 */
export async function loginViaBrowser(page: Page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verificar se já está logado (procurar por elemento do dashboard)
    const dashboardElement = page.locator('button:has-text("Novo Registro"), button:has-text("Gerenciar Planos")');
    if (await dashboardElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('✅ Already logged in');
        return;
    }

    // Fazer login pelo formulário
    console.log('🔐 Logging in via browser...');

    // Preencher email
    const emailInput = page.locator('input[type="email"], input[placeholder*="E-mail"], input[placeholder*="email"]').first();
    await emailInput.fill(testUserEmail!);

    // Preencher senha
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(testUserPassword!);

    // Clicar em Entrar
    const loginButton = page.locator('button:has-text("Entrar"), button[type="submit"]').first();
    await loginButton.click();

    // Aguardar redirecionamento para o dashboard
    await page.waitForURL('**/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    console.log('✅ Logged in via browser');
}

/**
 * Desautentica o usuário de teste
 */
export async function signOutTestUser() {
    await supabase.auth.signOut();
    console.log('🔓 Signed out test user');
}

/**
 * Cria um PMO de teste
 * A tabela pmos usa RLS baseada em auth.uid()
 */
export async function createTestPMO(nomePmo = 'PMO Teste E2E Playwright') {
    const { data: session } = await supabase.auth.getSession();

    if (!session.session?.user?.id) {
        throw new Error('No authenticated user - call authenticateTestUser() first');
    }

    const { data, error } = await supabase
        .from('pmos')
        .insert({
            nome_identificador: nomePmo,
            form_data: {},
            status: 'RASCUNHO',
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create test PMO: ${error.message}`);
    }

    console.log(`✅ Created test PMO: ${data.nome_identificador} (ID: ${data.id})`);
    return data;
}

/**
 * Define o PMO ativo no perfil do usuário
 * Usa upsert garantindo que o perfil exista
 */
export async function setActivePMO(pmoId: number) {
    const { data: session } = await supabase.auth.getSession();

    if (!session.session?.user?.id) {
        throw new Error('No authenticated user');
    }

    // Tentar UPDATE primeiro (perfis geralmente são criados por trigger)
    const { data, error } = await supabase
        .from('profiles')
        .update({
            pmo_ativo_id: pmoId,
            updated_at: new Date().toISOString()
        })
        .eq('id', session.session.user.id) // Garantir que está atualizando o próprio usuário
        .select();

    if (error) {
        console.warn(`⚠️ Failed to set active PMO (Update failed): ${error.message}`);
        // Se falhar o update, pode ser que o perfil não exista (falha no trigger)
        // Tentamos insert apenas se for esse o caso, mas geralmente RLS bloqueia INSERT
    } else if (data.length === 0) {
        console.warn(`⚠️ Failed to set active PMO: Profile not found for user ${session.session.user.id}`);
    } else {
        console.log(`✅ Set active PMO to: ${pmoId}`);
    }
}

/**
 * Limpa dados de teste do PMO especificado
 */
export async function cleanupTestData(pmoId: number) {
    if (!pmoId) {
        console.warn('⚠️ No PMO ID provided for cleanup');
        return;
    }

    // 1. Deletar registros do diário de campo
    const { error: diarioError } = await supabase
        .from('caderno_campo')
        .delete()
        .eq('pmo_id', pmoId);

    if (diarioError) {
        console.warn(`⚠️ Failed to delete caderno_campo records: ${diarioError.message}`);
    }

    // 2. Deletar o PMO
    const { error: pmoError } = await supabase
        .from('pmos')
        .delete()
        .eq('id', pmoId);

    if (pmoError) {
        console.warn(`⚠️ Failed to delete PMO: ${pmoError.message}`);
    } else {
        console.log(`🗑️ Cleaned up test PMO: ${pmoId}`);
    }
}

/**
 * Cria um registro com unidade legada para testar fallback
 */
export async function createLegacyRecord(pmoId: number) {
    const { data, error } = await supabase
        .from('caderno_campo')
        .insert({
            pmo_id: pmoId,
            tipo_atividade: 'PLANTIO',
            quantidade_unidade: 'saca',
            quantidade_valor: 10,
            produto: 'Tomate',
            data_registro: new Date().toISOString(),
            observacao_original: 'Registro legado para teste',
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create legacy record: ${error.message}`);
    }

    console.log(`✅ Created legacy record with unit "saca"`);
    return data;
}

/**
 * Helper para aguardar e verificar se registro foi salvo
 */
export async function waitForRecordInDatabase(
    pmoId: number,
    produto: string,
    maxAttempts = 5
): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
        const { data } = await supabase
            .from('caderno_campo')
            .select('*')
            .eq('pmo_id', pmoId)
            .eq('produto', produto)
            .maybeSingle();

        if (data) {
            console.log(`✅ Record found in database: ${produto}`);
            return true;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.warn(`⚠️ Record not found after ${maxAttempts} attempts: ${produto}`);
    return false;
}


/**
 * Cria um registro genérico no caderno de campo
 */
export async function createRecord(
    pmoId: number,
    data: {
        tipo_atividade: string;
        produto: string;
        quantidade_valor?: number;
        quantidade_unidade?: string;
        detalhes_tecnicos?: any;
        observacao_original?: string;
        data_registro?: string;
    }
) {
    const { data: record, error } = await supabase
        .from('caderno_campo')
        .insert({
            pmo_id: pmoId,
            tipo_atividade: data.tipo_atividade,
            produto: data.produto,
            quantidade_valor: data.quantidade_valor || 0,
            quantidade_unidade: data.quantidade_unidade || 'Unidade',
            detalhes_tecnicos: data.detalhes_tecnicos || {},
            observacao_original: data.observacao_original || 'Registro criado via API de teste',
            data_registro: data.data_registro || new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create record: ${error.message}`);
    }

    console.log(`✅ Created record: ${data.tipo_atividade} - ${data.produto}`);
    return record;
}
