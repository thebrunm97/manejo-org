import React, { useState } from 'react';
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Percent, 
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    ChevronDown,
    LayoutDashboard
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer,
    Cell,
    PieChart, 
    Pie
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useFinanceiroStats } from '../hooks/financeiro/useFinanceiroStats';
import { useTransacoes } from '../hooks/financeiro/useTransacoes';
import TransacoesTable from '../components/Financeiro/TransacoesTable';
import TransacaoDialog from '../components/Financeiro/TransacaoDialog';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    }).format(value);
};

const FinanceiroPage: React.FC = () => {
    const { currentPropriedade } = useAuth();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isTransacaoModalOpen, setIsTransacaoModalOpen] = useState(false);
    
    const { 
        dataDRE, 
        dataTalhoes, 
        summary, 
        loading, 
        error 
    } = useFinanceiroStats(currentPropriedade?.id, selectedYear);

    const {
        transacoes,
        loading: loadingTransacoes,
        refetch: refetchTransacoes
    } = useTransacoes(currentPropriedade?.id);

    const years = [2024, 2025, 2026];

    if (error) {
        return (
            <div className="p-6 text-center">
                <div className="bg-red-50 text-red-600 p-4 rounded-lg inline-block">
                    Erro ao carregar dados financeiros: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-8 bg-slate-50 min-h-screen pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard Financeiro (DRE)</h1>
                    <p className="text-slate-500 text-sm">Demonstrativo de Resultados da Fazenda: {currentPropriedade?.nome}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setIsTransacaoModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 hover:shadow-md transition-all flex-1 md:flex-none justify-center"
                    >
                        <DollarSign size={16} />
                        Nova Transação
                    </button>

                    <div className="relative inline-block">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-sm">
                            <Calendar size={18} className="text-slate-400" />
                            <select 
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer pr-4"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <ChevronDown size={14} className="text-slate-400 absolute right-3 pointer-events-none" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading Overlay */}
            {loading && (
                <div className="fixed inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
                        <span className="text-sm font-medium text-slate-600">Atualizando dados...</span>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard 
                    title="Receita Total" 
                    value={summary.totalReceitas} 
                    icon={<TrendingUp className="text-emerald-600" />}
                    colorClass="text-emerald-600"
                    trend="positivo"
                />
                <SummaryCard 
                    title="Despesa Total" 
                    value={summary.totalDespesas} 
                    icon={<TrendingDown className="text-rose-600" />}
                    colorClass="text-rose-600"
                    trend="negativo"
                />
                <SummaryCard 
                    title="Lucro Líquido" 
                    value={summary.lucroLiquido} 
                    icon={<DollarSign className={summary.lucroLiquido >= 0 ? "text-emerald-600" : "text-rose-600"} />}
                    colorClass={summary.lucroLiquido >= 0 ? "text-emerald-600" : "text-rose-600"}
                    trend={summary.lucroLiquido >= 0 ? "positivo" : "negativo"}
                />
                <SummaryCard 
                    title="Margem Líquida" 
                    value={summary.margemLiquida} 
                    isPercent
                    icon={<Percent className="text-indigo-600" />}
                    colorClass="text-indigo-600"
                    trend="neutro"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Bar Chart - DRE Mensal */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <LayoutDashboard size={18} className="text-indigo-500" />
                            Evolução Mensal (R$)
                        </h3>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataDRE} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="mes" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 12 }} 
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(val) => `R$ ${val / 1000}k`}
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(value: any) => [formatCurrency(Number(value)), '']}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Bar 
                                    name="Receitas" 
                                    dataKey="receitas" 
                                    fill="#22c55e" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={24}
                                />
                                <Bar 
                                    name="Despesas" 
                                    dataKey="despesas" 
                                    fill="#ef4444" 
                                    radius={[4, 4, 0, 0]} 
                                    barSize={24}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie Chart / Top Talhões */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-slate-800">Lucro por Talhão</h3>
                    </div>
                    
                    {dataTalhoes.length > 0 ? (
                        <div className="space-y-6">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={dataTalhoes.filter(t => t.lucro > 0) as any[]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="lucro"
                                            nameKey="talhao_nome"
                                        >
                                            {dataTalhoes.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.cor} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                                {dataTalhoes.map((talhao) => (
                                    <div key={talhao.talhao_id} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div 
                                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                                style={{ backgroundColor: talhao.cor }}
                                            />
                                            <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">
                                                {talhao.talhao_nome}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${talhao.lucro >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {formatCurrency(talhao.lucro)}
                                            </p>
                                            <p className="text-[10px] text-slate-400">Rec: {formatCurrency(talhao.receitas)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="h-[300px] flex flex-col items-center justify-center text-center space-y-2">
                            <div className="p-3 bg-slate-50 rounded-full">
                                <DollarSign size={24} className="text-slate-300" />
                            </div>
                            <p className="text-sm text-slate-400 px-4">Sem dados de lucro por talhão para o ano selecionado.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabela de Transações (Feed) */}
            <div className="mt-8">
                <TransacoesTable transacoes={transacoes} loading={loadingTransacoes} />
            </div>

            {/* Modal de Nova Transação */}
            <TransacaoDialog
                open={isTransacaoModalOpen}
                onClose={() => setIsTransacaoModalOpen(false)}
                onSuccess={() => refetchTransacoes()}
            />
        </div>
    );
};

interface SummaryCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    colorClass: string;
    trend: 'positivo' | 'negativo' | 'neutro';
    isPercent?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ title, value, icon, colorClass, trend, isPercent }) => {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                    {icon}
                </div>
                <div className={`p-1 rounded-full ${
                    trend === 'positivo' ? 'bg-emerald-50 text-emerald-600' : 
                    trend === 'negativo' ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'
                }`}>
                    {trend === 'positivo' ? <ArrowUpRight size={16} /> : 
                     trend === 'negativo' ? <ArrowDownRight size={16} /> : <div className="w-4 h-4" />}
                </div>
            </div>
            <h4 className="text-sm font-medium text-slate-500 mb-1">{title}</h4>
            <p className={`text-xl font-bold tracking-tight ${colorClass}`}>
                {isPercent ? `${value}%` : formatCurrency(value)}
            </p>
        </div>
    );
};

export default FinanceiroPage;
