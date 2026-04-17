import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    RefreshCcw,
    DollarSign,
    Users,
    Database,
    AlertCircle,
    Eye,
    Loader2,
    CheckCircle2,
    XCircle,
    BookOpen,
    Timer,
    Search
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import LogDetailsDialog, { LogData } from '../../components/admin/LogDetailsDialog';
import BotStatusCard from '../../components/admin/BotStatusCard';
import KnowledgeBaseTab from '../../components/admin/KnowledgeBaseTab';
import QueueDashboardTab from '../../components/admin/QueueDashboardTab';
import { BotStatus, fetchBotStatus } from '../../services/botStatusService';
import { cn } from '../../utils/cn';

// --- Types ---
interface DashboardStats {
    active_users_24h: number;
    total_cost_current_month: number;
    total_tokens_current_month: number;
    errors_today: number;
}

// KPI Card Component
const KpiCard = ({ title, value, icon, colorClass, subvalue }: any) => (
    <div className="bg-white rounded-3xl p-6 border border-agro-ouro/10 shadow-sm flex flex-col justify-between h-full group hover:border-agro-ouro/30 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 active">
        <div className="flex justify-between items-start mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-agro-floresta transition-colors font-sans">
                {title}
            </span>
            <div className={cn("p-2.5 rounded-2xl transition-transform group-hover:scale-110 duration-500 shadow-sm", colorClass)}>
                {React.cloneElement(icon, { size: 20 })}
            </div>
        </div>
        <div>
            <div className="text-4xl font-black text-agro-floresta tracking-tight font-sans tabular-nums">
                {value}
            </div>
            {subvalue && (
                <div className="text-[10px] font-black text-agro-floresta/40 mt-2 uppercase tracking-widest font-sans">
                    {subvalue}
                </div>
            )}
        </div>
    </div>
);

// Mobile Log Card Component
const MobileLogCard = ({ log, onOpen }: { log: any, onOpen: (l: any) => void }) => (
    <div className="bg-white p-5 rounded-2xl border border-neutral-100 shadow-sm mb-4 space-y-4 hover:border-agro-ouro/20 transition-colors">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-agro-floresta/5 flex items-center justify-center text-agro-floresta">
                    {log.acao.includes('IA') ? <Database size={18} /> : <DollarSign size={18} />}
                </div>
                <div>
                    <div className="text-sm font-black text-agro-floresta font-sans">{log.acao}</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">
                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(log.created_at))}
                    </div>
                </div>
            </div>
            <button 
                onClick={() => onOpen(log)}
                aria-label="Ver detalhes do log"
                className="p-2 text-agro-floresta bg-agro-floresta/5 rounded-lg active:scale-95 hover:bg-agro-floresta hover:text-white transition-all focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none"
            >
                <Eye size={18} />
            </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100 italic font-medium">
                <span className="block text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 font-sans">Modelo</span>
                <span className="text-xs font-black text-agro-floresta break-words font-sans">{log.modelo_ia || 'N/A'}</span>
            </div>
            <div className="bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                <span className="block text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 font-sans">Custo Est.</span>
                <span className="text-xs font-black text-agro-ouro tabular-nums">${Number(log.custo_estimado).toFixed(4)}</span>
            </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-neutral-50 font-sans">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tokens</span>
                <span className="text-sm font-black text-slate-800 tabular-nums">{log.total_tokens?.toLocaleString()}</span>
            </div>
            <div className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                log.status === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
                {log.status === 'success' ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                {log.status}
            </div>
        </div>
    </div>
);

