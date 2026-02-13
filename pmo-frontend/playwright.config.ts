import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente para testes
dotenv.config({ path: '.env.test' });

// Validar variáveis necessárias
const requiredEnvVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'E2E_TEST_USER_EMAIL',
    'E2E_TEST_USER_PASSWORD',
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
    console.error(
        `⚠️ Missing required environment variables in .env.test:\n${missingVars.join('\n')}`
    );
    console.error('Please create .env.test with the required variables.');
}

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false, // Evitar race conditions com Supabase
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Um worker para testes com DB
    reporter: 'html',

    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000, // 2 minutos para iniciar
    },
});
