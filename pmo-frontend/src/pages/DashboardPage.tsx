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
import WhatsappAssistantCard from "../components/Dashboard/WhatsappAssistantCard";
import {
  Plus,
  Settings,
  CloudSun,
  MapPin,
} from "lucide-react";

import { useDashboardLogic } from "../hooks/dashboard/useDashboardLogic";
import { WeatherData } from "../services/weatherService";
import { unlinkWhatsapp } from "../services/whatsappService";
import {
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
  const conditionIconUrl = current.conditionIcon;
  
  const hojeLocal = new Date().toISOString().split('T')[0];
  const RAIN_CHANCE_THRESHOLD = 5;

  const isWeatherStale = !forecast || !forecast.some((f: any) => f.date === hojeLocal);
  const lastUpdatedAt = current.temperature ? 'Agora' : 'Desconhecido';

  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const forecastList = [0, 1, 2].map((offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    const f = (forecast || []).find((item: any) => item.date === dateStr);
    
    let dayStr = offset === 0 ? "Hoje" : offset === 1 ? "Amanhã" : diasSemana[d.getDay()];

    if (!f) return { day: dayStr, min: null, max: null, rain: null, iconUrl: null };

    const chance = f.day.daily_chance_of_rain;
    return {
      day: dayStr,
      min: Math.round(f.day.mintemp_c),
      max: Math.round(f.day.maxtemp_c),
      rain: (chance >= RAIN_CHANCE_THRESHOLD) ? `${chance}%` : null,
      iconUrl: f.day.condition.icon.startsWith('http') ? f.day.condition.icon : `https:${f.day.condition.icon}`
    };
  });

  return (
    <div className="flex flex-col h-full col-span-1 xl:col-span-2">
      {isWeatherStale && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800">
          <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          Dados desatualizados. Última atualização: {lastUpdatedAt}
        </div>
      )}

      <div className="rounded-3xl p-6 lg:p-8 bg-gradient-to-br from-cyan-50 to-white border border-cyan-100 shadow-sm relative overflow-hidden flex flex-col xl:flex-row flex-1 min-h-[220px] transition-all duration-300 hover:shadow-lg group">
        <div className="flex-1 flex flex-col justify-between pr-0 xl:pr-8 border-b xl:border-b-0 border-cyan-200/50 pb-6 xl:pb-0 mb-6 xl:mb-0 xl:border-r">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-5xl font-black text-cyan-900 tracking-tighter">{temp}°C</h3>
              <div className="flex items-center gap-1.5 mt-2 text-cyan-700 font-semibold bg-cyan-100/50 w-fit px-2.5 py-1 rounded-lg">
                <MapPin size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">LOCAL ATUAL</span>
              </div>
            </div>
            {conditionIconUrl && <img src={conditionIconUrl} alt="Clima" className="w-16 h-16 object-contain" />}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-black uppercase tracking-wider text-cyan-800">Umidade</span>
              <span className="text-base font-extrabold text-cyan-950">{humidity}%</span>
            </div>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col justify-between pl-0 xl:pl-8">
          <div className="grid grid-cols-3 gap-2">
            {forecastList.map((f, i) => (
              <div key={i} className="text-center p-2 rounded-2xl hover:bg-white/60 transition-colors">
                <span className="block text-[10px] font-black uppercase text-cyan-800 mb-1">{f.day}</span>
                {f.iconUrl && <img src={f.iconUrl} alt={f.day} className="w-8 h-8 mx-auto mb-1" />}
                <div className="text-xs font-black text-cyan-950">{f.max}°<span className="text-cyan-800/60">{f.min}°</span></div>
                {f.rain && <span className="text-[10px] font-black text-blue-700">{f.rain}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const {
    weather,
    harvestStats,
    recentActivities,
    pmoName,
    pmoVersion,
    userProfile,
    whatsappStatus,
    isLoading,
    dataError,
    refreshDashboard,
  } = useDashboardLogic();

  const [openRecordDialog, setOpenRecordDialog] = useState(false);
  const [recordToEdit, setRecordToEdit] = useState<any>(null);
  const [openWhatsappDialog, setOpenWhatsappDialog] = useState(false);

  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="p-4 lg:p-8 max-w-[1600px] mx-auto min-h-screen bg-[#F8FAFC]">
      <ProfileIncompleteAlert show={!userProfile?.telefone} />
      <ProductTour ready={!isLoading} />
      
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div className="space-y-1.5">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight font-serif">
            {obterSaudacao()}, <span className="text-green-700">{profile?.nome?.split(' ')[0] || 'Produtor'}</span>!
          </h2>
          <p className="text-sm text-slate-600 font-bold">{hoje}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate("/planos")} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors">
            <Settings size={18} /> Gerenciar Planos
          </button>
          <button onClick={() => { setRecordToEdit(null); setOpenRecordDialog(true); }} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-sm active:scale-95">
            <Plus size={20} /> Novo Registro
          </button>
        </div>
      </div>

      {dataError && <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{dataError}</div>}

      {isLoading ? (
        <div className="h-64 bg-white rounded-3xl animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8 w-full">
          <PlanoAtualCard nomePlano={pmoName} versao={pmoVersion || 1} status="Em andamento" onVer={() => navigate("/caderno")} onEditar={() => navigate("/planos")} />
          <WeatherWidget weather={weather} loading={false} />

          <WhatsappAssistantCard
            telefone={userProfile?.telefone}
            whatsappStatus={whatsappStatus as any}
            onConnect={() => setOpenWhatsappDialog(true)}
            onUnlink={async () => {
              if (window.confirm("Desconectar WhatsApp?")) {
                await unlinkWhatsapp(user?.id || "");
                refreshDashboard();
              }
            }}
          />

          <div className="col-span-1 md:col-span-2 xl:col-span-2">
            <HarvestDashboard harvestStats={harvestStats || {}} recentActivity={recentActivities || []} onEditRecord={(record) => { setRecordToEdit(record); setOpenRecordDialog(true); }} />
          </div>
        </div>
      )}

      <ManualRecordDialog open={openRecordDialog} recordToEdit={recordToEdit} onClose={() => setOpenRecordDialog(false)} onRecordSaved={refreshDashboard} />
      <WhatsappConnectDialog open={openWhatsappDialog} onClose={() => setOpenWhatsappDialog(false)} userId={user?.id || ""} onSuccess={refreshDashboard} />
    </div>
  );
};

export default DashboardPage;
