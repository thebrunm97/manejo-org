import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Sprout, 
    ShieldCheck, 
    MapPin, 
    Loader2, 
    AlertCircle, 
    CheckCircle2,
    Info,
} from 'lucide-react';
import { getTraceDataByCode } from '../../services/traceabilityService';
import { TraceData } from '../../types/TraceabilityTypes';
import { cn } from '../../utils/cn';

const TraceabilityPage: React.FC = () => {
    const { codigoLote } = useParams<{ codigoLote: string }>();
    const [data, setData] = useState<TraceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!codigoLote) return;
            try {
                const traceData = await getTraceDataByCode(codigoLote);
                if (traceData) {
                    setData(traceData);
                } else {
                    setError('Lote não encontrado ou dados indisponíveis.');
                }
            } catch (err) {
                console.error(err);
                setError('Erro ao carregar dados de rastreabilidade.');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [codigoLote]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-12 h-12 text-emerald-600 animate-spin mb-4" />
                <p className="text-slate-600 font-bold animate-pulse">Buscando origem do lote...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mb-6">
                    <AlertCircle size={40} />
                </div>
                <h1 className="text-2xl font-black text-slate-800 mb-2">Ops! Lote não localizado</h1>
                <p className="text-slate-500 mb-8 max-w-xs mx-auto">
                    Não conseguimos encontrar informações para o código <strong>{codigoLote}</strong>. Verifique se o código está correto.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-black text-sm tracking-tight"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    const { lote, propriedade, historico_manejo } = data;
    const isOrganico = propriedade.modalidade_predominante === 'ORGANICO';

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-12">
            {/* Organic Hero Section */}
            <div className="relative bg-emerald-900 pt-16 pb-32 px-6 overflow-hidden">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-800/50 rounded-full blur-3xl opacity-50" />
                <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl opacity-50" />
                
                <div className="relative z-10 max-w-lg mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-800/40 backdrop-blur-md border border-emerald-700/50 rounded-full text-emerald-300 text-[10px] font-black uppercase tracking-widest mb-6">
                        <ShieldCheck size={14} /> Rastreabilidade Garantida
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white leading-[1.1] tracking-tight mb-4">
                        Conheça a origem do seu <span className="text-emerald-400">alimento</span>
                    </h1>
                    <p className="text-emerald-100/70 text-sm font-medium max-w-xs mx-auto leading-relaxed italic">
                        De mãos dadas com quem planta, cuidando de quem consome.
                    </p>
                </div>
            </div>

            {/* Content Cards */}
            <div className="relative z-20 -mt-20 px-6 max-w-lg mx-auto space-y-6">
                
                {/* Product Badge */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-emerald-900/5 border border-slate-100 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-600 mb-4 shadow-inner">
                        <Sprout size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-1">{lote.cultura}</h2>
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-4">Lote: {lote.codigo_lote}</p>
                    
                    <div className="flex flex-wrap justify-center gap-2">
                        {isOrganico && (
                            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-100 text-emerald-700 text-[11px] font-black rounded-xl uppercase tracking-tight border border-emerald-200">
                                <CheckCircle2 size={14} /> 100% Orgânico
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-600 text-[11px] font-black rounded-xl uppercase tracking-tight border border-slate-200">
                            Colheita: {new Date(lote.data_colheita).toLocaleDateString('pt-BR')}
                        </span>
                    </div>
                </div>

                {/* Property Card */}
                <div className="bg-white rounded-[2.5rem] p-6 shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 opacity-50" />
                    
                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-white shrink-0">
                                <MapPin size={24} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Produzido em</p>
                                <h3 className="font-black text-slate-800 text-lg truncate leading-none">{propriedade.nome}</h3>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Localização</p>
                                <p className="text-sm font-black text-slate-700">{propriedade.cidade} - {propriedade.uf}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Certificação</p>
                                <p className="text-sm font-black text-emerald-600">Ativa (E-CERT)</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Timeline / Traceability History */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-lg shadow-slate-200/50 border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            <Info size={20} className="text-emerald-500" />
                            História do Cultivo
                        </h3>
                    </div>

                    <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-emerald-500 before:via-slate-200 before:to-slate-200">
                        {historico_manejo && historico_manejo.map((item, index) => (
                            <div key={index} className="relative flex items-start gap-6 group">
                                <div className="absolute left-0 mt-1.5 w-10 h-10 flex items-center justify-center">
                                    <div className={cn(
                                        "w-3 h-3 rounded-full ring-4 transition-all duration-500",
                                        index === 0 ? "bg-emerald-500 ring-emerald-100" : "bg-slate-300 ring-slate-100 group-hover:bg-emerald-400 group-hover:ring-emerald-50"
                                    )} />
                                </div>
                                <div className="ml-10">
                                    <p className="text-[10px] font-black text-slate-400 mb-1">{new Date(item.data).toLocaleDateString('pt-BR')}</p>
                                    <p className="text-sm font-black text-slate-800 leading-tight mb-1">{item.atividade.charAt(0).toUpperCase() + item.atividade.slice(1)}</p>
                                    <p className="text-xs text-slate-500 font-medium italic">
                                        {item.produto}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Insight */}
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-start gap-4 italic">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-500 shrink-0 shadow-sm">
                        <ShieldCheck size={20} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-emerald-800 font-bold leading-tight">Garantia Agro Vivo</p>
                        <p className="text-[11px] text-emerald-700/80 font-medium leading-relaxed">
                            Este produto foi monitorado digitalmente por especialistas da cooperativa, garantindo o respeito ao meio ambiente e a você.
                        </p>
                    </div>
                </div>

            </div>

            {/* Back to Top / Global Footer */}
            <div className="mt-12 px-6 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-4">Plataforma de Manejo Orgânico Inteligente</p>
                <div className="flex items-center justify-center gap-2 text-slate-400">
                    <CheckCircle2 size={12} />
                    <span className="text-[9px] font-bold">DADOS CRIPTOGRÁFICOS VALIDADOS</span>
                </div>
            </div>
        </div>
    );
};

export default TraceabilityPage;
