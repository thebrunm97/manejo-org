import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService, HarvestSummary } from '../../services/dashboardService';
import { getCurrentWeather, WeatherData } from '../../services/weatherService';
import { fetchUserProfile, fetchPmoById } from '../../services/pmoService';
import { supabase } from '../../supabaseClient';

console.log('[useDashboardLogic] Imported supabase:', supabase);



// Tipos do Estado do Dashboard
export interface DashboardData {
    weather: WeatherData | null;
    harvestStats: HarvestSummary;
    lastActivity: Date | null;
    recentActivities: any[]; // Adicionado: Lista de atividades
    pmoId: string | null;
    pmoName: string | null;
    pmoVersion: number | null;
    userProfile: { telefone?: string } | null;
}

// Coordenadas padrão (Araguari, MG) - Fallback
const DEFAULT_LAT = -18.900582;
const DEFAULT_LON = -48.250880;

export function useDashboardLogic() {
    const { user } = useAuth();

    // Estado Combinado
    const [data, setData] = useState<DashboardData>({
        weather: null,
        harvestStats: {},
        lastActivity: null,
        recentActivities: [], // Init empty
        pmoId: null,
        pmoName: null,
        pmoVersion: null,
        userProfile: null
    });

    const [isLoading, setIsLoading] = useState(true);
    const [dataError, setDataError] = useState<string | null>(null);

    // Função auxiliar para obter localização (Promise-based)
    const getCoordinates = () => {
        return new Promise<{ lat: number; lng: number }>((resolve) => {
            if (!navigator.geolocation) {
                resolve({ lat: DEFAULT_LAT, lng: DEFAULT_LON });
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                },
                (err) => {
                    console.warn('Geolocalização negada ou falhou, usando padrão.', err);
                    resolve({ lat: DEFAULT_LAT, lng: DEFAULT_LON });
                },
                { timeout: 5000 } // Timeout curto para não travar o load
            );
        });
    };

    const loadDashboardData = useCallback(async () => {
        if (!user) return;

        setIsLoading(true);
        setDataError(null);

        try {
            // Check Supabase init
            if (!supabase) {
                throw new Error('Supabase Client IS UNDEFINED. Check initialization.');
            }

            // 1. Identificar Usuário e PMO Ativo
            // Buscamos o perfil primeiro para saber qual PMO carregar
            const profileResult = await fetchUserProfile(user.id);
            if (!profileResult.success || !profileResult.data) {
                throw new Error(profileResult.error || 'Não foi possível carregar o perfil.');
            }

            const profile = profileResult.data;
            const pmoDetails = { id: null as string | null, nome: null as string | null, version: null as number | null };

            if (profile.pmo_ativo_id) {
                pmoDetails.id = profile.pmo_ativo_id;
                // Carregar detalhes básicos do PMO
                const pmoResult = await fetchPmoById(profile.pmo_ativo_id);
                if (pmoResult.success && pmoResult.data) {
                    pmoDetails.nome = pmoResult.data.nome_identificador;
                    pmoDetails.version = Number(pmoResult.data.version) || 0;
                }
            }

            // 2. Carregamento Paralelo (Core Data)
            // Weather pode rodar independente do PMO
            // Harvest e Activity dependem do PMO (se houver)

            const activePmoId = pmoDetails.id || '';

            const [coords, weatherData, harvestStats, lastActivity] = await Promise.all([
                getCoordinates(), // Resolve rápido
                (async () => {
                    const c = await getCoordinates(); // Chamada redundante mas ok, ou poderíamos encadear. 
                    // Melhor estratégia: pegar coord antes. Vamos ajustar.
                    return getCurrentWeather(c.lat, c.lng);
                })(),
                // Nota: O weather acima espera a promise de coords. 
                // Vamos refazer a estrutura do Promise.all para ser mais limpa abaixo.

                dashboardService.fetchHarvestSummary(activePmoId),
                dashboardService.fetchLastActivity(activePmoId)
            ]);

            // Correção da lógica paralela acima:
            // O weather depende de coords. Então não dá pra paralelizar TOTALMENTE tudo no nível raiz bruta
            // A menos que usemos .then().

            // Vamos refazer o bloco paralelo real:

            /*
            const coordsPromise = getCoordinates();
            const weatherPromise = coordsPromise.then(c => getCurrentWeather(c.lat, c.lng));
            const harvestPromise = dashboardService.fetchHarvestSummary(activePmoId);
            const activityPromise = dashboardService.fetchLastActivity(activePmoId);
            
            const [weather, harvest, activity] = await Promise.all([weatherPromise, harvestPromise, activityPromise]);
            */

            // No entanto, para simplicidade do código e como coords é local/rápido ou timeout, vamos fazer sequencial o coords e paralelo o resto.
        } catch (err: any) {
            // Placeholder catch, lógica real abaixo
        }

    }, [user]);

    const refreshDashboard = useCallback(async () => {
        if (!user?.id) {
            console.log('DashboardLogic: Skipping load, no user ID.');
            return;
        }

        console.log('DashboardLogic: Starting refreshDashboard for user:', user.id);
        setIsLoading(true);
        setDataError(null);

        try {
            // Passo 1: Busca Coordenadas (latência local/baixa)
            console.log('DashboardLogic: Requesting Coordinates...');
            const coords = await getCoordinates();
            console.log('DashboardLogic: Coordinates received:', coords);

            // Passo 2: Busca Weather (independente)
            console.log('DashboardLogic: Requesting Weather...');
            const weather = await getCurrentWeather(coords.lat, coords.lng);
            console.log('DashboardLogic: Weather received:', weather ? 'OK' : 'NULL');

            // Passo 3: Busca Dados do Banco (SEQUENCIAL / MANUAL FETCH)
            // Evita deadlock de RLS e queries muito pesadas
            console.log('DashboardLogic: Step 3 - Fetching Profile separately...');

            // 3.1 Busca Perfil
            const profileResult = await fetchUserProfile(user.id);
            if (!profileResult.success || !profileResult.data) {
                throw new Error(profileResult.error || 'Perfil não encontrado.');
            }
            const profile = profileResult.data;
            const userTelefone = profile.telefone;

            let activePmo: any = null;
            let pmoId: string | null = null;
            let pmoName: string | null = null;
            let pmoVersion: number = 0;
            let cadernoCampo: any[] = [];

            // 3.2 Busca PMO se houver
            if (profile.pmo_ativo_id) {
                console.log('DashboardLogic: Step 3.2 - Fetching Active PMO...');
                const pmoResult = await fetchPmoById(profile.pmo_ativo_id);
                if (pmoResult.success && pmoResult.data) {
                    activePmo = pmoResult.data;
                    pmoId = activePmo.id;
                    pmoName = activePmo.nome_identificador;
                    pmoVersion = Number(activePmo.version) || 0;

                    // 3.3 Busca Caderno de Campo (Recentes)
                    console.log('DashboardLogic: Step 3.3 - Fetching Activities...');
                    // Usando service direto para evitar complexidade
                    const { data: ccData, error: ccError } = await supabase
                        .from('caderno_campo')
                        .select('*')
                        .eq('pmo_id', pmoId)
                        .order('data_registro', { ascending: false })
                        .limit(50);

                    if (!ccError && ccData) {
                        cadernoCampo = ccData;
                    }
                }
            }

            console.log('DashboardLogic: Data fetch complete. Processing...');

            // Processamento Client-side
            // 1. Resumo de Colheita
            const harvestStats: HarvestSummary = cadernoCampo
                .filter((i: any) => i.tipo_atividade === 'Colheita' && i.tipo_atividade !== 'CANCELADO')
                .reduce((acc: HarvestSummary, item: any) => {
                    const prod = item.produto || 'NÃO IDENTIFICADO';
                    const qtd = parseFloat(String(item.quantidade_valor || 0));
                    if (!acc[prod]) {
                        acc[prod] = { produto: prod, total: 0, unidade: item.quantidade_unidade };
                    }
                    acc[prod].total += qtd;
                    return acc;
                }, {});

            // 2. Última Atividade e Recentes
            const sortedActivities = [...cadernoCampo].sort((a: any, b: any) =>
                new Date(b.created_em || b.data_registro).getTime() - new Date(a.created_em || a.data_registro).getTime()
            );

            const lastActivity = sortedActivities.length > 0 ? new Date(sortedActivities[0].created_em || sortedActivities[0].data_registro) : null;

            const recentActivities = sortedActivities.slice(0, 5).map((item: any) => ({
                id: item.id,
                tipo: item.tipo_atividade,
                descricao: `${item.tipo_atividade}${item.talhao_canteiro ? ' • ' + item.talhao_canteiro : ''}`,
                data: item.data_registro,
                raw: item,
                produto: item.produto,
                talhao_canteiro: item.talhao_canteiro,
                data_registro: item.data_registro
            }));

            // Montar objeto final
            setData({
                weather,
                harvestStats,
                lastActivity,
                recentActivities,
                pmoId: pmoId,
                pmoName: pmoName,
                pmoVersion: pmoVersion,
                userProfile: { telefone: userTelefone }
            });

        } catch (err: any) {
            console.error('Erro no Dashboard (Manual Flow):', err);
            setDataError(err.message || 'Falha ao carregar dashboard.');
        } finally {
            console.log('DashboardLogic: Finished. Setting isLoading=false');
            setIsLoading(false);
        }
    }, [user?.id]); // ✅ Dependência correta (apenas user.id)

    // Initial Load
    useEffect(() => {
        refreshDashboard();
    }, [refreshDashboard]);

    return {
        ...data,
        isLoading,
        dataError,
        refreshDashboard
    };
}
