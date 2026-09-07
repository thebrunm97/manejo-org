import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

// ==========================================================================
// Benchmark: impacto do <link rel="preconnect"> para Google Fonts
// --------------------------------------------------------------------------
// Mede, em um contexto de navegador LIMPO (sem cache), o tempo de início
// da conexão (DNS+TLS) com fonts.googleapis.com / fonts.gstatic.com e as
// métricas de renderização (FCP/LCP) da LandingPage pública.
//
// A lógica alterna a presença dos preconnects no dist/index.html SERVED,
// comparando "with-preconnect" vs "without-preconnect" no MESMO build.
//
// Uso:
//   node scripts/benchmark-preconnect.mjs
//   (requer: dist/ já gerado via `npm run build`)
// ==========================================================================

const REPO_ROOT = resolve(process.cwd());
const DIST_HTML = join(REPO_ROOT, 'dist', 'index.html');
const PORT = 5174;
const BASE_URL = `http://localhost:${PORT}`;
const RUNS = Number(process.env.RUNS || 5);

const PRECONNECT_HTML = `  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;

const FONT_ORIGINS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

function log(msg) {
    console.log(`[benchmark] ${msg}`);
}

function htmlHasPreconnect(html) {
    return html.includes('rel="preconnect" href="https://fonts.googleapis.com"');
}

function setPreconnect(html, enabled) {
    // remove qualquer preconnect existente das fontes
    const cleaned = html
        .replace(/  <link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n/g, '')
        .replace(/  <link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n/g, '');
    if (!enabled) return cleaned;
    // insere após o favicon
    return cleaned.replace(
        '  <link rel="icon" type="image/svg+xml" href="/vite.svg" />',
        '  <link rel="icon" type="image/svg+xml" href="/vite.svg" />\n\n' + PRECONNECT_HTML
    );
}

function round(v) {
    return v == null ? '-' : Math.round(v);
}

function mean(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatLatency(label, withArr, withoutArr) {
    const w = mean(withArr);
    const o = mean(withoutArr);
    const pct = w != null && o != null && o !== 0 ? ((w - o) / o) * 100 : null;
    console.log(`\n  ${label}:`);
    console.log(`    with-preconnect    : ${round(w)} ms   (runs: ${withArr.map(round).join(', ')})`);
    console.log(`    without-preconnect : ${round(o)} ms   (runs: ${withoutArr.map(round).join(', ')})`);
    console.log(`    delta              : ${pct == null ? '-' : (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%'}`);
}

function waitForServer(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const t = setInterval(async () => {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    clearInterval(t);
                    resolve();
                }
            } catch { /* not ready */ }
            if (Date.now() - start > timeoutMs) {
                clearInterval(t);
                reject(new Error('Servidor não respondeu a tempo'));
            }
        }, 500);
    });
}

async function serve() {
    const viteJs = join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const proc = spawn(process.execPath, [viteJs, 'preview', '--port', String(PORT), '--strictPort'], {
        cwd: REPO_ROOT,
        stdio: 'ignore',
    });
    await waitForServer(BASE_URL, 60000);
    return proc;
}

