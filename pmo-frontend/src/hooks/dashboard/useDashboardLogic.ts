import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  dashboardService,
  supabase,
  HarvestSummary,
} from "../../services/dashboardService";
import { getCurrentWeather, WeatherData } from "../../services/weatherService";
import { fetchDashboardPmoDetails } from "../../services/pmoService";

// Tipos do Estado do Dashboard
export interface DashboardData {
  weather: WeatherData | null;
  harvestStats: HarvestSummary;
  lastActivity: Date | null;
  recentActivities: any[];
  pmoId: string | null;
  pmoName: string | null;
  pmoVersion: number | null;
  userProfile: { telefone?: string } | null;
  whatsappStatus: {
    status: string;
    last_heartbeat: string | null;
    details: any;
  } | null;
}

export function useDashboardLogic() {
  const { user, currentPropriedade, profile } = useAuth();
  const hasFetchedDashboardRef = useRef<string | null>(null);

  // Estado Combinado
  const [data, setData] = useState<DashboardData>({
    weather: null,
    harvestStats: {},
    lastActivity: null,
    recentActivities: [],
    pmoId: null,
    pmoName: null,
    pmoVersion: null,
    userProfile: null,
    whatsappStatus: null,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setDataError(null);

    try {
      const userTelefone = profile?.telefone;
      const pmoId = profile?.pmo_ativo_id;

      let pmoName: string | null = null;
      let pmoVersion: number = 0;
      let harvestStats: HarvestSummary = {};
      let lastActivity: Date | null = null;
      let recentActivities: any[] = [];

      // 1. Carregar dados do PMO (se existir) ou Propriedade
      if (pmoId || currentPropriedade?.id) {
        const [pmoResult, recentRes, harvestRes, lastActRes] = await Promise.all([
          pmoId ? fetchDashboardPmoDetails(pmoId) : Promise.resolve({ success: false, data: undefined }),
          dashboardService.fetchRecentActivities(pmoId || '', 5, currentPropriedade?.id),
          dashboardService.fetchHarvestSummary(pmoId || '', currentPropriedade?.id),
          dashboardService.fetchLastActivity(pmoId || '', currentPropriedade?.id)
        ]);

        if (pmoResult.success && pmoResult.data) {
          pmoName = pmoResult.data.nome_identificador;
          pmoVersion = Number(pmoResult.data.version) || 0;
        }

        recentActivities = recentRes;
        harvestStats = harvestRes;
        lastActivity = lastActRes;
      }

      // 2. Clima
      if (pmoId) {
        const loadWeatherAsync = async (id: string) => {
          try {
            const weather = await getCurrentWeather(id);
            setData((prev) => ({ ...prev, weather }));
          } catch (e) {
            console.warn("DashboardLogic: Weather fetch failed", e);
          }
        };
        loadWeatherAsync(pmoId);
      }

      // 3. Update State
      setData((prev) => ({
        ...prev,
        harvestStats,
        lastActivity,
        recentActivities,
        pmoId: pmoId || null,
        pmoName: pmoName || currentPropriedade?.nome || "Minha Propriedade",
        pmoVersion: pmoVersion,
        userProfile: { telefone: userTelefone },
      }));
    } catch (err: any) {
      console.error("Erro no Dashboard:", err);
      setDataError(err.message || "Falha ao carregar dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, profile, currentPropriedade]);

  // Status do WhatsApp em Tempo Real
  useEffect(() => {
    if (!user?.id) return;

    const fetchBotStatus = async () => {
      const { data: botStatus } = await supabase
        .from('bot_status')
        .select('*')
        .eq('session_name', 'agro_vivo')
        .maybeSingle();
      
      if (botStatus) {
        setData(prev => ({ ...prev, whatsappStatus: botStatus }));
      }
    };

    fetchBotStatus();

    const channel = supabase
      .channel('bot-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_status',
          filter: `session_name=eq.agro_vivo`,
        },
        (payload) => {
          setData(prev => ({ ...prev, whatsappStatus: payload.new as any }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const targetId = currentPropriedade?.id || profile?.pmo_ativo_id || "NONE";
    if (hasFetchedDashboardRef.current !== String(targetId) && user?.id) {
      hasFetchedDashboardRef.current = String(targetId);
      refreshDashboard();
    }
  }, [user?.id, profile?.pmo_ativo_id, currentPropriedade?.id, refreshDashboard]);

  return {
    ...data,
    isLoading,
    dataError,
    refreshDashboard,
  };
}
