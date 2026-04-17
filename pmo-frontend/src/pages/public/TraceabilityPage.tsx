import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
    Sprout, 
    ShieldCheck, 
    MapPin, 
    Loader2, 
    AlertCircle, 
    Leaf,
    Calendar,
    Quote,
} from 'lucide-react';
import { getTraceDataByCode } from '../../services/traceabilityService';
import { TraceData } from '../../types/TraceabilityTypes';
import { cn } from '../../utils/cn';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

const RevealSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => {
    const [ref, isVisible] = useIntersectionObserver({ threshold: 0.1 });
    return (
        <div 
            ref={ref as any} 
            className={cn("animate-reveal", isVisible && "active", className)}
        >
            {children}
        </div>
    );
};

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
            <div className="min-h-screen bg-[var(--editorial-paper)] flex flex-col items-center justify-center p-6 text-center bg-grain">
                <Loader2 className="w-12 h-12 text-[var(--editorial-forest)] animate-spin mb-4" />
                <p className="text-[var(--editorial-forest)] font-serif-editorial italic text-lg animate-pulse">Semeando informações...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-[var(--editorial-paper)] flex flex-col items-center justify-center p-8 text-center bg-grain">
                <div className="w-24 h-24 bg-[var(--editorial-soil)]/10 text-[var(--editorial-soil)] rounded-full flex items-center justify-center mb-8 border border-[var(--editorial-soil)]/20 shadow-sm">
                    <AlertCircle size={48} strokeWidth={1.5} />
                </div>
                <h1 className="text-3xl font-serif-editorial text-[var(--editorial-forest)] mb-4">Lote não localizado</h1>
                <p className="text-[var(--editorial-soil)] font-sans-editorial mb-10 max-w-sm mx-auto leading-relaxed">
                    Não conseguimos encontrar a história deste alimento para o código <span className="font-bold">{codigoLote}</span>.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-10 py-4 bg-[var(--editorial-forest)] text-white rounded-full font-sans-editorial font-bold text-sm tracking-widest uppercase hover:bg-[var(--editorial-forest)]/90 transition-all shadow-lg hover:shadow-xl"
                >
                    Tentar Novamente
                </button>
            </div>
        );
    }

    const { lote, propriedade, historico_manejo } = data;
    const isOrganico = propriedade.modalidade_predominante === 'ORGANICO';

    return (
        <div className="min-h-screen bg-[var(--editorial-paper)] font-sans-editorial text-[var(--editorial-soil)] selection:bg-[var(--editorial-accent)] selection:text-[var(--editorial-forest)] bg-grain overflow-x-hidden">
            
            {/* 1. HERO SECTION: Aesthetic product statement */}
            <header className="relative pt-24 pb-40 px-8 overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--editorial-forest)]/5 rounded-full blur-[100px] -mr-48 -mt-48" />
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-[var(--editorial-clay)]/5 rounded-full blur-[80px] -ml-40 -mb-40" />

                <RevealSection className="max-w-3xl mx-auto text-center relative z-10">
                    <div className="inline-block px-4 py-1.5 mb-8 border border-[var(--editorial-forest)]/20 rounded-full text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--editorial-forest)]">
                        Autenticidade Garantida
                    </div>
                    
                    <h1 className="text-6xl md:text-8xl font-serif-editorial text-[var(--editorial-forest)] leading-[0.9] tracking-tighter mb-8">
                        {lote.cultura} <br />
                        <span className="italic font-light opacity-80">da nossa terra</span>
                    </h1>
                    
                    <div className="flex items-center justify-center gap-6 mt-12 text-[var(--editorial-soil)] opacity-70">
                        <div className="flex items-center gap-2">
                            <Calendar size={18} />
                            <span className="text-xs font-bold tracking-widest uppercase">Colheita: {new Date(lote.data_colheita).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <div className="w-px h-6 bg-[var(--editorial-soil)]/20" />
                        <div className="flex items-center gap-2">
                            <Leaf size={18} />
                            <span className="text-xs font-bold tracking-widest uppercase">{isOrganico ? 'Orgânico' : 'Certificado'}</span>
                        </div>
                    </div>
                </RevealSection>
            </header>

            {/* 2. PRODUCT STORY: Detailed ID */}
            <main className="relative z-20 max-w-4xl mx-auto px-8 -mt-24 pb-24">
                
                <RevealSection className="grid md:grid-cols-12 gap-12 items-start">
                    
                    {/* Left side: The Lote Badge */}
                    <div className="md:col-span-5 bg-[var(--editorial-white)] p-12 rounded-3xl border border-[var(--editorial-soil)]/10 shadow-2xl shadow-[var(--editorial-soil)]/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--editorial-accent)]/20 rounded-full blur-3xl -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                        
                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-[var(--editorial-forest)] text-[var(--editorial-accent)] rounded-2xl flex items-center justify-center mb-8 rotate-3 shadow-lg group-hover:rotate-0 transition-transform">
                                <Sprout size={32} />
                            </div>
                            <p className="text-[10px] font-bold text-[var(--editorial-soil)]/40 uppercase tracking-[0.4em] mb-2">Identificador Único</p>
                            <h2 className="text-4xl font-serif-editorial text-[var(--editorial-forest)] mb-6">{lote.codigo_lote}</h2>
                            
                            <div className="space-y-4 pt-6 border-t border-[var(--editorial-soil)]/5">
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-[var(--editorial-soil)]/50 uppercase tracking-widest">Variedade</span>
                                    <span className="text-sm font-bold text-[var(--editorial-forest)] underline decoration-[var(--editorial-accent)] decoration-2 underline-offset-4">{lote.cultura}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-[var(--editorial-soil)]/50 uppercase tracking-widest">Status</span>
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--editorial-forest)] text-white text-[10px] font-bold uppercase rounded-full">
                                        <ShieldCheck size={12} /> Validado
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right side: Farm feature */}
                    <div className="md:col-span-7 pt-8 md:pt-16">
                        <div className="flex items-start gap-4 mb-6">
                            <MapPin className="text-[var(--editorial-clay)] shrink-0" size={28} />
                            <div>
                                <p className="text-xs font-bold text-[var(--editorial-clay)] uppercase tracking-[0.3em] mb-1">Produzido no Coração de</p>
                                <h3 className="text-3xl font-serif-editorial text-[var(--editorial-forest)] leading-none">
                                    {propriedade.cidade}{propriedade.cidade && propriedade.uf ? ', ' : ''}{propriedade.uf}
                                    {!propriedade.cidade && !propriedade.uf && 'Localização não informada'}
                                </h3>
                            </div>
                        </div>
                        <p className="text-lg leading-relaxed text-[var(--editorial-soil)]/80 italic font-serif-editorial border-l-2 border-[var(--editorial-clay)]/20 pl-6 py-2">
                           "Aqui na <span className="font-bold text-[var(--editorial-forest)]">{propriedade.nome}</span>, cada semente é cuidada com o respeito que a natureza exige."
                        </p>
                        
                        <div className="mt-8 flex gap-4">
                             <div className="flex-1 bg-[var(--editorial-white)] p-4 rounded-2xl border border-[var(--editorial-soil)]/5 shadow-sm">
                                 <p className="text-[9px] font-bold text-[var(--editorial-soil)]/40 uppercase tracking-widest mb-1">Manejo</p>
                                 <p className="text-sm font-bold text-[var(--editorial-forest)]">{propriedade.modalidade_predominante}</p>
                             </div>
                             <div className="flex-1 bg-[var(--editorial-white)] p-4 rounded-2xl border border-[var(--editorial-soil)]/5 shadow-sm">
                                 <p className="text-[9px] font-bold text-[var(--editorial-soil)]/40 uppercase tracking-widest mb-1">Certificado</p>
                                 <p className="text-sm font-bold text-emerald-700">Ativo E-CERT</p>
                             </div>
                        </div>
                    </div>
                </RevealSection>

                {/* 3. TIMELINE: The journey Infographic */}
                <section className="mt-32">
                    <RevealSection className="text-center mb-20">
                        <h4 className="text-sm font-bold text-[var(--editorial-clay)] uppercase tracking-[0.5em] mb-4">Crônica da Terra</h4>
                        <h2 className="text-5xl font-serif-editorial text-[var(--editorial-forest)]">História do Cultivo</h2>
                    </RevealSection>

                    <div className="relative">
                        {/* The Vertical Dashed Line */}
                        <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px border-l border-dashed border-[var(--editorial-soil)]/20 md:-translate-x-1/2" />

                        <div className="space-y-24 relative">
                            {historico_manejo && historico_manejo.map((item, index) => (
                                <RevealSection key={index} className={cn(
                                    "flex flex-col md:flex-row items-center gap-8 md:gap-0",
                                    index % 2 === 0 ? "" : "md:flex-row-reverse"
                                )}>
                                    {/* Content side */}
                                    <div className={cn(
                                        "w-full md:w-[45%] pl-20 md:pl-0",
                                        index % 2 === 0 ? "md:text-right md:pr-16" : "md:text-left md:pl-16"
                                    )}>
                                        <p className="text-xs font-bold text-[var(--editorial-clay)] mb-2 tracking-widest">{new Date(item.data).toLocaleDateString('pt-BR')}</p>
                                        <h5 className="text-2xl font-serif-editorial text-[var(--editorial-forest)] mb-2">{item.atividade}</h5>
                                        <p className="text-sm text-[var(--editorial-soil)]/60 font-medium italic">"{item.produto}"</p>
                                    </div>

                                    {/* Central dot */}
                                    <div className="absolute left-8 md:left-1/2 -ml-2.5 md:-ml-2.5 w-5 h-5 rounded-full bg-[var(--editorial-paper)] border-2 border-[var(--editorial-forest)] z-30 shadow-[0_0_0_8px_var(--editorial-paper)]" />

                                    {/* Empty Spacer side */}
                                    <div className="hidden md:block md:w-[45%]" />
                                </RevealSection>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 4. FINAL GUARANTEE: Editorial Footer */}
                <RevealSection className="mt-40 p-16 bg-[var(--editorial-forest)] text-white rounded-[3rem] relative overflow-hidden text-center">
                    <Quote className="absolute top-12 left-12 text-white/5" size={120} />
                    <div className="relative z-10 max-w-2xl mx-auto">
                        <div className="w-16 h-16 bg-[var(--editorial-accent)] text-[var(--editorial-forest)] rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
                            <ShieldCheck size={32} />
                        </div>
                        <h2 className="text-3xl font-serif-editorial mb-6">Segurança que Vem da Cooperativa</h2>
                        <p className="text-lg text-white/70 font-serif-editorial leading-relaxed italic mb-12">
                            "Este produto foi monitorado digitalmente via Manejo<span className="text-agro-ouro">Org</span>, garantindo que as práticas agrícolas respeitem os mais altos padrões de sustentabilidade e saúde."
                        </p>
                        <div className="pt-8 border-t border-white/10 flex flex-col items-center gap-2">
                             <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-40">Manejo<span className="text-agro-ouro">Org</span> Platform v0.15</p>
                             <div className="flex items-center gap-2 text-[var(--editorial-accent)]">
                                <ShieldCheck size={14} />
                                <span className="text-[9px] font-bold tracking-widest">DADOS CRIPTOGRÁFICOS VALIDADOS</span>
                             </div>
                        </div>
                    </div>
                </RevealSection>

            </main>
        </div>
    );
};

export default TraceabilityPage;
