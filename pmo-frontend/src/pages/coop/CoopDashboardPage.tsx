import React from 'react';
import { useParams } from 'react-router-dom';
import { 
    Users, 
    TrendingUp, 
    Map,
    ArrowLeft, 
    Loader2, 
    AlertCircle, 
    MapPin, 
    Activity,
    Sprout
} from 'lucide-react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import { useCoopDashboard } from '../../hooks/coop/useCoopDashboard';
import { useAppNavigation } from '../../hooks/navigation/useAppNavigation';
import { getOrganizacaoBySlug } from '../../services/organizacaoService';
import { cn } from '../../utils/cn';

const CoopDashboardPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [orgId, setOrgId] = React.useState<number | null>(null);
    const { stats, loading: statsLoading, error, isGestor } = useCoopDashboard(orgId);
    const { goBack } = useAppNavigation();
    const [orgLoading, setOrgLoading] = React.useState(true);

    React.useEffect(() => {
        if (!slug) return;
        const resolveSlug = async () => {
            setOrgLoading(true);
            const res = await getOrganizacaoBySlug(slug);
            if (res.success && res.data) {
                setOrgId(res.data.id);
            }
            setOrgLoading(false);
        };
        resolveSlug();
    }, [slug]);

    const loading = orgLoading || statsLoading;

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px]">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Consolidando dados da cooperativa...</p>
            </div>
        );
    }

    if (error || !stats || isGestor === false) {
        return (
            <div className="p-8 max-w-lg mx-auto text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Acesso Restrito</h3>
                <p className="text-slate-500 mb-6">{isGestor === false ? 'Apenas gestores desta organização podem visualizar a Torre de Controlo.' : (error || 'Não foi possível carregar os dados.')}</p>
                <button onClick={goBack} className="text-emerald-600 font-bold hover:underline border border-emerald-600 px-6 py-2 rounded-xl">
                    Voltar
                </button>
            </div>
        );
    }

    // Processar dados para o gráfico (Recharts gosta de arrays simples)
    const chartData = [...stats.producao_recente].reverse().map(item => ({
        data: new Date(item.data_registro).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        volume: Number(item.quantidade_valor),
        produto: item.produto,
        membro: item.propriedade_nome
    }));

    // Cores para o gráfico de Donut
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    const pieData = stats.area_por_cultura.map(item => ({
        name: item.cultura || 'Não Informada',
        value: Number(item.area)
    }));

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={goBack}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                             <TrendingUp className="w-6 h-6 text-emerald-500" />
                             Painel de Controle B2B
                        </h1>
                        <p className="text-slate-500 text-sm">Gestão consolidada e inteligência de produção.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2 rounded-2xl shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none">Dados Atualizados</span>
                </div>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard 
                    title="Produtores Cooperados" 
                    value={stats.total_membros.toString()} 
                    subValue="Membros ativos vinculados"
                    icon={<Users className="w-6 h-6" />}
                    color="emerald"
                />
                <MetricCard 
                    title="Área Total Gerenciada" 
                    value={`${stats.area_total_vinculada.toLocaleString('pt-BR')} ha`} 
                    subValue="Consolidado de todas as fazendas"
                    icon={<Map className="w-6 h-6" />}
                    color="blue"
                />
                <MetricCard 
                    title="Volume de Colheitas" 
                    value={stats.producao_recente.length.toString()} 
                    subValue="Entradas registradas no mês"
                    icon={<Activity className="w-6 h-6" />}
                    color="amber"
                />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Trend: Bar Chart */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">Fluxo de Colheitas</h3>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Acompanhamento das últimas entradas</p>
                        </div>
                    </div>
                    
                    <div className="h-72 w-full">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="data" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <YAxis 
                                        axisLine={false} 
                                        tickLine={false} 
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-slate-900 text-white p-3 rounded-xl shadow-2xl border border-slate-800 text-xs">
                                                        <p className="font-bold border-b border-slate-800 pb-1 mb-1">{data.membro}</p>
                                                        <p className="text-emerald-400 font-bold">{data.produto}: {data.volume}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="volume" radius={[4, 4, 0, 0]} barSize={20}>
                                        {chartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#10b981' : '#34d399'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyChart message="Nenhum fluxo de colheita detectado" />
                        )}
                    </div>
                </div>

                {/* Secondary: Pie Chart for Crop Distribution */}
                <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-slate-800">Diversidade de Culturas</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Distribuição por área total (ha)</p>
                    </div>

                    <div className="h-64 w-full relative">
                        {pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-slate-900 text-white p-2 px-3 rounded-lg text-[10px] font-bold">
                                                        {payload[0].name}: {payload[0].value} ha
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend 
                                        layout="horizontal" 
                                        align="center" 
                                        verticalAlign="bottom" 
                                        iconType="circle"
                                        formatter={(value) => <span className="text-[10px] font-bold text-slate-500 uppercase">{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <EmptyChart message="Nenhuma cultura ativa" />
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Atividade Recente no Campo</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Últimas colheitas registradas pelo grupo</p>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    {stats.producao_recente.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produtor / Fazenda</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Produto</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Volume</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Data do Registro</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {stats.producao_recente.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-50 rounded-xl group-hover:bg-emerald-50 transition-colors">
                                                    <MapPin className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                                                </div>
                                                <span className="font-bold text-slate-700">{item.propriedade_nome}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center">
                                                <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                    {item.produto}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="font-mono font-black text-slate-800">{item.quantidade_valor}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">{item.quantidade_unidade}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-slate-400 text-xs font-bold font-mono">
                                                {new Date(item.data_registro).toLocaleDateString('pt-BR')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-20 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Sprout className="w-8 h-8 text-slate-200" />
                            </div>
                            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-sm">Nenhuma colheita registrada recentemente</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, subValue, icon, color }: { title: string, value: string, subValue: string, icon: any, color: 'emerald' | 'blue' | 'amber' | 'slate' }) => {
    const colors = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        slate: 'bg-slate-100 text-slate-600'
    };

    return (
        <div className="bg-white border border-slate-200 p-6 rounded-[24px] shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[1.0] transition-all transform translate-x-4 translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:scale-110">
                {React.cloneElement(icon as React.ReactElement<any>, { size: 100, strokeWidth: 1.5 })}
            </div>
            
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-300", colors[color])}>
                {icon}
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{title}</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">{subValue}</p>
        </div>
    );
}

const EmptyChart = ({ message }: { message: string }) => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
        <Sprout className="w-8 h-8 text-slate-200 mb-2" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{message}</p>
    </div>
);

export default CoopDashboardPage;
