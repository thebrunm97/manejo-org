import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { 
    PlusCircle, 
    ClipboardList, 
    Search, 
    RefreshCw, 
    Loader2, 
    Calendar, 
    Target,
    X,
    CheckCircle2,
    AlertCircle,
    ArrowLeft,
    TrendingUp,
    Box
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppNavigation } from '../../hooks/navigation/useAppNavigation';
import { toast } from 'react-toastify';
import { DemandaColetiva, DemandaStatus } from '../../domain/coletivo/coletivoTypes';
import { getOrganizacaoBySlug } from '../../services/organizacaoService';

const CoopDemandasPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const { profile } = useAuth();
    const { goBack } = useAppNavigation();
    
    const [organizacao, setOrganizacao] = useState<any>(null);
    const [demandas, setDemandas] = useState<DemandaColetiva[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        titulo: '',
        cultura: '',
        volume_necessario: '',
        unidade_medida: 'kg',
        data_limite_entrega: '',
        preco_referencia: '',
        modalidade_exigida: 'ORGANICO' as 'ORGANICO' | 'CONVENCIONAL' | 'TRANSICAO'
    });

    const fetchOrgAndDemandas = async () => {
        if (!slug) return;
        setLoading(true);
        try {
            const res = await getOrganizacaoBySlug(slug);
            if (res.success && res.data) {
                setOrganizacao(res.data);
                
                const { data, error } = await supabase
                    .from('demandas_coletivas')
                    .select('*')
                    .eq('cooperativa_id', res.data.id)
                    .order('data_entrega', { ascending: true });

                if (error) throw error;
                setDemandas(data || []);
            }
        } catch (error: any) {
            toast.error('Erro ao buscar dados: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrgAndDemandas();
    }, [slug]);

    const handleCreateDemanda = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organizacao) return;
        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('demandas_coletivas')
                .insert([{
                    titulo: formData.titulo,
                    cultura: formData.cultura,
                    quantidade_total: parseFloat(formData.volume_necessario),
                    unidade: formData.unidade_medida,
                    preco_referencia: formData.preco_referencia ? parseFloat(formData.preco_referencia) : null,
                    modalidade_exigida: formData.modalidade_exigida,
                    cooperativa_id: organizacao.id,
                    data_entrega: formData.data_limite_entrega,
                    criado_por: profile?.id,
                    status: 'aberta'
                }]);

            if (error) throw error;

            toast.success('Demanda criada com sucesso!');
            setIsModalOpen(false);
            setFormData({
                titulo: '',
                cultura: '',
                volume_necessario: '',
                unidade_medida: 'kg',
                data_limite_entrega: '',
                preco_referencia: '',
                modalidade_exigida: 'ORGANICO'
            });
            fetchOrgAndDemandas();
        } catch (error: any) {
            toast.error('Erro ao criar demanda: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusIcon = (status: DemandaStatus) => {
        switch (status) {
            case 'aberta': return <PlusCircle className="w-4 h-4 text-emerald-500" />;
            case 'em_captacao': return <Target className="w-4 h-4 text-amber-500" />;
            case 'fechada': return <CheckCircle2 className="w-4 h-4 text-slate-500" />;
            case 'cancelada': return <AlertCircle className="w-4 h-4 text-rose-500" />;
        }
    };

    const getStatusLabel = (status: DemandaStatus) => {
        switch (status) {
            case 'aberta': return 'Aberta';
            case 'em_captacao': return 'Em Captação';
            case 'fechada': return 'Fechada';
            case 'cancelada': return 'Cancelada';
        }
    };

    const filteredDemandas = demandas.filter(d => 
        d.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || 
        d.cultura.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                             <ClipboardList className="w-6 h-6 text-emerald-500" />
                             Demandas - {organizacao?.nome || 'Carregando...'}
                        </h1>
                        <p className="text-slate-500 text-sm">Gerencie contratos e captação de produção.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar demanda..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 w-64 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                        <PlusCircle className="w-4 h-4" />
                        Nova Demanda
                    </button>
                    <button
                        onClick={fetchOrgAndDemandas}
                        className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Content Table */}
            <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden">
                {loading && demandas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
                        <p className="text-slate-500 font-medium tracking-tight">Buscando quadro de demandas...</p>
                    </div>
                ) : filteredDemandas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Box className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Sem demandas ativas</h3>
                        <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                            Crie uma demanda para que os produtores possam visualizar no mural.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Produto / Cultura</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Progresso de Captação</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Prazo</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                                    <th className="py-4 px-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredDemandas.map((demanda) => {
                                    const total = demanda.quantidade_total || 1;
                                    const assumida = demanda.quantidade_assumida || 0;
                                    const percentage = Math.min(Math.round((assumida / total) * 100), 100);
                                    
                                    return (
                                        <tr key={demanda.id} className="hover:bg-slate-50 transition-all group">
                                            <td className="py-5 px-6">
                                                <div className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                                                    {demanda.titulo}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider border border-emerald-100">
                                                        {demanda.cultura}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 font-bold uppercase">
                                                        {demanda.unidade}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 min-w-[240px]">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between items-baseline">
                                                        <span className="text-xs font-black text-slate-700">
                                                            {percentage}% <span className="text-slate-400 font-bold ml-1 uppercase">Ofertado</span>
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400">
                                                            {assumida} / {total} {demanda.unidade}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                                                percentage > 90 ? 'bg-emerald-500' : percentage > 50 ? 'bg-amber-500' : 'bg-brand-500'
                                                            }`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-center">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                        {new Date(demanda.data_entrega).toLocaleDateString('pt-BR')}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-tighter mt-0.5">Vencimento</span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6">
                                                <div className="flex justify-center">
                                                    <span className={`
                                                        inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border
                                                        ${demanda.status === 'aberta' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''}
                                                        ${demanda.status === 'em_captacao' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
                                                        ${demanda.status === 'fechada' ? 'bg-slate-50 text-slate-700 border-slate-200' : ''}
                                                        ${demanda.status === 'cancelada' ? 'bg-rose-50 text-rose-700 border-rose-100' : ''}
                                                    `}>
                                                        {getStatusIcon(demanda.status)}
                                                        {getStatusLabel(demanda.status)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-5 px-6 text-right">
                                                <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                                                    <TrendingUp className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 md:p-4 bg-slate-900/40 backdrop-blur-sm transition-all animate-in fade-in duration-300">
                    <div className="bg-white rounded-[24px] md:rounded-[32px] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-slate-100 transform animate-in zoom-in-95 duration-300">
                        <form onSubmit={handleCreateDemanda}>
                            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2">
                                        <PlusCircle className="w-5 h-5 text-emerald-500" />
                                        Nova Demanda
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-widest leading-tight">Coordenar fornecimento dos membros</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Título do Contrato / Demanda</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ex: PNAE Cenoura - Julho/2026"
                                        value={formData.titulo}
                                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-transparent rounded-[20px] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white focus:border-emerald-500/50 transition-all font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Produto</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ex: Cenoura"
                                            value={formData.cultura}
                                            onChange={(e) => setFormData({ ...formData, cultura: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 border border-transparent rounded-[20px] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Modalidade</label>
                                        <select
                                            value={formData.modalidade_exigida}
                                            onChange={(e: any) => setFormData({ ...formData, modalidade_exigida: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 border border-transparent rounded-[20px] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer font-medium"
                                        >
                                            <option value="ORGANICO">Orgânico</option>
                                            <option value="CONVENCIONAL">Convencional</option>
                                            <option value="TRANSICAO">Transição</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Volume Necessário</label>
                                        <div className="flex gap-2">
                                            <input
                                                required
                                                type="number"
                                                placeholder="0.00"
                                                value={formData.volume_necessario}
                                                onChange={(e) => setFormData({ ...formData, volume_necessario: e.target.value })}
                                                className="flex-1 px-5 py-3.5 bg-slate-50 border border-transparent rounded-[20px] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                                            />
                                            <select
                                                value={formData.unidade_medida}
                                                onChange={(e) => setFormData({ ...formData, unidade_medida: e.target.value })}
                                                className="w-24 px-2 py-3.5 bg-slate-100 border-none rounded-[20px] text-xs font-black text-slate-700 uppercase transition-all cursor-pointer"
                                            >
                                                <option value="kg">kg</option>
                                                <option value="ton">ton</option>
                                                <option value="sacas">sacas</option>
                                                <option value="caixas">caixas</option>
                                                <option value="unid">unid</option>
                                                <option value="maco">maço</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Preço Ref. (R$ / {formData.unidade_medida})</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={formData.preco_referencia}
                                            onChange={(e) => setFormData({ ...formData, preco_referencia: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-slate-50 border border-transparent rounded-[20px] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold text-emerald-700"
                                        />
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Prazo de Entrega</label>
                                    <input
                                        required
                                        type="date"
                                        value={formData.data_limite_entrega}
                                        onChange={(e) => setFormData({ ...formData, data_limite_entrega: e.target.value })}
                                        className="w-full px-5 py-3.5 bg-slate-50 border border-transparent rounded-[20px] text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="p-8 border-t border-slate-50 bg-slate-50/30 flex justify-end gap-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 py-3 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={submitting}
                                    type="submit"
                                    className="flex items-center gap-2 px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-[0.1em] transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                >
                                    {submitting ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                                    ) : (
                                        'Lançar Demanda'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoopDemandasPage;