async function runScenario(browser, withPreconnect) {
    const results = [];
    // Bloqueia recursos não essenciais para isolar a medição de renderização
    // (mantém fontes e CSS, bloqueia imagens/fontes de terceiros não usados)
    for (let i = 0; i < RUNS; i++) {
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
        });
        // Sem cache compartilhado entre contextos: cada contexto é limpo
        const page = await context.newPage();
        // Throttling leve p/ evidenciar custo de DNS/TLS
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 40,
            downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
            uploadThroughput: (750 * 1024) / 8,
        });
        await cdp.send('Network.enable');

        // Observa o LCP durante o carregamento (dispara antes do load)
        await page.addInitScript(() => {
            window.__lcp = null;
            try {
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const last = entries[entries.length - 1];
                    if (last && last.startTime != null) window.__lcp = last.startTime;
                }).observe({ type: 'largest-contentful-paint', buffered: true });
            } catch {}
        });

        await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60000 });
        // aguarda FCP/LCP estabilizarem
        await page.waitForTimeout(3000);

        const data = await page.evaluate((origins) => {
            // LCP (do observer)
            const lcp = window.__lcp ?? null;
            // FCP via paint API
            let fcp = null;
            try {
                const paint = performance.getEntriesByType('paint');
                const f = paint.find((p) => p.name === 'first-contentful-paint');
                if (f) fcp = f.startTime;
            } catch {}

            // Timing de conexão das fontes (ResourceTiming)
            const fontConns = {};
            for (const res of performance.getEntriesByType('resource')) {
                const url = res.name;
                let host = new URL(url).host;
                if (/googleapis\.com$/.test(host)) host = 'fonts.googleapis.com';
                else if (/(^|\.)gstatic\.com$/.test(host)) host = 'fonts.gstatic.com';
                else continue;
                const conTime = res.connectStart >= 0 ? res.connectEnd - res.connectStart : null;
                const reqStart = res.requestStart >= 0 ? res.requestStart : null;
                if (!fontConns[host]) fontConns[host] = [];
                fontConns[host].push({
                    conn: conTime,
                    requestStart: reqStart,
                    transferSize: res.transferSize ?? 0,
                    initiatorType: res.initiatorType,
                });
            }
            return { lcp, fcp, fontConns };
        }, FONT_ORIGINS);

        results.push(data);
        const ctx = { lcp: data.lcp, fcp: data.fcp, fontConns: data.fontConns };
        await context.close();
    }

    // agrega
    const first = (r, host) => (r.fontConns[host] && r.fontConns[host].length ? r.fontConns[host][0] : null);
    const agg = {
        lcp: results.map((r) => r.lcp).filter((v) => v != null),
        fcp: results.map((r) => r.fcp).filter((v) => v != null),
        connGoogleApis: results.map((r) => first(r, 'fonts.googleapis.com')?.conn).filter((v) => v != null),
        connGstatic: results.map((r) => first(r, 'fonts.gstatic.com')?.conn).filter((v) => v != null),
        requestStartGoogleApis: results.map((r) => first(r, 'fonts.googleapis.com')?.requestStart).filter((v) => v != null),
        requestStartGstatic: results.map((r) => first(r, 'fonts.gstatic.com')?.requestStart).filter((v) => v != null),
        transferGstatic: results.map((r) => {
            const list = r.fontConns['fonts.gstatic.com'];
            return list ? list.reduce((a, x) => a + (x.transferSize || 0), 0) : 0;
        }),
        gstaticSeen: results.filter((r) => r.fontConns['fonts.gstatic.com']?.length).length,
        initiator: results.map((r) => first(r, 'fonts.googleapis.com')?.initiatorType).find((v) => v != null),
    };
    return agg;
}

async function main() {
    if (!existsSync(DIST_HTML)) {
        console.error('dist/index.html não encontrado. Rode `npm run build` primeiro.');
        process.exit(1);
    }
    if (RUNS < 1 || RUNS > 20) {
        console.error('RUNS deve estar entre 1 e 20.');
        process.exit(1);
    }

    const original = readFileSync(DIST_HTML, 'utf8');
    log(`dist/index.html encontrado (preconnect presente: ${htmlHasPreconnect(original)})`);
    log(`Rodando ${RUNS} execuções por cenário na porta ${PORT}...`);

    const proc = await serve();
    log('Servidor preview iniciado.');

    const browser = await chromium.launch({ channel: 'chrome' });

    try {
        // Cenário 1: SEM preconnect
        writeFileSync(DIST_HTML, setPreconnect(original, false));
        log('Cenário: WITHOUT preconnect');
        const without = await runScenario(browser, false);

        // Cenário 2: COM preconnect
        writeFileSync(DIST_HTML, setPreconnect(original, true));
        log('Cenário: WITH preconnect');
        const withPC = await runScenario(browser, true);

        // ---- Relatório ----
        console.log('\n================ RELATÓRIO ================\n');
        console.log(`Execuções por cenário: ${RUNS}`);
        formatLatency('LCP (largest contentful paint)', withPC.lcp, without.lcp);
        formatLatency('FCP (first contentful paint)', withPC.fcp, without.fcp);
        console.log('\nTiming de CONEXÃO (DNS+TCP+TLS) com origens de fonte:');
        formatLatency('  fonts.googleapis.com (CSS)'   , withPC.connGoogleApis, without.connGoogleApis);
        formatLatency('  fonts.gstatic.com (woff2)'    , withPC.connGstatic, without.connGstatic);
        console.log('\nTiming de REQUEST START (quando a req começa, relativo ao nav):');
        formatLatency('  fonts.googleapis.com (CSS)'   , withPC.requestStartGoogleApis, without.requestStartGoogleApis);
        formatLatency('  fonts.gstatic.com (woff2)'    , withPC.requestStartGstatic, without.requestStartGstatic);
        console.log('\nDiagnóstico das fontes (fonts.gstatic.com/woff2):');
        console.log(`  runs com gstatic detectado  : with=${withPC.gstaticSeen}/${RUNS}  without=${without.gstaticSeen}/${RUNS}`);
        console.log(`  bytes transferidos (média)  : with=${Math.round(mean(withPC.transferGstatic) || 0)}  without=${Math.round(mean(without.transferGstatic) || 0)}`);
        console.log(`  initiatorType (CSS fonte)   : with=${withPC.initiator ?? '-'}  without=${without.initiator ?? '-'}`);
        console.log('\n==============================================');
    } finally {
        writeFileSync(DIST_HTML, original);
        await browser.close();
        proc.kill();
        log('Limpeza concluída. dist/index.html restaurado ao estado original.');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
