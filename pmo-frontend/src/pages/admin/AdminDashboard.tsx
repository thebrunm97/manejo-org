// src/pages/admin/AdminDashboard.tsx

import React, { useEffect, useState } from 'react';
import {
    RefreshCcw,
    DollarSign,
    Users,
    Database,
    AlertCircle,
    Eye,
    Loader2,
    Search,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    XCircle
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import LogDetailsDialog, { LogData } from '../../components/admin/LogDetailsDialog';
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
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm shadow-slate-200/50 flex flex-col justify-between h-full group hover:border-slate-200 transition-all">
        <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">
                {title}
            </span>
            <div className={cn("p-2.5 rounded-xl", colorClass)}>
                {React.cloneElement(icon, { size: 20 })}
            </div>
        </div>
        <div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">
                {value}
            </div>
            {subvalue && (
                <div className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wide">
                    {subvalue}
                </div>
            )}
        </div>
    </div>
);

const AdminDashboard = () => {
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [trainingLogs, setTrainingLogs] = useState<any[]>([]);

    // Modal State
    const [selectedLog, setSelectedLog] = useState<LogData | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats');
            if (rpcError) console.error('Error fetching stats:', rpcError);
            else setStats(rpcData);

            const { data: logsData, error: logsError } = await supabase
                .from('logs_consumo')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);
            if (logsError) console.error('Error logs:', logsError);
            else setAuditLogs(logsData || []);

            const { data: trainData, error: trainError } = await supabase
                .from('logs_treinamento')
                .select('*')
                .order('criado_em', { ascending: false })
                .limit(50);

            if (trainError) console.error('Error training:', trainError);
            else setTrainingLogs(trainData || []);

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

    const tabs = [
        { label: 'Visão Geral', icon: <Database size={18} /> },
        { label: 'Auditoria Financeira', icon: <DollarSign size={18} /> },
        { label: 'Treinamento da LLM', icon: <Users size={18} /> }
    ];

    return (
        <div className="p-4 md:p-8 bg-slate-50 min-h-screen font-sans">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Painel de Controle</h1>
                    <p className="text-slate-500 font-medium mt-1">Gestão de consumo, custos e treinamento de IA.</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-green-600/20 transition-all active:scale-95 whitespace-nowrap"
                >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
                    {loading ? 'Atualizando...' : 'Atualizar'}
                </button>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-[2rem] p-2 border border-slate-200 shadow-sm mb-8 max-w-2xl">
                <nav className="flex space-x-1">
                    {tabs.map((tab, index) => (
                        <button
                            key={index}
                            onClick={() => setTabValue(index)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold transition-all",
                                tabValue === index
                                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* TAB 1: OVERVIEW (KPIs) */}
            {tabValue === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <KpiCard
                        title="Usuários Ativos"
                        value={stats?.active_users_24h ?? '-'}
                        icon={<Users />}
                        colorClass="bg-blue-50 text-blue-600"
                        subvalue="Últimas 24 horas"
                    />
                    <KpiCard
                        title="Custo Mês"
                        value={`$${Number(stats?.total_cost_current_month || 0).toFixed(2)}`}
                        icon={<DollarSign />}
                        colorClass="bg-rose-50 text-rose-600"
                        subvalue="Mês vigente"
                    />
                    <KpiCard
                        title="Tokens Mês"
                        value={stats?.total_tokens_current_month?.toLocaleString() ?? '-'}
                        icon={<Database />}
                        colorClass="bg-indigo-50 text-indigo-600"
                        subvalue="Processamento total"
                    />
                    <KpiCard
                        title="Erros Hoje"
                        value={stats?.errors_today ?? '-'}
                        icon={<AlertCircle />}
                        colorClass="bg-amber-50 text-amber-600"
                        subvalue="Falhas críticas"
                    />
                </div>
            )}

            {/* TAB 2: AUDIT LOGS */}
            {tabValue === 1 && (
                <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Detalhes</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Ação</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">IA / Modelo</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Tokens</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Custo ($)</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {auditLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    auditLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleOpenModal(log)}
                                                    className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-700">
                                                    {new Date(log.created_at).toLocaleDateString()}
                                                </div>
                                                <div className="text-[10px] font-medium text-slate-400">
                                                    {new Date(log.created_at).toLocaleTimeString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs font-bold text-slate-600 px-2.5 py-1 bg-slate-100 rounded-lg">
                                                    {log.acao}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-500">
                                                {log.modelo_ia}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-700">
                                                {log.total_tokens}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-black text-rose-500">
                                                ${Number(log.custo_estimado).toFixed(4)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                                                    log.status === 'success' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
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
            )}

            {/* TAB 3: TRAINING LOGS */}
            {tabValue === 2 && (
                <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Detalhes</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Data</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Prompt do Usuário</th>
                                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">IA (Resumo)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {trainingLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    trainingLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleOpenModal(log)}
                                                    className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-slate-700">
                                                    {new Date(log.criado_em).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 max-w-md">
                                                <p className="text-sm text-slate-600 line-clamp-2 leading-tight">
                                                    {log.texto_usuario}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {log.json_corrigido && (
                                                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md mb-1 uppercase tracking-wider">
                                                        Corrigido
                                                    </span>
                                                )}
                                                <code className="block text-[11px] font-mono text-slate-400 truncate max-w-xs">
                                                    {JSON.stringify(log.json_corrigido || log.json_extraido)}
                                                </code>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
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
