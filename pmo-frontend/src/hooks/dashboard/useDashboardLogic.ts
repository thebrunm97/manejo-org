import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  dashboardService,
  HarvestSummary,
} from "../../services/dashboardService";
import { getCurrentWeather, WeatherData } from "../../services/weatherService";
import { fetchUserProfile, fetchDashboardPmoDetails } from "../../services/pmoService";
import { supabase } from "../../supabaseClient";

console.log("[useDashboardLogic] Imported supabase:", supabase);

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
const DEFAULT_LON = -48.25088;

export function useDashboardLogic() {
  const { user, profile } = useAuth();
  const hasFetchedDashboardRef = useRef<string | null>(null);

  // Estado Combinado
  const [data, setData] = useState<DashboardData>({
    weather: null,
    harvestStats: {},
    lastActivity: null,
    recentActivities: [], // Init empty
    pmoId: null,
    pmoName: null,
    pmoVersion: null,
    userProfile: null,
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
          console.warn("Geolocalização negada ou falhou, usando padrão.", err);
          resolve({ lat: DEFAULT_LAT, lng: DEFAULT_LON });
        },
        { timeout: 5000 }, // Timeout curto para não travar o load
      );
    });
  };



  const refreshDashboard = useCallback(async () => {
    if (!user?.id) {
      console.log("DashboardLogic: Skipping load, no user ID.");
      return;
    }

    console.log("DashboardLogic: Starting refreshDashboard for user:", user.id);
    setIsLoading(true);
    setDataError(null);

    try {
      // FIRE AND FORGET WEATHER FETCH: does not block the main dashboard load
      const loadWeatherAsync = async () => {
        try {
          console.log("DashboardLogic: Requesting Coordinates (Background)...");
          const coords = await getCoordinates();
          console.log("DashboardLogic: Requesting Weather (Background)...");
          const weather = await getCurrentWeather(coords.lat, coords.lng);
          setData((prev) => ({ ...prev, weather }));
        } catch (e) {
          console.warn("DashboardLogic: Weather fetch failed silently", e);
        }
      };
      loadWeatherAsync();

      // Passo 1: O Perfil já foi injetado pelo AuthContext
      const userTelefone = profile?.telefone;

      let pmoId: string | null = null;
      let pmoName: string | null = null;
      let pmoVersion: number = 0;
      let harvestStats: HarvestSummary = {};
      let lastActivity: Date | null = null;
      let recentActivities: any[] = [];

      if (profile?.pmo_ativo_id) {
        console.log("DashboardLogic: Step 3.2 - Fetching Active PMO Data (Parallelizing)...");
        pmoId = profile.pmo_ativo_id;

        const [pmoResult, recentRes, harvestRes, lastActRes] = await Promise.all([
          fetchDashboardPmoDetails(pmoId),
          dashboardService.fetchRecentActivities(pmoId, 5),
          dashboardService.fetchHarvestSummary(pmoId),
          dashboardService.fetchLastActivity(pmoId)
        ]);

        if (pmoResult.success && pmoResult.data) {
          pmoName = pmoResult.data.nome_identificador;
          pmoVersion = Number(pmoResult.data.version) || 0;
        }

        recentActivities = recentRes;
        harvestStats = harvestRes;
        lastActivity = lastActRes;
      }

      console.log("DashboardLogic: Data fetch complete. Processing...");

      // Montar objeto final (Weather continua com o valor atual até a promise resolver)
      setData((prev) => ({
        ...prev,
        harvestStats,
        lastActivity,
        recentActivities,
        pmoId: pmoId,
        pmoName: pmoName,
        pmoVersion: pmoVersion,
        userProfile: { telefone: userTelefone },
      }));
    } catch (err: any) {
      console.error("Erro no Dashboard (Manual Flow):", err);
      setDataError(err.message || "Falha ao carregar dashboard.");
    } finally {
      console.log("DashboardLogic: Finished. Setting isLoading=false");
      setIsLoading(false);
    }
  }, [user?.id, profile?.pmo_ativo_id, profile?.telefone]);

  // Initial Load & React Loop Shield
  useEffect(() => {
    const targetId = profile?.pmo_ativo_id || "NONE";

    // Impede loop infinito barrando execuções secundárias para o mesmo Alvo
    if (hasFetchedDashboardRef.current !== targetId && user?.id) {
      hasFetchedDashboardRef.current = targetId;
      refreshDashboard();
    }
  }, [user?.id, profile?.pmo_ativo_id, refreshDashboard]);

  return {
    ...data,
    isLoading,
    dataError,
    refreshDashboard,
  };
}
