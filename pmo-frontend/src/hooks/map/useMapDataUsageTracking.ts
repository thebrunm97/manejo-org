import { useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';

/**
 * Mede o consumo de dados de rede durante uma sessão de mapa, via
 * PerformanceObserver do browser — captura toda requisição de rede feita
 * enquanto o mapa está montado (tiles base do Mapbox, tiles de satélite,
 * qualquer fonte), sem precisar conhecer os hosts de antemão.
 *
 * POR QUE ISTO EXISTE
 *
 * O backlog de internacionalização (Moçambique/África Oriental,
 * TECHNICAL_DEBT.md) marcou "consumo de dados do mapa" como importante de
 * medir antes de decidir qualquer otimização — mudar qualidade/zoom de tile
 * sem dado real arriscaria piorar a experiência de todo mundo, não só de
 * quem tem internet fraca. Este hook só MEDE; não muda nenhum comportamento
 * do mapa.
 *
 * COMO FUNCIONA
 *
 * PerformanceObserver (não performance.getEntriesByType lido só no fim) para
 * não perder entradas se o buffer do browser estourar em sessões longas.
 * `transferSize` já vem 0 para respostas servidas do cache do browser — o
 * que é exatamente o dado certo pra "quanto isto pesou na rede de verdade".
 * Reporta para o Sentry (já configurado no projeto, ver main.tsx) em três
 * gatilhos: desmontagem do mapa, troca de aba/navegação (`pagehide`, que
 * dispara mais confiável que `unmount` quando o usuário só fecha a aba), e
 * periodicamente a cada 2 minutos como rede de segurança para sessões
 * muito longas.
 */
export function useMapDataUsageTracking(mapId: string = 'farm-map') {
    const totalBytesRef = useRef(0);
    const porHostRef = useRef<Record<string, number>>({});
    const requestCountRef = useRef(0);

    useEffect(() => {
        if (typeof PerformanceObserver === 'undefined') return;

        const registrarEntrada = (entry: PerformanceResourceTiming) => {
            const bytes = entry.transferSize || 0;
            totalBytesRef.current += bytes;
            requestCountRef.current += 1;
            try {
                const host = new URL(entry.name).hostname;
                porHostRef.current[host] = (porHostRef.current[host] || 0) + bytes;
            } catch {
                // URL relativa ou malformada: ainda soma no total, só não categoriza por host.
            }
        };

        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
                registrarEntrada(entry);
            }
        });
        observer.observe({ type: 'resource', buffered: true });

        const flush = (motivo: string) => {
            if (requestCountRef.current === 0) return;
            const totalKB = Math.round((totalBytesRef.current / 1024) * 10) / 10;
            Sentry.captureMessage('map_data_usage', {
                level: 'info',
                tags: { map_id: mapId, flush_reason: motivo },
                extra: {
                    total_kb: totalKB,
                    request_count: requestCountRef.current,
                    por_host_kb: Object.fromEntries(
                        Object.entries(porHostRef.current).map(([host, b]) => [host, Math.round((b / 1024) * 10) / 10])
                    ),
                },
            });
        };

        const intervalo = setInterval(() => flush('intervalo_2min'), 2 * 60 * 1000);
        const onPageHide = () => flush('pagehide');
        window.addEventListener('pagehide', onPageHide);

        return () => {
            observer.disconnect();
            clearInterval(intervalo);
            window.removeEventListener('pagehide', onPageHide);
            flush('unmount');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapId]);
}
