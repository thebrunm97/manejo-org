import express from 'express';
import axios from 'axios';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

const app = express();
app.use(express.json());

const PORT = 3333;
const TEST_TOKEN = 'TY6oMv4d20a3';
const SESSION_NAME = 'agro_vivo';

interface BenchmarkResult {
    vuId: string;
    scenario: string;
    pythonTime: string;
    goTime: string;
    winner: string;
    goResponse: string;
}

const results: BenchmarkResult[] = [];
const PYTHON_BOT_URL = process.env.PYTHON_BOT_URL || 'http://bot-python:5000';
const GO_BOT_URL = process.env.GO_BOT_URL || 'http://bot-go:8080';

// Mock WPPConnect Routes
app.post('/api/:session/:secret/generate-token', (req, res) => {
    res.status(201).json({ token: 'mock-jwt-token' });
});

app.get('/api/:session/check-connection-session', (req, res) => {
    res.json({ status: true, message: 'Connected' });
});

// Map to track responses by phone number for multi-VU support
const pendingResponses = new Map<string, {
    python?: { text: string; time: number };
    go?: { text: string; time: number };
    resolver: () => void;
}>();

app.post('/api/:session/send-message', (req, res) => {
    const { message, phone } = req.body;
    const botType = req.headers['user-agent']?.includes('python') ? 'Python' : 'Go';
    const cleanPhone = phone.split('@')[0];

    // console.log(chalk.gray(`[Mock] Received ${botType} for ${cleanPhone}: "${message.substring(0, 20)}..."`));

    const state = pendingResponses.get(cleanPhone);
    if (state) {
        const duration = Math.round(performance.now() - (state as any).startTime);
        if (botType === 'Python') state.python = { text: message, time: duration };
        else state.go = { text: message, time: duration };

        if (state.python && state.go) state.resolver();
    }

    res.json({ status: 'success', response: { id: 'mock-id' } });
});

// Agricultural Scenarios
const scenarios = [
    { name: 'Plantio', text: 'Plantei 2 hectares de milho crioulo no talhão sul hoje.' },
    { name: 'Colheita', text: 'Colhi 500 caixas de tomate cereja agora de tarde.' },
    { name: 'Compostagem', text: 'Revirei a pilha de compostagem 02 agora de manhã e a temperatura bateu 65 graus.' },
    { name: 'Compras', text: 'Comprei 20 sacos de torta de mamona no Armazém do Zé, a nota fiscal é a 98765.' },
    { name: 'RAG/Especialista', text: 'Como controlar vaquinha no feijão orgânico?' }
];

async function runVU(vuId: number) {
    const phone = `551199999000${vuId}`;
    const scenario = scenarios[vuId % scenarios.length];
    
    console.log(chalk.blue(`[VU-${vuId}] 🚀 Iniciando: ${scenario.name} (Phone: ${phone})`));

    // Wait a random "typing" delay
    await new Promise(r => setTimeout(r, Math.random() * 2000));

    return new Promise<void>(async (resolve) => {
        const vuStartTime = performance.now();
        pendingResponses.set(phone, {
            resolver: () => {
                const state = pendingResponses.get(phone)!;
                const pyTime = state.python?.time || 99999;
                const goTime = state.go?.time || 99999;
                const winner = goTime < pyTime ? 'Go' : 'Python';

                results.push({
                    vuId: `VU-${vuId}`,
                    scenario: scenario.name,
                    pythonTime: state.python ? `${pyTime}ms` : 'TIMEOUT',
                    goTime: state.go ? `${goTime}ms` : 'TIMEOUT',
                    winner: winner,
                    goResponse: state.go?.text.substring(0, 40) + '...' || 'N/A'
                });
                console.log(chalk.green(`[VU-${vuId}] ✅ Finalizado em ${goTime}ms (Winner: ${winner})`));
                resolve();
            }
        });
        (pendingResponses.get(phone) as any).startTime = vuStartTime;

        const payload = {
            event: 'onmessage',
            session: SESSION_NAME,
            token: TEST_TOKEN,
            from: `${phone}@c.us`,
            chatId: `${phone}@c.us`,
            isGroupMsg: false,
            type: 'chat',
            body: scenario.text,
            sender: { name: `VU ${vuId}`, pushname: `User ${vuId}` }
        };

        const config = { headers: { 'Authorization': `Bearer ${TEST_TOKEN}` } };

        axios.post(`${PYTHON_BOT_URL}/webhook`, payload, config).catch(() => {});
        axios.post(`${GO_BOT_URL}/webhook`, payload, config).catch(() => {});

        // Safety timeout
        setTimeout(() => {
            if (pendingResponses.has(phone)) {
                // console.log(chalk.red(`[VU-${vuId}] ❌ Timeout`));
                pendingResponses.get(phone)?.resolver();
            }
        }, 30000);
    });
}

async function waitForBot(url: string, name: string) {
    let attempts = 0;
    while (attempts < 30) {
        try {
            await axios.get(url, { timeout: 2000, validateStatus: () => true });
            return true;
        } catch (e) {
            attempts++;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    return false;
}

async function main() {
    console.log(chalk.bold.cyan('\n🚀 INICIANDO STRESS TEST CONCORRENTE (v0.12.0)\n'));

    const pyReady = await waitForBot(PYTHON_BOT_URL, 'Python');
    const goReady = await waitForBot(GO_BOT_URL, 'Go');

    if (!pyReady || !goReady) {
        console.error(chalk.red('❌ Bots não estão prontos. Abortando.'));
        process.exit(1);
    }

    const VU_COUNT = 8;
    console.log(chalk.gray(`Simulando ${VU_COUNT} usuários simultâneos...\n`));

    const vus = [];
    for (let i = 1; i <= VU_COUNT; i++) {
        vus.push(runVU(i));
    }

    await Promise.all(vus);

    console.log(chalk.bold.cyan('\n📊 RELATÓRIO DE CARRA / CONCORRÊNCIA\n'));
    console.table(results.sort((a, b) => a.vuId.localeCompare(b.vuId)));

    process.exit(0);
}

app.listen(PORT, () => {
    console.log(chalk.magenta(`📡 Mock Server rodando na porta ${PORT}`));
    main();
});
