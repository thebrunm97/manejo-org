// src/pages/DashboardPage.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ProductTour } from "../components/Common/ProductTour";
import ProfileIncompleteAlert from "../components/Common/ProfileIncompleteAlert";
import { useAuth } from "../context/AuthContext";

import HarvestDashboard from "../components/Dashboard/HarvestDashboard";
import PlanoAtualCard from "../components/Dashboard/PlanoAtualCard";
import ManualRecordDialog from "../components/Dashboard/ManualRecordDialog";
import WhatsappConnectDialog from "../components/Dashboard/WhatsappConnectDialog";


import {
  Plus,
  Settings,
  Smartphone,
  CloudSun,
  MapPin,
  CloudRain,
  Link,
  Unlink,
  Wind,
  CloudDrizzle,
} from "lucide-react";

import { useDashboardLogic } from "../hooks/dashboard/useDashboardLogic";
import { WeatherData } from "../services/weatherService";
import { unlinkWhatsapp } from "../services/whatsappService";
import {
  formatarTelefone,
  formatarDataRelativa,
  obterSaudacao,
} from "../utils/formatters";

// Weather Widget (Real integration via Supabase)
const WeatherWidget: React.FC<{
  weather: WeatherData | null;
  loading: boolean;
}> = ({ weather, loading }) => {
  if (loading) {
    return <div className="h-[220px] bg-slate-100 rounded-3xl animate-pulse col-span-1 xl:col-span-2 shadow-sm border border-slate-200" />;
  }

  if (!weather) {
    return (
      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-br flex flex-col items-start justify-center text-left from-slate-50 to-slate-100/50 border border-slate-200 shadow-sm h-full min-h-[220px] col-span-1 xl:col-span-2 group transition-all duration-300 hover:shadow-md">
        <div className="p-4 bg-white rounded-2xl shadow-sm text-cyan-500 mb-4 group-hover:-translate-y-1 transition-transform duration-300">
          <CloudSun size={32} />
        </div>
        <h4 className="text-base font-bold text-slate-700 mb-1.5 tracking-tight">
          Analisando Estação Meteorológica...
        </h4>
        <p className="text-xs text-slate-500 max-w-sm font-medium leading-relaxed">
          Nossos algoritmos aguardam a emissão do próximo relatório meteorológico focado nos seus arredores para calcular as taxas de pulverização exatas.
        </p>
      </div>
    );
  }

  const { current, forecast } = weather;
  const temp = Math.round(current.temperature);
  const humidity = current.humidity;
  const wind = current.windKph;
  const conditionIconUrl = current.conditionIcon;
  
  const todayForecast = forecast && forecast.length > 0 ? forecast[0] : null;
  const rainChance = todayForecast ? todayForecast.day.daily_chance_of_rain : 0;
  
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Real 3-day forecast data parsing
  const forecastList = (forecast || []).slice(0, 3).map((f: any, index: number) => {
    // Prevent timezone shifts by appending time
    const dateObj = new Date(f.date + "T12:00:00Z");
    let dayStr = diasSemana[dateObj.getDay()];
    if (index === 0) dayStr = "Hoje";
    else if (index === 1) dayStr = "Amanhã";

    const iconStr = f.day.condition.icon;
    const finalIcon = iconStr.startsWith('http') ? iconStr : `https:${iconStr}`;
    
    return {
      day: dayStr,
      min: Math.round(f.day.mintemp_c),
      max: Math.round(f.day.maxtemp_c),
      rain: f.day.daily_chance_of_rain > 0 ? `${f.day.daily_chance_of_rain}%` : null,
      iconUrl: finalIcon
    };
  });

  return (
    <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-br from-cyan-50 to-white border border-cyan-100 shadow-sm relative overflow-hidden flex flex-col xl:flex-row h-full min-h-[220px] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group">
      
      {/* Current Weather Left Side */}
      <div className="flex-1 flex flex-col justify-between pr-0 xl:pr-8 border-b xl:border-b-0 border-cyan-200/50 pb-6 xl:pb-0 mb-6 xl:mb-0 xl:border-r">
        <div className="flex justify-between items-start mb-6 xl:mb-2">
          <div>
            <h3 className="text-5xl lg:text-6xl font-black text-cyan-900 tracking-tighter">
              {temp}°<span className="text-3xl text-cyan-700/60 font-bold tracking-normal lg:ml-1">C</span>
            </h3>
            <div className="flex items-center gap-1.5 mt-2 lg:mt-3 text-cyan-700 font-semibold bg-cyan-100/50 w-fit px-2.5 py-1 rounded-lg">
              <MapPin size={14} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                LOCAL ATUAL
              </span>
            </div>
          </div>
          {conditionIconUrl ? (
            <img src={conditionIconUrl} alt="Clima Atual" className="w-16 h-16 object-contain drop-shadow-sm transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <CloudSun size={42} className="text-cyan-500 drop-shadow-sm transition-transform duration-500 group-hover:scale-110" />
          )}
        </div>
        
        <div className="flex items-center justify-between mt-auto">
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-cyan-700 mb-0.5">Umidade</span>
            <span className="text-base font-extrabold text-cyan-900">{humidity}%</span>
          </div>
          <div className="text-right">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-cyan-700 mb-0.5">Chuva {forecastList[0]?.day || "Hoje"}</span>
            <div className="flex items-center gap-1.5 justify-end">
              <CloudRain size={16} className={rainChance && rainChance > 50 ? "text-sky-600" : "text-cyan-500"} />
              <span className="text-base font-extrabold text-cyan-900">{rainChance}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Context Panel Right Side */}
      <div className="flex-1 flex flex-col justify-between pl-0 xl:pl-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-100/70 rounded-xl text-sky-600">
              <Wind size={20} />
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Vento (Pulverização)</span>
              <span className="text-base font-extrabold text-slate-800">{wind} km/h</span>
            </div>
          </div>
          {wind > 15 ? (
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 font-bold uppercase tracking-wider text-[10px] rounded-lg border border-amber-200/50">
              Atenção
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wider text-[10px] rounded-lg border border-emerald-200/50">
              Ideal
            </span>
          )}
        </div>
        
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Previsão 3 Dias</span>
          <div className="flex flex-col gap-2.5">
            {forecastList.map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white/60 border border-slate-100 shadow-sm px-3 py-2 rounded-xl hover:bg-white transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 flex justify-center">
                    <img src={f.iconUrl} alt="clima" className="w-8 h-8 object-contain" />
                  </div>
                  <span className="text-sm font-bold text-slate-700">{f.day}</span>
                </div>
                {f.rain ? (
                  <span className="font-extrabold text-sky-600 text-sm flex items-center gap-1">
                    <CloudDrizzle size={14} className="opacity-70" />
                    {f.rain}
                  </span>
                ) : (
                  <span className="font-extrabold text-slate-800 text-sm">
                    {f.max}° <span className="text-slate-400 font-semibold mx-0.5">/</span> <span className="text-slate-500">{f.min}°</span>
                  </span>
                )}
              </div>
            ))}
            
            {forecastList.length === 0 && (
              <div className="text-sm text-slate-400 font-medium py-2">
                Previsão indisponível no momento.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

const DashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [openRecordDialog, setOpenRecordDialog] = useState(false);
  const [openWhatsappDialog, setOpenWhatsappDialog] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any>(null);


  // Conectando o cérebro
  const {
    weather,
    harvestStats,
    lastActivity,
    recentActivities,
    pmoName,
    pmoVersion,
    userProfile,
    isLoading,
    dataError,
    refreshDashboard,
  } = useDashboardLogic();

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const saudacao = obterSaudacao();

  const getDisplayName = () => {
    if (profile?.nome) {
      const parts = profile.nome.trim().split(/\s+/);
      if (parts.length === 1) return parts[0];
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
    return user?.email?.split("@")[0] || "Produtor";
  };

  const displayName = getDisplayName();


  const isPageReady = !isLoading;

  return (
    <div className="pb-8 overflow-x-hidden">
      <ProfileIncompleteAlert show={!userProfile?.telefone} />
      <ProductTour ready={isPageReady} />
      <ManualRecordDialog
        key={recordToEdit?.id || "new-record"}
        open={openRecordDialog}
        recordToEdit={recordToEdit}
        onClose={() => setOpenRecordDialog(false)}
        onRecordSaved={refreshDashboard}
      />

      <WhatsappConnectDialog
        open={openWhatsappDialog}
        onClose={() => setOpenWhatsappDialog(false)}
        userId={user?.id || ""}
        onSuccess={refreshDashboard}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 mb-8 w-full max-w-full overflow-hidden">
        <div className="min-w-0 max-w-full break-words whitespace-normal flex-wrap">
          <h1
            id="tour-welcome"
            className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1 break-words"
          >
            {saudacao}, {displayName}!
          </h1>
          <p className="text-slate-500 text-base break-words">
            Resumo da produção em{" "}
            <span className="capitalize font-semibold text-slate-700">
              {hoje}
            </span>
            .
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => navigate("/planos")}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition-colors w-full sm:w-auto"
          >
            <Settings size={18} />
            Gerenciar Planos
          </button>
          <button
            onClick={() => {
              setRecordToEdit(null);
              setOpenRecordDialog(true);
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all w-full sm:w-auto hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus size={20} />
            Novo Registro
          </button>
        </div>
      </div>

      {dataError && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-bold mb-1">Erro no carregamento:</p>
          <p className="text-sm mb-2">{dataError}</p>
          <button
            onClick={refreshDashboard}
            className="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {isLoading ? (
        /* ---------------- SKELETON LOADER ---------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8 w-full min-w-0 animate-pulse">
          {/* Top Row Skeletons */}
          <div className="h-[220px] bg-white rounded-3xl border border-slate-100 shadow-sm p-6 w-full col-span-1">
            <div className="w-1/2 h-4 bg-slate-300 rounded mb-4"></div>
            <div className="w-3/4 h-6 bg-slate-300 rounded mb-6"></div>
            <div className="w-full h-8 bg-slate-300 rounded mt-auto"></div>
          </div>

          <div className="h-[220px] bg-white rounded-3xl border border-slate-100 shadow-sm p-6 w-full col-span-1 xl:col-span-2">
            <div className="w-1/3 h-8 bg-slate-300 rounded mb-4"></div>
            <div className="w-2/3 h-4 bg-slate-300 rounded mb-6"></div>
            <div className="w-full h-4 bg-slate-300 rounded mt-auto"></div>
          </div>

          <div className="h-[220px] bg-white rounded-3xl border border-slate-100 shadow-sm p-6 w-full col-span-1 md:col-span-2 xl:col-span-1">
            <div className="bg-slate-300 w-10 h-10 rounded-2xl mb-4"></div>
            <div className="w-2/3 h-5 bg-slate-300 rounded mb-6"></div>
            <div className="w-full h-10 bg-slate-300 rounded mt-auto"></div>
          </div>

          {/* Harvest Stats Skeleton */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 lg:p-8 shadow-sm min-h-[600px] w-full col-span-1 md:col-span-2 xl:col-span-2 flex flex-col">
            <div className="w-1/3 h-6 bg-slate-300 rounded mb-8"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              <div className="h-32 bg-slate-300 rounded-3xl"></div>
              <div className="h-32 bg-slate-300 rounded-3xl"></div>
              <div className="h-32 bg-slate-300 rounded-3xl"></div>
              <div className="h-32 hidden xl:block bg-slate-300 rounded-3xl"></div>
            </div>
            <div className="w-1/4 h-5 bg-slate-300 rounded mb-6 mt-8"></div>
            <div className="space-y-4">
              <div className="w-full h-20 bg-slate-300 rounded-2xl"></div>
              <div className="w-full h-20 bg-slate-300 rounded-2xl"></div>
              <div className="w-full h-20 bg-slate-300 rounded-2xl"></div>
              <div className="w-full h-20 bg-slate-300 rounded-2xl"></div>
            </div>
          </div>
        </div>
      ) : (
        /* ---------------- REAL DASHBOARD CONTENT ---------------- */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8 w-full min-w-0">
          
          {/* Top Row: Plano, Weather, Bot */}
          <div id="tour-pmo-card" className="col-span-1 h-full">
            <PlanoAtualCard
              nomePlano={pmoName}
              versao={pmoVersion || 1}
              status="Em andamento"
              onVer={() => navigate("/caderno")}
              onEditar={() => navigate("/planos")}
            />
          </div>

          <div className="col-span-1 xl:col-span-2 h-full">
            <WeatherWidget weather={weather} loading={false} />
          </div>

          <div id="tour-whatsapp-card" className="col-span-1 md:col-span-2 xl:col-span-1 self-start">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className={`p-2.5 rounded-2xl transition-colors ${userProfile?.telefone ? "bg-green-50 text-green-600" : "bg-slate-50 text-slate-500"}`}>
                    <Smartphone size={22} />
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${userProfile?.telefone ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                    {userProfile?.telefone ? "ATIVO" : "OFFLINE"}
                  </span>
                </div>
                <h4 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight mt-4">
                  Assistente de I.A.
                </h4>
                <span className="block text-sm font-semibold text-slate-500 mb-4 mt-1">
                  {formatarTelefone(userProfile?.telefone) || "WhatsApp não conectado"}
                </span>
              </div>

              {/* Connection Button or Last Activity */}
              {!userProfile?.telefone ? (
                <button
                  onClick={() => setOpenWhatsappDialog(true)}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-green-600/20 hover:-translate-y-0.5 active:translate-y-0"
                >
                  <Link size={16} />
                  Conectar WhatsApp
                </button>
              ) : (
                <div className="mt-auto">
                  <div className="p-3 bg-slate-50 hover:bg-slate-100 transition-colors rounded-2xl border border-slate-100 mb-3">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                      Última Atividade
                    </span>
                    <p className="text-sm font-semibold text-slate-900">
                      {formatarDataRelativa(lastActivity)}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (
                        window.confirm(
                          "Tem certeza que deseja desconectar o WhatsApp?",
                        )
                      ) {
                        try {
                          await unlinkWhatsapp(user?.id || "");
                          refreshDashboard();
                        } catch (err) {
                          alert("Erro ao desconectar. Tente novamente.");
                        }
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 hover:bg-red-50 py-2.5 rounded-xl text-xs font-semibold transition-colors duration-200"
                  >
                    <Unlink size={14} />
                    Desconectar Número
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Row: Harvest Stats */}
          <div className="col-span-1 md:col-span-2 xl:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 min-w-0">
            <HarvestDashboard
              harvestStats={harvestStats || {}}
              recentActivity={recentActivities || []}
              onEditRecord={(record) => {
                setRecordToEdit(record);
                setOpenRecordDialog(true);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
