import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  dashboardService,
  HarvestSummary,
} from "../../services/dashboardService";
import { getCurrentWeather, WeatherData } from "../../services/weatherService";
import { fetchAllPmos } from "../../services/pmoService";
import { supabase } from "../../supabaseClient";

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
      
      let activePmoId: string | null = profile?.pmo_ativo_id || null;
      let pmoName: string | null = null;
      let pmoVersion: number = 0;
      let harvestStats: HarvestSummary = {};
      let lastActivity: Date | null = null;
      let recentActivities: any[] = [];

      // 1. Carregar PMOs da propriedade para definir o PMO ativo REAL da fazenda selecionada
      if (currentPropriedade?.id) {
        const pmosRes = await fetchAllPmos(currentPropriedade.id);
        if (pmosRes.success && pmosRes.data && pmosRes.data.length > 0) {
          const emAndamento = pmosRes.data.find(p => (p as any).status === 'Em andamento' || (p as any).status === 'em_andamento') || pmosRes.data[0];
          activePmoId = emAndamento.id;
          pmoName = emAndamento.nome_identificador;
          pmoVersion = Number(emAndamento.version) || 1;
        } else {
          activePmoId = null; // sem PMO na propriedade atual
        }
      }

      // Buscar as estatísticas com o PMO / Propriedade correto
      if (activePmoId || currentPropriedade?.id) {
        const [recentRes, harvestRes, lastActRes] = await Promise.all([
          dashboardService.fetchRecentActivities(null, 5, currentPropriedade?.id),
          dashboardService.fetchHarvestSummary(null, currentPropriedade?.id),
          dashboardService.fetchLastActivity(null, currentPropriedade?.id)
        ]);

        recentActivities = recentRes;
        harvestStats = harvestRes;
        lastActivity = lastActRes;
      }

      // 2. Clima
      if (activePmoId) {
        const loadWeatherAsync = async (id: string) => {
          try {
            const weather = await getCurrentWeather(id);
            setData((prev) => ({ ...prev, weather }));
          } catch (e) {
            console.warn("DashboardLogic: Weather fetch failed", e);
          }
        };
        loadWeatherAsync(activePmoId);
      }

      // 3. Update State
      setData((prev) => ({
        ...prev,
        harvestStats,
        lastActivity,
        recentActivities,
        pmoId: activePmoId,
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
        .eq('session_name', import.meta.env.VITE_BOT_SESSION_NAME || 'manejo-org')
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
          filter: `session_name=eq.${import.meta.env.VITE_BOT_SESSION_NAME || 'manejo-org'}`,
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
