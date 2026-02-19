// src/pages/DashboardPage.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import HarvestDashboard from '../components/Dashboard/HarvestDashboard';
import PlanoAtualCard from '../components/Dashboard/PlanoAtualCard';
import ManualRecordDialog from '../components/Dashboard/ManualRecordDialog';
import WhatsappConnectDialog from '../components/Dashboard/WhatsappConnectDialog';

import { supabase } from '../supabaseClient';

import { Plus, Settings, Smartphone, CloudSun, MapPin, CloudRain, Link, Unlink } from 'lucide-react';

import { useDashboardLogic } from '../hooks/dashboard/useDashboardLogic';
import { WeatherData } from '../services/weatherService';
import { unlinkWhatsapp } from '../services/whatsappService';
import { formatarTelefone, formatarDataRelativa, obterSaudacao } from '../utils/formatters';

// Weather Widget (In-memory component)
const WeatherWidget: React.FC<{ weather: WeatherData | null; loading: boolean }> = ({ weather, loading }) => {
    if (loading || !weather) return <div className="h-40 bg-slate-100 rounded-3xl animate-pulse" />;

    const { current, daily } = weather;
    const temp = current.temperature;
    const humidity = current.humidity;
    const rainChance = daily.rainChance;

    return (
        <div className="rounded-3xl p-6 bg-gradient-to-br from-cyan-50 to-white border border-cyan-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-full min-h-[160px] transition-transform hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex justify-between items-start mb-2">
                <div>
                    <h3 className="text-4xl font-extrabold text-cyan-900 tracking-tight">{temp}°C</h3>
                    <div className="flex items-center gap-1 mt-1 text-cyan-700">
                        <MapPin size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">LOCAL ATUAL</span>
                    </div>
                </div>
                <CloudSun size={32} className="text-cyan-500" />
            </div>

            <div className="mt-4 pt-3 border-t border-cyan-900/10 flex items-center justify-between">
                <div>
                    <span className="block text-xs font-semibold text-cyan-700">Umidade</span>
                    <span className="text-sm font-bold text-cyan-900">{humidity}%</span>
                </div>
                <div className="text-right">
                    <span className="block text-xs font-semibold text-cyan-700">Chuva (Hoje)</span>
                    <div className="flex items-center gap-1 justify-end">
                        <CloudRain size={16} className={rainChance && rainChance > 50 ? "text-sky-600" : "text-cyan-400"} />
                        <span className="text-sm font-bold text-cyan-900">{rainChance}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DashboardPage: React.FC = () => {
    const { user, profile: authProfile } = useAuth();
    const navigate = useNavigate();
    const [openRecordDialog, setOpenRecordDialog] = useState(false);
    const [openWhatsappDialog, setOpenWhatsappDialog] = useState(false);

    // DB Probe for Debugging
    const [dbProbe, setDbProbe] = useState<any>(null);
    React.useEffect(() => {
        if (user?.id) {
            supabase.from('profiles').select('*').eq('id', user.id).single()
                .then(res => setDbProbe(res));
        }
    }, [user]);


    // Conectando o cérebro
    const {
        weather,
        harvestStats,
        lastActivity,
        recentActivities,
        pmoId,
        pmoName,
        pmoVersion,
        userProfile,
        isLoading,
        dataError,
        refreshDashboard
    } = useDashboardLogic();

    const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    const saudacao = obterSaudacao();

    const pmoIdNumber = pmoId ? Number(pmoId) : 0; // Adaptação para props legadas

    return (
        <div className="pb-8 overflow-x-hidden">
            <ManualRecordDialog
                open={openRecordDialog}
                onClose={() => setOpenRecordDialog(false)}
                pmoId={pmoIdNumber}
                onRecordSaved={refreshDashboard}
            />

            <WhatsappConnectDialog
                open={openWhatsappDialog}
                onClose={() => setOpenWhatsappDialog(false)}
                userId={user?.id || ''}
                onSuccess={refreshDashboard}
            />

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 mb-8 w-full max-w-full overflow-hidden">
                <div className="min-w-0 max-w-full break-words whitespace-normal flex-wrap">
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-1 break-words">
                        {saudacao}, {user?.email?.split('@')[0]}! 🚜
                    </h1>
                    <p className="text-slate-500 text-base break-words">
                        Resumo da produção em <span className="capitalize font-semibold text-slate-700">{hoje}</span>.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => navigate('/planos')}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition-colors w-full sm:w-auto"
                    >
                        <Settings size={18} />
                        Gerenciar Planos
                    </button>
                    <button
                        onClick={() => setOpenRecordDialog(true)}
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

            {isLoading && !weather && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-8">
                    <div className="h-full bg-green-500 w-1/3 animate-[indeterminate_1.5s_infinite_ease-in-out] rounded-full origin-left" style={{ width: '50%' }}></div>
                </div>
            )}

            {/* Grid Layout */}
            <div className="flex flex-col lg:flex-row gap-6 items-start mb-8 w-full min-w-0">
                {/* Left Column */}
                <div className="flex flex-col gap-6 w-full lg:w-1/3 min-w-0">
                    <PlanoAtualCard
                        nomePlano={pmoName}
                        versao={pmoVersion || 1}
                        status="Em andamento"
                        onVer={() => navigate('/caderno')}
                        onEditar={() => navigate('/planos')}
                    />

                    <WeatherWidget weather={weather} loading={isLoading} />

                    {/* Bot Card */}
                    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <div className={`p-2 rounded-lg ${userProfile?.telefone ? 'bg-green-100/50 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                <Smartphone size={20} />
                            </div>
                            <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${userProfile?.telefone ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {userProfile?.telefone ? "ATIVO" : "OFFLINE"}
                            </span>
                        </div>
                        <h4 className="text-lg font-bold text-slate-900 leading-tight">Assistente Inteligente</h4>
                        <span className="block text-xs font-medium text-slate-500 mb-4 mt-1">
                            {formatarTelefone(userProfile?.telefone)}
                        </span>

                        {/* Connection Button or Last Activity */}
                        {!userProfile?.telefone ? (
                            <button
                                onClick={() => setOpenWhatsappDialog(true)}
                                className="w-full mt-2 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
                            >
                                <Link size={16} />
                                Conectar WhatsApp
                            </button>
                        ) : (
                            <div>
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 mb-3">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Última Atividade</span>
                                    <p className="text-sm font-semibold text-slate-900">{formatarDataRelativa(lastActivity)}</p>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (window.confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
                                            try {
                                                await unlinkWhatsapp(user?.id || '');
                                                refreshDashboard();
                                            } catch (err) {
                                                alert('Erro ao desconectar. Tente novamente.');
                                            }
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 py-2 rounded-lg text-xs font-semibold transition-colors"
                                >
                                    <Unlink size={14} />
                                    Desconectar
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm min-h-full w-full lg:w-2/3 min-w-0">
                    <HarvestDashboard
                        harvestStats={harvestStats || {}}
                        recentActivity={recentActivities || []}
                    />
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