const AdminDashboard = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentTab = searchParams.get('tab') || 'overview';
    
    // Tab mapping
    const tabMap: Record<string, number> = {
        'overview': 0,
        'finance': 1,
        'training': 2,
        'knowledge': 3,
        'queue': 4
    };
    
    const tabValue = tabMap[currentTab] ?? 0;

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [trainingLogs, setTrainingLogs] = useState<any[]>([]);
    const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedLog, setSelectedLog] = useState<LogData | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const statsPromise = supabase.rpc('get_dashboard_stats');
            const logsPromise = supabase
                .from('logs_consumo')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            const trainingPromise = supabase
                .from('logs_treinamento')
                .select('id, created_at, texto_usuario, json_corrigido, json_extraido, user_id')
                .order('created_at', { ascending: false })
                .limit(50);
            const botStatusPromise = fetchBotStatus();

            const [statsRes, logsRes, trainRes, botStatusRes] = await Promise.allSettled([
                statsPromise,
                logsPromise,
                trainingPromise,
                botStatusPromise,
            ]);

            if (statsRes.status === 'fulfilled') {
                if (statsRes.value.error) console.error('Error fetching stats:', statsRes.value.error);
                else setStats(statsRes.value.data as any);
            }

            if (logsRes.status === 'fulfilled') {
                if (logsRes.value.error) console.error('Error logs:', logsRes.value.error);
                else setAuditLogs(logsRes.value.data || []);
            }

            if (trainRes.status === 'fulfilled') {
                if (trainRes.value.error) console.error('Error training:', trainRes.value.error);
                else setTrainingLogs(trainRes.value.data || []);
            }

            if (botStatusRes.status === 'fulfilled') {
                setBotStatus(botStatusRes.value);
            }

        } catch (err) {
            console.error('Unexpected error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (log: any) => {
        setSelectedLog(log);
        setModalOpen(true);
    };

    const handleTabChange = (label: string) => {
        const slug = Object.keys(tabMap).find(key => key === label.toLowerCase() || (label === 'Visão Geral' && key === 'overview') || (label === 'Financeiro' && key === 'finance') || (label === 'Treinamento' && key === 'training') || (label === 'Knowledge' && key === 'knowledge') || (label === 'Fila' && key === 'queue'));
        if (slug) {
            setSearchParams({ tab: slug });
            setSearchTerm(''); // Reset search on tab change
        }
    };

    const tabs = [
        { label: 'Visão Geral', slug: 'overview', icon: <Database size={18} /> },
        { label: 'Financeiro', slug: 'finance', icon: <DollarSign size={18} /> },
        { label: 'Treinamento', slug: 'training', icon: <Users size={18} /> },
        { label: 'Knowledge', slug: 'knowledge', icon: <BookOpen size={18} /> },
        { label: 'Fila', slug: 'queue', icon: <Timer size={18} /> }
    ];

    // Filtered Data
    const filteredAuditLogs = useMemo(() => {
        if (!searchTerm) return auditLogs;
        const lowTerm = searchTerm.toLowerCase();
        return auditLogs.filter(log => 
            log.acao?.toLowerCase().includes(lowTerm) || 
            log.modelo_ia?.toLowerCase().includes(lowTerm) ||
            log.status?.toLowerCase().includes(lowTerm)
        );
    }, [auditLogs, searchTerm]);

    const filteredTrainingLogs = useMemo(() => {
        if (!searchTerm) return trainingLogs;
        const lowTerm = searchTerm.toLowerCase();
        return trainingLogs.filter(log => 
            log.texto_usuario?.toLowerCase().includes(lowTerm) ||
            JSON.stringify(log.json_corrigido || log.json_extraido)?.toLowerCase().includes(lowTerm)
        );
    }, [trainingLogs, searchTerm]);

    return (
        <div className="p-4 md:p-10 bg-agro-creme bg-grain min-h-screen font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="px-3 py-1 rounded-full bg-agro-floresta text-white text-[9px] font-black uppercase tracking-[0.2em] shadow-sm">
                            Administração
                        </span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-agro-floresta tracking-tighter uppercase">
                        Painel de Controle
                    </h1>
                    <p className="text-agro-floresta/50 font-medium mt-2 max-w-md italic leading-relaxed text-sm md:text-base">
                        Interface editorial para gestão de consumo, custos e orquestração de inteligência agronômica.
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    aria-label="Sincronizar dados do dashboard"
                    className="group relative flex items-center gap-3 px-8 py-3.5 bg-agro-floresta hover:ring-2 hover:ring-agro-ouro hover:ring-offset-2 disabled:opacity-50 text-white font-bold rounded-2xl shadow-xl transition-all active:scale-95 overflow-hidden focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none"
                >
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    {loading ? <Loader2 size={18} className="animate-spin text-agro-ouro" /> : <RefreshCcw size={18} className="text-agro-ouro group-hover:rotate-180 transition-transform duration-700" />}
                    <span className="relative">{loading ? 'Sincronizando…' : 'Sincronizar Dados'}</span>
                </button>
            </div>

            {/* Premium Tabs (Floating Segmented Control) */}
            <div className="flex justify-center md:justify-start mb-10 overflow-x-auto no-scrollbar py-2">
                <nav className="bg-white/60 backdrop-blur-xl p-1.5 rounded-3xl border border-white/80 shadow-lg flex gap-1 items-center min-w-fit" aria-label="Abas do dashboard">
                    {tabs.map((tab) => (
                        <button
                            key={tab.slug}
                            onClick={() => handleTabChange(tab.label)}
                            className={cn(
                                "flex items-center gap-2.5 py-3 px-6 rounded-[1.25rem] text-xs font-black uppercase tracking-wider transition-all duration-500 whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-agro-ouro",
                                currentTab === tab.slug
                                    ? "bg-agro-floresta text-white shadow-xl scale-105"
                                    : "text-agro-floresta/40 hover:text-agro-floresta hover:bg-white/80"
                            )}
                        >
                            {React.cloneElement(tab.icon as React.ReactElement<any>, { 
                                size: 16,
                                className: currentTab === tab.slug ? "text-agro-ouro" : "text-agro-floresta/40"
                            })}
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Search Bar (Conditional for Data Tabs) */}
            {(tabValue === 1 || tabValue === 2) && (
                <div className="mb-6 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="relative max-w-md group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-agro-floresta/30 group-focus-within:text-agro-ouro transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Pesquisa inteligente instantânea…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-agro-ouro/10 rounded-2xl text-sm font-bold text-agro-floresta placeholder:text-agro-floresta/20 focus:outline-none focus:ring-2 focus:ring-agro-ouro/30 focus:border-agro-ouro/50 transition-all shadow-sm"
                        />
                    </div>
                </div>
            )}

            {/* TAB 1: OVERVIEW (KPIs) */}
            {tabValue === 0 && (
                <div key="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                    {/* Bot Status Card */}
                    <BotStatusCard
                        botStatus={botStatus}
                        onStatusUpdate={setBotStatus}
                    />

                    {/* KPI Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <KpiCard
                            title="Usuários Ativos"
                            value={stats?.active_users_24h ?? '-'}
                            icon={<Users />}
                            colorClass="bg-emerald-50 text-emerald-700"
                            subvalue="Atividade Real-time"
                        />
                        <KpiCard
                            title="Consumo Estimado"
                            value={`$${Number(stats?.total_cost_current_month || 0).toFixed(2)}`}
                            icon={<DollarSign />}
                            colorClass="bg-rose-50 text-rose-700"
                            subvalue="Faturamento Competência"
                        />
                        <KpiCard
                            title="Volume de Tokens"
                            value={stats?.total_tokens_current_month?.toLocaleString() ?? '-'}
                            icon={<Database />}
                            colorClass="bg-agro-ouro/10 text-agro-ouro"
                            subvalue="Processamento IA"
                        />
                        <KpiCard
                            title="Erros Incidentes"
                            value={stats?.errors_today ?? '-'}
                            icon={<AlertCircle />}
                            colorClass="bg-amber-50 text-amber-700"
                            subvalue="Falhas de Orquestração"
                        />
                    </div>
                </div>
            )}

            {/* TAB 2: AUDIT LOGS */}
            {tabValue === 1 && (
                <div key="finance" className="animate-in fade-in zoom-in-95 duration-500">
                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-[2.5rem] border border-agro-ouro/10 shadow-sm overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse font-sans">
                                <thead>
                                    <tr className="bg-agro-creme/50 border-b border-agro-ouro/10">
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Ref</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Timestamp</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Ação Agente</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Modelo IA</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Tokens</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Custo ($)</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Veredito</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50 px-4">
                                    {filteredAuditLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-8 py-24 text-center text-neutral-300 font-serif italic text-lg">
                                                {searchTerm ? 'Nenhum registro encontrado para esta busca.' : 'Aguardando registros de auditoria financeira…'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAuditLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-agro-creme/30 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <button
                                                        onClick={() => handleOpenModal(log)}
                                                        aria-label="Ver detalhes do log"
                                                        className="p-2.5 text-agro-floresta bg-agro-floresta/5 rounded-xl hover:bg-agro-floresta hover:text-white transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="text-sm font-bold text-agro-floresta">
                                                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(log.created_at))}
                                                    </div>
                                                    <div className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mt-0.5">
                                                        {new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short' }).format(new Date(log.created_at))}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-agro-floresta bg-agro-floresta/5 px-3 py-1.5 rounded-xl border border-agro-floresta/10">
                                                        {log.acao}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-[11px] font-bold text-neutral-500 italic">
                                                    {log.modelo_ia}
                                                </td>
                                                <td className="px-8 py-5 text-sm font-black text-slate-800 tabular-nums">
                                                    {log.total_tokens?.toLocaleString()}
                                                </td>
                                                <td className="px-8 py-5 text-sm font-black text-agro-ouro tabular-nums">
                                                    ${Number(log.custo_estimado).toFixed(4)}
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className={cn(
                                                        "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm",
                                                        log.status === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                                                    )}>
                                                        {log.status === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                                                        {log.status}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                        {filteredAuditLogs.length === 0 ? (
                            <div className="text-center py-20 text-neutral-400 italic font-serif">Nenhum registro encontrado.</div>
                        ) : (
                            filteredAuditLogs.map(log => (
                                <MobileLogCard key={log.id} log={log} onOpen={handleOpenModal} />
                            ))
                        )}
                    </div>
                </div>
            )}


            {/* TAB 3: TRAINING LOGS */}
            {tabValue === 2 && (
                <div key="training" className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-white rounded-[2.5rem] border border-agro-ouro/10 shadow-sm overflow-hidden">
                        <div className="w-full overflow-x-auto">
                            <table className="w-full min-w-[800px] text-left border-collapse">
                                <thead>
                                    <tr className="bg-agro-creme/50 border-b border-agro-ouro/10">
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Ref</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Data</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Sinal de Entrada (Prompt)</th>
                                        <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-agro-floresta">Orquestração IA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-50 px-4">
                                    {filteredTrainingLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-8 py-24 text-center text-neutral-300 font-serif italic text-lg">
                                                {searchTerm ? 'Nenhum ciclo de treinamento corresponde à busca.' : 'Aguardando ciclos de treinamento botânico…'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTrainingLogs.map((log) => (
                                            <tr key={log.id} className="hover:bg-agro-creme/30 transition-colors group">
                                                <td className="px-8 py-5">
                                                    <button
                                                        onClick={() => handleOpenModal(log)}
                                                        aria-label="Ver detalhes do treinamento"
                                                        className="p-2.5 text-agro-floresta bg-agro-floresta/5 rounded-xl hover:bg-agro-floresta hover:text-white transition-all shadow-sm focus-visible:ring-2 focus-visible:ring-agro-ouro outline-none"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="text-sm font-bold text-agro-floresta">
                                                        {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(log.created_at))}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 max-w-md">
                                                    <p className="text-sm text-agro-floresta/70 font-medium line-clamp-2 italic leading-relaxed">
                                                        “{log.texto_usuario}”
                                                    </p>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        {log.json_corrigido && (
                                                            <div className="inline-flex">
                                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full border border-emerald-100 uppercase tracking-widest">
                                                                    Dataset Corrigido
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="bg-neutral-50 p-2.5 rounded-lg border border-neutral-100">
                                                            <code className="block text-[10px] font-mono text-neutral-400 truncate max-w-xs">
                                                                {JSON.stringify(log.json_corrigido || log.json_extraido)}
                                                            </code>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}


            {/* TAB 4: KNOWLEDGE BASE */}
            {tabValue === 3 && (
                <div key="knowledge" className="animate-in fade-in zoom-in-95 duration-500">
                   <KnowledgeBaseTab />
                </div>
            )}

            {/* TAB 5: QUEUE DASHBOARD */}
            {tabValue === 4 && (
                <div key="queue" className="animate-in fade-in zoom-in-95 duration-500">
                    <QueueDashboardTab />
                </div>
            )}

            {/* Modal */}
            <LogDetailsDialog
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                log={selectedLog}
            />
        </div>
    );
};

export default AdminDashboard;
