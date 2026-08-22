import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { 
    Search, 
    RefreshCw, 
    Loader2, 
    Sprout,
    X,
    Box,
    ArrowRight,
    Building2,
    HandHelping
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { DemandaColetiva } from '../domain/coletivo/coletivoTypes';

const AlertCircle = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

const MuralDemandas: React.FC = () => {
    const { profile, currentPropriedade } = useAuth();
    const [demandas, setDemandas] = useState<DemandaColetiva[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedDemanda, setSelectedDemanda] = useState<DemandaColetiva | null>(null);
    const [ofertando, setOfertando] = useState(false);
    const [volumeOferta, setVolumeOferta] = useState('');
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const fetchMural = async () => {
        if (!currentPropriedade) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data: vinculos, error: vError } = await supabase
                .from('organizacao_membros')
                .select('organizacao_id')
                .eq('propriedade_id', currentPropriedade.id);

            if (vError) throw vError;

            if (!vinculos || vinculos.length === 0) {
                setDemandas([]);
                return;
            }

            const orgIds = vinculos.map(v => v.organizacao_id);

            const { data, error } = await supabase
                .from('demandas_coletivas')
                .select('*')
                .in('cooperativa_id', orgIds)
                .eq('status', 'aberta')
                .order('data_entrega', { ascending: true });

            if (error) throw error;
            setDemandas(data || []);
        } catch (error: any) {
            toast.error('Erro ao carregar mural: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMural();
    }, [currentPropriedade?.id]);

    const handleOfertar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDemanda || !currentPropriedade || !profile) return;
        
        const parsedVolume = parseFloat(volumeOferta);
        if (isNaN(parsedVolume) || parsedVolume <= 0) {
            toast.error('Informe um volume válido maior que zero.');
            return;
        }

        setOfertando(true);
        try {
            const { error } = await supabase.rpc('create_demanda_intencao', {
                p_payload: {
                    demanda_id: selectedDemanda.id,
                    propriedade_id: currentPropriedade.id,
                    volume_ofertado: parsedVolume,
                    status_intencao: 'pendente'
                }
            });

            if (error) throw error;

            toast.success('Oferta registrada! A cooperativa analisará sua proposta.');
            setSelectedDemanda(null);
            setVolumeOferta('');
            fetchMural();
        } catch (error: any) {
            toast.error('Erro ao registrar oferta: ' + error.message);
        } finally {
            setOfertando(false);
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
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                         <div className="w-10 h-10 bg-emerald-100 rounded-2xl flex items-center justify-center">
                            <HandHelping className="w-6 h-6 text-emerald-600" />
                         </div>
                         Mural de Demandas
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Oferte sua produção para atender aos contratos das suas organizações.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="O que você quer produzir?"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-3 w-64 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={fetchMural}
                        className="p-3 text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors border border-slate-200"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-[32px]">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Consultando oportunidades...</p>
                </div>
            ) : filteredDemandas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-white border border-slate-200 rounded-[32px] border-dashed">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Sprout className="w-8 h-8 text-slate-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Nenhuma demanda aberta</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                        Parece que suas organizações não possuem demandas ativas no momento.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredDemandas.map((demanda) => (
                        <div key={demanda.id} className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all">
                                <Box size={120} strokeWidth={1} />
                            </div>

                            <div className="flex justify-between items-start mb-4">
                                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-emerald-100">
                                    {demanda.cultura}
                                </span>
                                <div className="p-2 bg-slate-50 rounded-xl">
                                    <Building2 className="w-4 h-4 text-slate-400" />
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-slate-900 mb-1 leading-tight group-hover:text-emerald-600 transition-colors">
                                {demanda.titulo}
                            </h3>
                            <p className="text-xs text-slate-400 mb-6 font-medium">
                                Prazo: {demanda.data_entrega && !isNaN(new Date(demanda.data_entrega).getTime())
                                    ? new Date(demanda.data_entrega).toLocaleDateString('pt-BR')
                                    : 'A combinar'}
                            </p>

                            <div className="mt-auto space-y-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Volume Desejado</p>
                                        <p className="text-sm font-black text-slate-700">{demanda.quantidade_total} {demanda.unidade}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Remuneração Base</p>
                                        <p className="text-sm font-black text-emerald-600">R$ {demanda.preco_referencia?.toFixed(2) || '---'}</p>
                                    </div>
                                </div>

                                <button 
                                    onClick={() => {
                                        setSelectedDemanda(demanda);
                                        setIsDetailModalOpen(true);
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group-hover:bg-emerald-600"
                                >
                                    Ver Detalhes
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Detalhes da Demanda */}
            {isDetailModalOpen && selectedDemanda && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto transform animate-in zoom-in-95 duration-300">
                        <div className="p-6 md:p-8 border-b border-slate-50 relative bg-emerald-600 text-white">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-4 mb-2 md:mb-4">
                                <div className="w-10 h-10 md:w-14 md:h-14 bg-white/20 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center">
                                    <Box className="w-5 h-5 md:w-8 md:h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg md:text-2xl font-black leading-tight">{selectedDemanda.titulo}</h3>
                                    <span className="px-2 py-0.5 bg-white/20 text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-full">
                                        {selectedDemanda.cultura}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div className="space-y-6">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Especificações</p>
                                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                                        <div className="p-3 md:p-4 bg-slate-50 rounded-[20px] md:rounded-[24px] border border-slate-100">
                                            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-tighter">Modalidade</p>
                                            <p className="text-xs md:text-sm font-black text-slate-700">{selectedDemanda.modalidade_exigida}</p>
                                        </div>
                                        <div className="p-3 md:p-4 bg-slate-50 rounded-[20px] md:rounded-[24px] border border-slate-100">
                                            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-tighter">Volume Total</p>
                                            <p className="text-xs md:text-sm font-black text-slate-700">{selectedDemanda.quantidade_total} {selectedDemanda.unidade}</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Financeiro e Prazo</p>
                                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                                        <div className="p-3 md:p-4 bg-emerald-50 rounded-[20px] md:rounded-[24px] border border-emerald-100">
                                            <p className="text-[9px] md:text-[10px] text-emerald-600 font-black uppercase tracking-tighter">Preço Base</p>
                                            <p className="text-base md:text-lg font-black text-emerald-700">R$ {selectedDemanda.preco_referencia?.toFixed(2) || '---'}</p>
                                            <p className="text-[8px] md:text-[9px] text-emerald-500 font-bold">por {selectedDemanda.unidade}</p>
                                        </div>
                                        <div className="p-3 md:p-4 bg-slate-50 rounded-[20px] md:rounded-[24px] border border-slate-100">
                                            <p className="text-[9px] md:text-[10px] text-slate-400 font-black uppercase tracking-tighter">Entrega até</p>
                                            <p className="text-xs md:text-sm font-black text-slate-700">{new Date(selectedDemanda.data_entrega).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col">
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-3">Descrição / Observações</p>
                                <div className="flex-1 p-5 md:p-6 bg-slate-50 rounded-[24px] md:rounded-[32px] border border-slate-100 text-xs md:text-sm text-slate-600 leading-relaxed font-medium italic">
                                    {selectedDemanda.descricao || "Nenhuma observação técnica fornecida pela cooperativa para este contrato."}
                                </div>
                            </div>
                        </div>

                        <div className="p-6 md:p-8 border-t border-slate-50 bg-slate-50/50 flex flex-col md:flex-row gap-3 md:gap-4">
                            <button
                                onClick={() => setIsDetailModalOpen(false)}
                                className="flex-1 py-3 md:py-4 text-slate-400 font-black text-[10px] md:text-xs uppercase tracking-widest hover:text-slate-600 transition-colors order-2 md:order-1"
                            >
                                Voltar ao Mural
                            </button>
                            <button
                                onClick={() => {
                                    setIsDetailModalOpen(false);
                                }}
                                className="flex-[2] py-3 md:py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-600/20 active:scale-95 order-1 md:order-2"
                            >
                                Iniciar Oferta
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Oferta */}
            {selectedDemanda && !isDetailModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-slate-900/60 backdrop-blur-sm transition-all animate-in fade-in duration-300">
                    <div className="bg-white rounded-[32px] md:rounded-[40px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto transform animate-in zoom-in-95 duration-300">
                        <form onSubmit={handleOfertar}>
                            <div className="p-8 border-b border-slate-50 relative">
                                <button
                                    type="button"
                                    onClick={() => setSelectedDemanda(null)}
                                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                                    <Sprout className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 leading-tight">
                                    Ofertar {selectedDemanda.cultura}
                                </h3>
                                <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-widest">
                                    Para: {selectedDemanda.titulo}
                                </p>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                                    <p className="text-[11px] text-amber-800 font-medium">
                                        Ao ofertar, você manifesta interesse em comprometer parte da sua safra para este contrato. A cooperativa entrará em contato para confirmar.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Volume que você pode entregar ({selectedDemanda.unidade})</label>
                                    <input
                                        required
                                        type="number"
                                        placeholder="0.00"
                                        value={volumeOferta}
                                        onChange={(e) => setVolumeOferta(e.target.value)}
                                        className="w-full px-6 py-5 bg-slate-50 border-none rounded-[24px] text-lg font-black text-slate-900 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="p-8 bg-slate-50/50 flex flex-col gap-3">
                                <button
                                    disabled={ofertando}
                                    type="submit"
                                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[24px] text-xs font-black uppercase tracking-[0.15em] transition-all shadow-xl shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                                >
                                    {ofertando ? (
                                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                    ) : (
                                        'Confirmar Intenção'
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDemanda(null)}
                                    className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600 transition-colors"
                                >
                                    Voltar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MuralDemandas;
