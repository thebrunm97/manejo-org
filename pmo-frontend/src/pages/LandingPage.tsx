import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Tractor,
    MessageSquare,
    ArrowRight,
    TrendingUp,
    Zap,
    Send,
    Map,
    Bot,
    LineChart,
    Edit3,
    Trash2,
    Layers,
    Beaker,
    MapPin,
    Users,
    Settings,
    Plus,
    Maximize2,
    LocateFixed,
    Sun
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ==========================================================================
// 1. COMPONENTE DE CONTADOR ANIMADO DINÂMICO
// ==========================================================================
interface AnimatedCounterProps {
    target: number;
    suffix?: string;
    duration?: number;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ target, suffix = '', duration = 1500 }) => {
    const [count, setCount] = useState(0);
    const elementRef = useRef<HTMLSpanElement>(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    
                    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    if (prefersReduced) {
                        setCount(target);
                        return;
                    }

                    const startTime = performance.now();
                    const animate = (currentTime: number) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const easeOutProgress = progress * (2 - progress);
                        const currentValue = Math.floor(easeOutProgress * target);

                        setCount(currentValue);

                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            setCount(target);
                        }
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.1 }
        );

        if (elementRef.current) observer.observe(elementRef.current);
        return () => {
            if (elementRef.current) observer.unobserve(elementRef.current);
        };
    }, [target, duration]);

    return (
        <span ref={elementRef} className="font-serif text-5xl lg:text-6xl text-agro-floresta font-bold tracking-tight">
            {count}{suffix}
        </span>
    );
};

// ==========================================================================
// 2. MOCKUP DE DISPOSITIVO HÍBRIDO OVERLAPPING (HERO)
// ==========================================================================
const HeroVisualStack: React.FC = () => {
    const [chatStep, setChatStep] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry.isIntersecting) {
                    setTimeout(() => setChatStep(1), 600);
                    setTimeout(() => setChatStep(2), 2200);
                    setTimeout(() => setChatStep(3), 3800);
                    setTimeout(() => setChatStep(4), 5400);
                }
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => {
            if (containerRef.current) observer.unobserve(containerRef.current);
        };
    }, []);

    return (
        <div ref={containerRef} className="relative flex flex-col lg:block items-center gap-10 lg:gap-0 w-full max-w-2xl mx-auto h-auto lg:h-[500px]">
            <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>

            {/* MOCKUP 1: Dashboard da Aplicação */}
            <div className="relative lg:absolute lg:left-0 lg:top-6 w-[95%] sm:w-[85%] lg:w-[85%] bg-white rounded-2xl border border-agro-floresta/10 shadow-2xl overflow-hidden transition-all duration-700 hover:scale-[1.01] lg:-rotate-2 origin-bottom-left z-10 order-2">
                <div className="bg-agro-floresta/5 px-4 py-3 border-b border-agro-floresta/10 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                    <span className="text-[10px] text-agro-floresta/30 ml-4 font-mono font-medium">app.manejo.org</span>
                </div>
                
                <div className="grid grid-cols-4 h-72">
                    <div className="col-span-1 bg-agro-floresta/5 p-3 border-r border-agro-floresta/10 flex flex-col gap-2">
                        <div className="h-5 w-full bg-agro-floresta/10 rounded"></div>
                        <div className="h-3.5 w-[85%] bg-agro-floresta/10 rounded"></div>
                        <div className="h-3.5 w-[65%] bg-agro-floresta/10 rounded"></div>
                        <div className="h-3.5 w-[75%] bg-agro-floresta/10 rounded"></div>
                    </div>
                    
                    <div className="col-span-3 p-4 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <div className="h-4.5 w-24 bg-agro-floresta/25 rounded"></div>
                            <div className="h-5 w-16 bg-agro-ouro/20 text-agro-ouro text-[9px] font-bold rounded-full flex items-center justify-center">Safra Ativa</div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 border border-agro-floresta/5 rounded-xl bg-agro-creme/30">
                                <div className="h-2.5 w-10 bg-agro-floresta/20 rounded mb-2"></div>
                                <div className="h-4 w-14 bg-agro-floresta rounded"></div>
                            </div>
                            <div className="p-3 border border-agro-floresta/5 rounded-xl bg-agro-creme/30">
                                <div className="h-2.5 w-14 bg-agro-floresta/20 rounded mb-2"></div>
                                <div className="h-4 w-10 bg-agro-ouro rounded"></div>
                            </div>
                        </div>
                        
                        <div className="border border-agro-floresta/5 p-3 rounded-xl flex-grow flex flex-col justify-end bg-agro-creme/10 relative">
                            <div className="absolute top-2 left-2 h-2.5 w-20 bg-agro-floresta/10 rounded"></div>
                            <svg className="w-full h-14 text-agro-ouro/40" viewBox="0 0 200 60" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="heroChartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--color-agro-ouro)" stopOpacity="0.3" />
                                        <stop offset="100%" stopColor="var(--color-agro-ouro)" stopOpacity="0.0" />
                                    </linearGradient>
                                </defs>
                                <path d="M 0 50 Q 30 25, 60 38 T 120 18 T 180 12 L 200 10 L 200 60 L 0 60 Z" fill="url(#heroChartGrad)" />
                                <path d="M 0 50 Q 30 25, 60 38 T 120 18 T 180 12 L 200 10" fill="none" stroke="var(--color-agro-ouro)" strokeWidth="2" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* MOCKUP 2: Interface de Chat do WhatsApp */}
            <div className="relative lg:absolute lg:right-0 xl:lg:right-4 lg:bottom-0 w-[300px] lg:w-[320px] bg-[#efeae2] rounded-[36px] border-[8px] border-slate-900 shadow-2xl overflow-hidden z-20 transition-all duration-700 hover:scale-[1.02] lg:rotate-2 order-1">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-5 bg-slate-900 rounded-b-xl z-30"></div>
                
                <div className="bg-[#075e54] pt-6 pb-3 px-4 flex items-center gap-3 text-white relative z-25">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-serif font-bold text-white border border-white/10">
                        MO
                    </div>
                    <div>
                        <div className="text-sm font-bold font-sans tracking-wide leading-tight">Argo</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-[10px] text-emerald-100 font-sans font-medium">online 24/7</span>
                        </div>
                    </div>
                </div>

                <div className="p-4 h-80 overflow-y-auto flex flex-col gap-4 scrollbar-none scroll-smooth">
                    {chatStep >= 1 && (
                        <div className="self-end bg-[#d9fdd3] text-slate-800 text-xs p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] border border-[#cbd8cb]/30 animate-fade-in-up">
                            Posso aplicar calda bordalesa no tomateiro hoje?
                            <div className="text-[9px] text-right mt-1.5 text-slate-500 font-semibold">10:42</div>
                        </div>
                    )}

                    {chatStep >= 2 && (
                        <div className="self-start bg-white text-slate-800 text-xs leading-relaxed p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] border border-slate-200 animate-fade-in-up">
                            👨🏻‍🌾 <strong>Olá!</strong> A previsão aponta chuva intensa (25mm) para as próximas 4 horas na sua região. Recomendo aguardar até amanhã cedo para evitar a lavagem do produto.
                            <div className="text-[9px] text-right mt-1.5 text-slate-400">10:42</div>
                        </div>
                    )}

                    {chatStep >= 3 && (
                        <div className="self-end bg-[#d9fdd3] text-slate-800 text-xs p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] border border-[#cbd8cb]/30 animate-fade-in-up">
                            Certo. E como está a margem da Safra 3?
                            <div className="text-[9px] text-right mt-1.5 text-slate-500 font-semibold">10:43</div>
                        </div>
                    )}

                    {chatStep >= 4 && (
                        <div className="self-start bg-white text-slate-800 text-xs leading-relaxed p-3 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] border border-slate-200 animate-fade-in-up">
                            📈 <strong>Atualização:</strong> A Safra 3 está com margem de 42% (R$ 18.500 de lucro projetado). Deseja ver o relatório completo no painel?
                            <div className="text-[9px] text-right mt-1.5 text-slate-400">10:43</div>
                        </div>
                    )}
                </div>

                <div className="bg-white p-3 flex items-center gap-3 border-t border-slate-200">
                    <div className="flex-grow bg-slate-100 rounded-full px-4 py-2 flex items-center text-xs text-slate-400">
                        Mensagem...
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#075e54] text-white flex items-center justify-center cursor-pointer hover:bg-[#064e46] transition-colors">
                        <Send size={16} className="ml-1" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================================================
// 3. COMPONENTE DE PROCESSO "HOW IT WORKS" INSPIRADO NA REFERÊNCIA (3 PASSOS NO-SENSOR)
// ==========================================================================
const HowItWorksSection: React.FC = () => {
    return (
        <section className="py-24 relative overflow-hidden bg-white border-t border-agro-floresta/5">
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-20">
                    <span className="inline-block text-agro-ouro font-bold tracking-[0.2em] uppercase text-xs mb-4 px-4 py-1.5 border border-agro-ouro/20 rounded-full bg-agro-ouro/5">
                        Como Funciona
                    </span>
                    <h2 className="text-4xl lg:text-5xl text-agro-floresta tracking-tight leading-tight font-serif">
                        Comece em minutos. <br />
                        <span className="italic font-normal">Sem sensores complexos.</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
                    {/* Passo 1 */}
                    <div className="flex flex-col items-center text-center group">
                        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm border border-emerald-100">
                            <Map size={36} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl text-agro-floresta font-bold mb-3 font-serif">1. Planeje e Mapeie</h3>
                        <p className="text-agro-floresta/70 leading-relaxed text-sm">
                            Mapeie seus talhões e crie seu Plano de Manejo Orgânico (PMO) em minutos. Diga adeus às planilhas soltas e defina seu ciclo de produção de forma simples e visual.
                        </p>
                    </div>

                    {/* Passo 2 */}
                    <div className="flex flex-col items-center text-center group">
                        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm border border-emerald-100">
                            <MessageSquare size={36} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl text-agro-floresta font-bold mb-3 font-serif">2. Caderno de Campo via Áudio</h3>
                        <p className="text-agro-floresta/70 leading-relaxed text-sm">
                            Esqueça as pranchetas de papel. Mande um áudio no WhatsApp: <em>"Apliquei 2 litros de calda sulfocálcica no talhão 3"</em>. O Argo estrutura o dado no seu caderno automaticamente, pronto para auditoria.
                        </p>
                    </div>

                    {/* Passo 3 */}
                    <div className="flex flex-col items-center text-center group">
                        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-500 shadow-sm border border-emerald-100">
                            <LineChart size={36} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-2xl text-agro-floresta font-bold mb-3 font-serif">3. Gestão e Controle Total</h3>
                        <p className="text-agro-floresta/70 leading-relaxed text-sm">
                            Da rastreabilidade ao controle financeiro. Suas dúvidas agronômicas são respondidas em tempo real enquanto seus registros diários viram dashboards visuais com a saúde da sua fazenda.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ==========================================================================
// 4. MOCKUP INTERATIVO DE MAPA E SAÚDE DO SOLO
// ==========================================================================
const MapInteractiveMockup: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'estrutura' | 'saude'>('estrutura');
    
    return (
        <div className="w-full aspect-[4/3] sm:aspect-video xl:aspect-[4/3] relative group">
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden border border-agro-creme/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] bg-[#2a3c30]">
                {/* Fundo do Mapa (Satélite Simulado) - Foto aérea de fazenda vista de cima */}
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1595185984429-23133b3d11b5?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center transition-transform duration-1000 group-hover:scale-105 opacity-90 mix-blend-luminosity"></div>
                
                {/* Camada de Cor base */}
                <div className="absolute inset-0 bg-emerald-900/20 mix-blend-color"></div>

                {/* Polígonos Simulados Desenhados no Mapa (SVG) */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* Talhão 2 (Background) */}
                    <polygon 
                        points="10,25 35,20 45,65 15,75" 
                        className="fill-blue-400/20 stroke-blue-400 stroke-[0.3] pointer-events-auto transition-all duration-500 hover:fill-blue-400/40 cursor-pointer"
                    />
                    {/* Talhão 1 (Active) */}
                    <polygon 
                        points="40,22 85,15 90,55 48,70" 
                        className="fill-yellow-400/30 stroke-yellow-400 stroke-[0.5] drop-shadow-[0_0_10px_rgba(250,204,21,0.4)] pointer-events-auto transition-all duration-500 hover:fill-yellow-400/50 cursor-pointer"
                    />
                    {/* Talhão 3 (Background) */}
                    <polygon 
                        points="50,75 85,60 95,90 60,95" 
                        className="fill-emerald-400/20 stroke-emerald-400 stroke-[0.3] pointer-events-auto transition-all duration-500 hover:fill-emerald-400/40 cursor-pointer"
                    />
                </svg>
                
                {/* Talhão 1 Label */}
                <div className="absolute top-[45%] left-[65%] transform -translate-x-1/2 -translate-y-1/2 bg-white text-slate-800 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-pulse z-10 cursor-pointer hover:scale-105 transition-transform">
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                    Talhão 1
                </div>

                {/* Toggle superior esquerdo */}
                <div className="absolute top-4 left-4 flex bg-white/95 backdrop-blur-md rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.1)] p-1 text-[10px] font-bold z-10 border border-white">
                    <div className="px-4 py-1.5 text-slate-500 cursor-pointer hover:text-slate-800 transition-colors">CROQUI</div>
                    <div className="px-4 py-1.5 bg-emerald-600 text-white rounded-full cursor-default shadow-sm">SATÉLITE</div>
                </div>
            </div>

            {/* Painel Flutuante do Mockup */}
            <div className="absolute top-[10%] right-0 md:-right-8 lg:-right-12 w-[280px] sm:w-[320px] bg-[#f8f7f4] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col transform transition-all duration-700 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 border border-slate-200 z-20 origin-top-right scale-[0.85] sm:scale-95 md:scale-100">
                {/* Header do Card */}
                <div className="p-5 pb-4 border-b border-slate-200/60">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-yellow-400/20 flex items-center justify-center text-yellow-600">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <h4 className="font-serif font-bold text-slate-800 text-lg leading-none">Talhão 1</h4>
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase mt-1 block">Feijão • 1,37 HA</span>
                            </div>
                        </div>
                        <div className="flex gap-2 text-slate-400">
                            <button className="hover:text-emerald-600 transition-colors"><Edit3 size={16} /></button>
                            <button className="hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-slate-200/50 p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('estrutura')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'estrutura' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Layers size={14} /> Estrutura
                        </button>
                        <button 
                            onClick={() => setActiveTab('saude')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'saude' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Beaker size={14} /> Saúde Solo
                        </button>
                    </div>
                </div>

                {/* Conteúdo da Tab */}
                <div className="p-5 flex-1 bg-white">
                    {activeTab === 'estrutura' ? (
                        <div className="animate-fade-in-up">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                        <Layers size={16} />
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Composição Física</div>
                                        <div className="font-bold text-slate-800 text-sm">Argiloso</div>
                                    </div>
                                </div>
                                <div className="opacity-10 text-slate-300"><Layers size={32} /></div>
                            </div>
                            
                            {/* Barra de Composição */}
                            <div className="h-2 w-full flex rounded-full overflow-hidden mb-4 bg-slate-100">
                                <div className="h-full bg-emerald-500 w-[55%]"></div>
                                <div className="h-full bg-yellow-400 w-[10%]"></div>
                                <div className="h-full bg-blue-400 w-[35%]"></div>
                            </div>
                            
                            {/* Legenda */}
                            <div className="flex justify-between text-center border-b border-slate-100 pb-5 mb-5">
                                <div>
                                    <div className="flex justify-center mb-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div></div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Argila</div>
                                    <div className="font-bold text-slate-700 text-sm">55%</div>
                                </div>
                                <div>
                                    <div className="flex justify-center mb-1"><div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div></div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Silte</div>
                                    <div className="font-bold text-slate-700 text-sm">10%</div>
                                </div>
                                <div>
                                    <div className="flex justify-center mb-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div></div>
                                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-0.5">Areia</div>
                                    <div className="font-bold text-slate-700 text-sm">35%</div>
                                </div>
                            </div>

                            {/* Cards Secundários */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 hover:border-orange-200 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">pH Solo <span className="font-normal">(H2O)</span></div>
                                        <div className="text-[8px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-center">REFINAR</div>
                                    </div>
                                    <div className="font-serif font-bold text-2xl text-slate-800">5.2</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 hover:border-emerald-200 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="text-[9px] font-bold text-slate-400 uppercase">V% <span className="font-normal">(Sat.)</span></div>
                                        <div className="text-[8px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded text-center">IDEAL</div>
                                    </div>
                                    <div className="font-serif font-bold text-2xl text-slate-800">60</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in-up flex flex-col items-center justify-center h-full text-slate-400 py-10">
                            <Beaker size={32} className="mb-3 opacity-20" />
                            <p className="text-sm font-medium">Análises em breve.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const MapFeatureSection: React.FC = () => {
    return (
        <section className="py-32 relative overflow-hidden bg-agro-floresta">
            {/* Background texture */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://images.unsplash.com/photo-1586771107584-568c07c6999b?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-agro-floresta via-agro-floresta/90 to-agro-floresta"></div>

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <div className="order-2 lg:order-1 relative">
                        {/* Real Map Mockup */}
                        <MapInteractiveMockup />
                    </div>

                    <div className="order-1 lg:order-2 max-w-xl">
                        <span className="inline-flex items-center gap-2 text-emerald-400 font-bold tracking-[0.2em] uppercase text-xs mb-6 px-4 py-1.5 border border-emerald-500/20 rounded-full bg-emerald-500/10">
                            <Map size={14} /> Inteligência Georreferenciada
                        </span>
                        
                        <h2 className="text-5xl lg:text-7xl text-agro-creme tracking-tight mb-8 font-serif font-bold leading-[1.05]">
                            Gestão visual de <br />
                            <span className="text-agro-ouro italic font-normal">cada palmo de terra.</span>
                        </h2>
                        
                        <p className="text-slate-300 text-lg leading-relaxed mb-8">
                            Tenha um mapa completo e interativo da sua propriedade. Selecione talhões, gerencie a saúde do solo (pH, argila, matéria orgânica) e acompanhe o desenvolvimento das culturas visualmente, tudo em um só lugar.
                        </p>

                        <ul className="flex flex-col gap-5 text-agro-creme/80">
                            <li className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-agro-ouro/20 flex items-center justify-center text-agro-ouro"><Zap size={14}/></div>
                                <span className="text-lg">Desenho de polígonos ultra-rápido</span>
                            </li>
                            <li className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-agro-ouro/20 flex items-center justify-center text-agro-ouro"><Zap size={14}/></div>
                                <span className="text-lg">Histórico de manejo por talhão</span>
                            </li>
                            <li className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-agro-ouro/20 flex items-center justify-center text-agro-ouro"><Zap size={14}/></div>
                                <span className="text-lg">Métricas de saúde e nutrição do solo</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ==========================================================================
// 5. AGRONOMY SHOWCASE & SOLUTIONS SECTIONS
// ==========================================================================

export function AgronomyShowcaseSection() {
  return (
      <section className="w-full max-w-[1400px] mx-auto px-6 pt-32 pb-48 relative">
        <div className="text-center mb-32 relative z-20">
          <span className="inline-flex items-center gap-2 text-agro-floresta font-bold tracking-[0.2em] uppercase text-xs mb-8 px-5 py-2 border border-agro-floresta/10 rounded-full bg-agro-creme shadow-sm">
              <Bot size={14} /> Inteligência Agronômica
          </span>
          <h1 className="text-6xl md:text-[5.5rem] font-serif font-bold tracking-tight mb-8 text-agro-floresta leading-[1.05]">
            Inteligência que <br /> <span className="italic text-agro-ouro font-normal">age com você.</span>
          </h1>
          <p className="text-xl md:text-2xl text-agro-floresta/70 max-w-3xl mx-auto leading-relaxed font-sans font-light">
            Não é apenas mais uma ferramenta de observação. O ManejoOrg trabalha ao lado da sua equipe todos os dias para calcular, prever e gerenciar sua produção orgânica.
          </p>
        </div>

        {/* 3-Column Floating Mockups */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 lg:gap-8 xl:gap-12 relative z-10 max-w-6xl mx-auto">
          {/* Organic Background Blobs */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-agro-ouro/10 rounded-full blur-[120px] -z-10 mix-blend-multiply"></div>
          <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-agro-floresta/5 rounded-full blur-[100px] -z-10 mix-blend-multiply"></div>
          
          {/* Mockup 1: Team & Calculation */}
          <div className="flex flex-col items-center h-full">
            <div className="w-[320px] h-[640px] bg-[#efeae2] rounded-[2.5rem] border-[8px] border-slate-900 shadow-2xl relative group overflow-hidden transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_40px_60px_-15px_rgba(0,0,0,0.2)]">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-40"></div>
              
              <div className="w-full h-full bg-white overflow-hidden flex flex-col pt-12 pb-6 px-5 relative text-agro-floresta">
                <div className="flex justify-between items-center mb-8 text-agro-floresta">
                  <ArrowRight className="w-6 h-6 rotate-180 text-slate-400" />
                  <div className="flex gap-5 text-slate-400">
                    <Users className="w-5 h-5" />
                    <Settings className="w-5 h-5" />
                  </div>
                </div>

                <h2 className="text-2xl font-serif font-bold mb-6 text-slate-800 leading-tight">Cálculo de Insumos ▾</h2>
                
                <div className="text-[15px] text-slate-600 space-y-6 mb-8 leading-relaxed">
                  <p className="flex items-start gap-2">
                    <span className="text-slate-300 mt-1">•</span> 
                    <span>Estimativa: R$ 1000-1200 com base no mercado local.</span>
                  </p>
                  <div>
                    <p className="font-bold text-slate-800 mb-1">Por que essa dose?</p>
                    <p>Com base na análise de solo recente, subtraímos 20% das reservas do solo. Ajustado para certificação orgânica.</p>
                  </div>
                </div>

                <div className="mt-auto z-10">
                   <div className="bg-slate-50 rounded-2xl p-4 flex gap-3 text-sm items-center border border-slate-200 shadow-sm transition-colors hover:bg-slate-100 cursor-pointer">
                     <span className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">MO</span>
                     <span className="text-slate-700 font-medium text-base">Perguntar ao Argo</span>
                   </div>
                </div>

                {/* Overlapping Team Avatars UI */}
                <div className="absolute top-[42%] -right-12 bg-white p-2.5 pr-8 rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.12)] border border-slate-100 flex items-center gap-1 z-30 group-hover:-translate-x-6 transition-transform duration-700 ease-out">
                   <div className="flex -space-x-3">
                     {[
                       'https://images.unsplash.com/photo-1595878715977-2e8f8df18ea8?auto=format&fit=crop&w=100&h=100&q=80',
                       'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&h=100&q=80',
                       'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=100&h=100&q=80'
                     ].map((imgUrl, i) => (
                       <img key={i} src={imgUrl} alt="Membro da Equipe" className="w-11 h-11 rounded-full border-2 border-white object-cover" />
                     ))}
                     <div className="w-11 h-11 rounded-full border-2 border-white bg-emerald-50 text-emerald-700 flex items-center justify-center text-sm font-bold shadow-sm">
                       5+
                     </div>
                   </div>
                </div>

                {/* Left Badge */}
                <div className="absolute top-[54%] -left-6 bg-slate-900 text-white px-6 py-3.5 rounded-full shadow-xl flex items-center gap-3 z-30 group-hover:translate-x-4 transition-transform duration-700 delay-100 ease-out">
                   <Users className="w-4 h-4 text-emerald-400" />
                   <span className="font-bold text-sm tracking-wide">Equipe</span>
                </div>
              </div>
            </div>
            <div className="mt-auto pt-10 text-center px-4">
              <h3 className="text-xl font-serif font-bold text-agro-floresta">Agronomia IA p/ toda equipe</h3>
            </div>
          </div>

          {/* Mockup 2: Maps & Plots (Offset slightly downwards on desktop) */}
          <div className="flex flex-col items-center h-full lg:mt-16">
            <div className="w-[320px] h-[640px] bg-[#efeae2] rounded-[2.5rem] border-[8px] border-slate-900 shadow-2xl relative group overflow-hidden transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_40px_60px_-15px_rgba(0,0,0,0.2)]">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-40"></div>
              
              <div className="w-full h-full bg-[#4a5f4a] overflow-hidden relative">
                {/* Background image / Map Simulation */}
                <div className="absolute inset-0 opacity-50 bg-[url('https://images.unsplash.com/photo-1586771107584-568c07c6999b?q=80&w=600&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay scale-110 group-hover:scale-100 transition-transform duration-1000"></div>
                
                {/* Refined Plot Areas */}
                <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 320 640">
                    <polygon points="40,200 180,180 200,320 60,340" fill="rgba(239, 68, 68, 0.4)" stroke="rgba(239, 68, 68, 0.8)" strokeWidth="2" strokeDasharray="4 2" />
                    <polygon points="190,120 280,140 300,280 210,300" fill="rgba(16, 185, 129, 0.4)" stroke="rgba(16, 185, 129, 0.8)" strokeWidth="2" strokeDasharray="4 2" />
                </svg>

                {/* Popups */}
                <div className="absolute top-16 left-5 right-5 bg-white/95 backdrop-blur-md text-slate-800 p-4 rounded-2xl shadow-lg z-20 border border-white/40">
                   <div className="flex justify-between items-center mb-4">
                     <span className="font-bold font-serif text-[15px]">Fazenda São João ▾</span>
                   </div>
                   <div className="space-y-3.5">
                     <div className="flex items-center gap-3 text-sm font-medium">
                       <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-[3px] border-emerald-100 shadow-sm"></div>
                       <span>Sítio das Águas</span>
                     </div>
                     <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5 text-sm text-slate-500 font-medium">
                       <Plus className="w-4 h-4 text-slate-400" /> Adicionar Propriedade
                     </div>
                   </div>
                </div>

                {/* Plot Insight Card */}
                <div className="absolute bottom-28 left-4 right-4 bg-white text-slate-800 p-5 rounded-3xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] z-30 group-hover:-translate-y-3 transition-transform duration-700 ease-out">
                   <div className="flex justify-between items-start mb-3">
                     <div>
                       <h4 className="font-serif font-bold text-xl text-slate-900 mb-1">Talhão 2</h4>
                       <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">5 Hectares • Tomate</p>
                     </div>
                     <Maximize2 className="w-4 h-4 text-slate-400 mt-1" />
                   </div>
                   
                   <div className="bg-emerald-50/80 rounded-2xl p-3.5 my-4 border border-emerald-100">
                     <div className="flex gap-2 items-center mb-1.5 text-emerald-800">
                       <Bot className="w-4 h-4" />
                       <span className="text-[10px] font-bold uppercase tracking-wider">Insight de IA</span>
                     </div>
                     <p className="text-sm text-emerald-900/90 leading-relaxed font-medium">Previsão de chuva forte (25mm). Recomendado cancelar aplicação de calda bordalesa.</p>
                   </div>
                   
                   <button className="w-full bg-slate-900 text-white rounded-xl py-3.5 text-sm font-bold flex justify-center items-center hover:bg-slate-800 transition-colors">
                      Detalhes do Talhão
                   </button>
                </div>

                {/* Bottom Navigation */}
                <div className="absolute bottom-8 inset-x-8 bg-white/95 backdrop-blur-md rounded-2xl py-3.5 px-6 flex justify-between items-center text-slate-400 shadow-xl border border-white/40 z-20">
                  <MapPin className="w-5 h-5 text-slate-800" />
                  <Settings className="w-5 h-5 hover:text-slate-800 transition-colors" />
                  <LocateFixed className="w-5 h-5 hover:text-slate-800 transition-colors" />
                  <Sun className="w-5 h-5 hover:text-slate-800 transition-colors" />
                </div>
              </div>
            </div>
            <div className="mt-auto pt-10 text-center px-4">
              <h3 className="text-xl font-serif font-bold text-agro-floresta">Talhões e insights ilimitados</h3>
            </div>
          </div>

          {/* Mockup 3: Soil & Diagnosis */}
          <div className="flex flex-col items-center h-full">
            <div className="w-[320px] h-[640px] bg-[#efeae2] rounded-[2.5rem] border-[8px] border-slate-900 shadow-2xl relative group overflow-hidden transition-all duration-700 hover:-translate-y-4 hover:shadow-[0_40px_60px_-15px_rgba(0,0,0,0.2)]">
               {/* Notch */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-900 rounded-b-2xl z-40"></div>
               
               <div className="w-full h-full bg-[#f8f6f0] overflow-hidden flex flex-col relative">
                 
                 {/* Header Section */}
                 <div className="pt-16 px-6 pb-6 text-slate-800 z-10">
                   <div className="flex justify-between items-center mb-8">
                     <div className="flex items-center gap-2">
                       <ArrowRight className="w-5 h-5 rotate-180 text-slate-400" />
                       <span className="font-serif font-bold text-[17px]">Sítio das Águas ▾</span>
                     </div>
                   </div>
                   
                   <div className="flex gap-6 text-sm font-bold mb-8 border-b border-slate-200">
                     <span className="border-b-2 border-slate-800 text-slate-800 pb-2">Cultura (Todas)</span>
                     <span className="text-slate-400 pb-2">Variedade</span>
                   </div>
                   
                   <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex justify-between items-end">
                     <div>
                       <p className="text-slate-400 text-xs mb-1 font-bold uppercase tracking-wider">Total de Canteiros</p>
                       <p className="text-5xl font-serif font-bold text-slate-800 tracking-tighter">12</p>
                     </div>
                     <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                       <span className="text-emerald-600 font-bold text-lg">+</span>
                     </div>
                   </div>
                 </div>

                 {/* Sand Card floating in from right - Adjusted position to not hide everything */}
                 <div className="absolute top-48 -right-12 w-64 bg-white rounded-3xl p-6 shadow-[0_15px_35px_rgba(0,0,0,0.08)] z-20 text-center transform rotate-6 group-hover:rotate-3 group-hover:-translate-x-2 transition-transform duration-700 border border-slate-100">
                    <div className="w-32 h-32 mx-auto rounded-full bg-[#E6D5B8] mb-5 shadow-inner overflow-hidden border-4 border-white">
                       <img src="/praga-hortalica.jpg" alt="Praga" className="w-full h-full object-cover mix-blend-overlay opacity-90" />
                    </div>
                    <h4 className="text-slate-800 font-serif font-bold text-xl mb-1.5">Solo Arenoso</h4>
                    <p className="text-slate-500 text-[13px] leading-relaxed px-2">Drena rápido, exige mais aporte de matéria orgânica.</p>
                 </div>

                 {/* Bottom Disease Card - Floating up */}
                 <div className="absolute bottom-10 left-4 right-4 bg-white rounded-3xl p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] z-30 group-hover:-translate-y-4 transition-transform duration-700 delay-100 border border-slate-100">
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 bg-red-50 px-2.5 py-1 rounded-full">Alerta de Praga</p>
                      <span className="text-slate-300">...</span>
                    </div>
                    <p className="text-slate-800 font-serif font-bold text-2xl mb-4">Oídio detectado</p>
                    <div className="h-[1px] bg-slate-100 w-full mb-4"></div>
                    <p className="text-[13px] text-slate-500 leading-relaxed font-medium">Alta probabilidade no Talhão 2 nas próximas 48h devido à umidade. Sugerida calda sulfocálcica preventiva.</p>
                 </div>
               </div>
            </div>
            <div className="mt-auto pt-10 text-center px-4">
              <h3 className="text-xl font-serif font-bold text-agro-floresta">Contexto único e compartilhado</h3>
            </div>
          </div>

        </div>

        <div className="mt-32 flex justify-center pb-12 relative z-20">
          <button className="bg-agro-floresta text-agro-creme px-14 py-6 rounded-full font-bold text-lg flex items-center gap-4 hover:shadow-[0_20px_40px_rgba(26,60,52,0.25)] hover:-translate-y-1 transition-all duration-500">
            Comece com sua equipe <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>
  );
}

export function AgronomySolutionsSection() {
  const [openSection, setOpenSection] = useState<number | null>(null);
  
  return (
      <section className="w-full mx-auto bg-agro-creme border-t border-agro-floresta/10 py-40 px-6">
        <div className="max-w-5xl mx-auto">
            <div className="mb-32 text-center md:text-left">
            <span className="inline-flex items-center gap-2 text-agro-ouro font-bold tracking-[0.2em] uppercase text-xs mb-8 px-5 py-2 border border-agro-ouro/20 rounded-full bg-agro-ouro/5">
                Soluções Estratégicas
            </span>
            <h2 className="text-6xl md:text-[5.5rem] font-serif font-bold tracking-tight mb-10 text-agro-floresta leading-[1.05]">
                O que o ManejoORG <br className="hidden md:block"/> Resolve
            </h2>
            <p className="text-2xl text-agro-floresta/70 max-w-2xl leading-relaxed font-light">
                Inteligência agronômica que não apenas observa; trabalha junto com você, simplificando a complexidade das exigências orgânicas.
            </p>
            </div>

            <ul className="flex flex-col w-full border-t border-agro-floresta/10">
            {[
                { num: '01', title: 'Gestão de Talhões e Canteiros', content: 'Mapeie sua propriedade com facilidade. Tenha o controle absoluto sobre as áreas de plantio, histórico de manejo e rotação de culturas.' },
                { num: '02', title: 'Filtro e Seleção de Insumos', content: 'Seja orgânico ou convencional, o ManejoORG cruza os ingredientes ativos cadastrados para o controle alvo, planta específica e Manejo Integrado de Pragas (MIP).' },
                { num: '03', title: 'Planos de Pulverização Automáticos', content: 'Calcule volumes exatos de calda, cadastre máquinas e envie ordens de serviço diretas para a equipe de aplicação, tudo integrado à previsão do tempo.' },
                { num: '04', title: 'Auditoria e Conformidade com PMO', content: 'Seus registros de aplicação, colheita e plantio geram automaticamente os relatórios exigidos pelas certificadoras e pelo Caderno de Campo.' },
                { num: '05', title: 'Recomendações de Nutrição de Solo', content: 'Com base nas suas análises de solo, o Argo recomenda as fontes de nutrientes mais viáveis e calcula a reposição correta após cada ciclo.' },
                { num: '06', title: 'Sincronização com o Ecossistema', content: 'Compartilhe insights e registros de campo não apenas com a equipe, mas diretamente com a OPAC, OCS, OAC, certificadoras e redes de certificação participativa.' }
            ].map((item, index) => {
                const isOpen = openSection === index;
                return (
                <li 
                key={index} 
                onClick={() => setOpenSection(isOpen ? null : index)}
                className="group flex flex-col border-b border-agro-floresta/10 py-12 md:py-16 cursor-pointer hover:bg-agro-floresta/[0.02] transition-colors -mx-6 px-6"
                >
                  <div className="flex flex-col md:flex-row items-start md:items-center w-full relative">
                    <div className="w-24 text-6xl md:text-[5.5rem] font-bold text-agro-floresta/5 mb-6 md:mb-0 font-serif md:-ml-4 leading-none select-none transition-colors group-hover:text-agro-ouro/20">
                        {item.num}
                    </div>
                    <h3 className={`text-3xl md:text-5xl font-serif font-bold transition-colors flex-1 md:pl-8 ${isOpen ? 'text-agro-ouro' : 'text-agro-floresta group-hover:text-agro-ouro'}`}>
                        {item.title}
                    </h3>
                    <div className={`mt-6 md:mt-0 transition-all duration-500 transform ${isOpen ? 'rotate-90 text-agro-ouro' : 'text-agro-floresta/30 group-hover:translate-x-4 group-hover:text-agro-ouro'}`}>
                        <ArrowRight className="w-10 h-10 md:w-12 md:h-12" />
                    </div>
                  </div>
                  
                  {/* Expanded Content */}
                  <div className={`grid transition-all duration-700 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-10' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                    <div className="overflow-hidden md:pl-[144px]">
                       <p className="text-xl md:text-2xl text-agro-floresta/70 leading-relaxed max-w-3xl font-light">
                         {item.content}
                       </p>
                    </div>
                  </div>
                </li>
            )})}
            </ul>
        </div>
      </section>
  );
}

// ==========================================================================
// 6. PÁGINA INICIAL PRINCIPAL (LANDING PAGE MOCKUP)
// ==========================================================================
const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-agro-creme text-agro-floresta font-sans selection:bg-agro-ouro/30 selection:text-agro-floresta relative overflow-hidden bg-grain">
            {/* AppBar / Navegação */}
            <header className="sticky top-0 z-50 bg-agro-creme/90 backdrop-blur-md border-b border-agro-floresta/5">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="p-2 bg-agro-floresta rounded-lg text-agro-creme transition-transform duration-500 group-hover:rotate-12">
                            <Tractor size={24} />
                        </div>
                        <span className="text-xl font-serif font-bold tracking-tight">
                            Manejo<span className="text-agro-ouro">ORG</span>
                        </span>
                    </div>
                    
                    <nav className="flex items-center gap-8">
                        {user ? (
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="bg-agro-floresta text-agro-creme px-6 py-2 rounded-full font-semibold hover:shadow-xl hover:shadow-agro-floresta/20 transition-all duration-300"
                            >
                                Dashboard
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-agro-floresta/80 hover:text-agro-floresta font-medium transition-colors hidden sm:block"
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => navigate('/cadastro')}
                                    className="bg-agro-floresta text-agro-creme px-6 py-2.5 rounded-full font-bold hover:shadow-xl hover:shadow-agro-floresta/20 -translate-y-0.5 transition-all duration-300"
                                >
                                    Começar Agora
                                </button>
                            </>
                        )}
                    </nav>
                </div>
            </header>

            {/* SEÇÃO: HERO INSPIRADA NA REFERÊNCIA ORTH */}
            <section className="relative pt-24 pb-32 lg:pt-32 lg:pb-40">
                <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-20 items-center">
                    <div className="lg:col-span-6 max-w-3xl">
                        <span className="inline-flex items-center gap-2 text-emerald-700 font-bold tracking-[0.2em] uppercase text-xs mb-6 px-4 py-1.5 border border-emerald-700/20 rounded-full bg-emerald-50">
                            <Bot size={14} /> Seu Agrônomo Virtual
                        </span>
                        
                        <h1 className="text-6xl lg:text-7xl xl:text-[6rem] text-agro-floresta leading-[0.95] tracking-tight mb-10 font-serif font-bold">
                            Dê voz à <br />
                            sua terra. <br />
                            <span className="italic font-normal text-agro-ouro">24/7 no seu bolso.</span>
                        </h1>
                        
                        <p className="text-xl lg:text-2xl text-agro-floresta/80 mb-12 leading-relaxed max-w-xl font-sans font-light">
                            Todos os dias você toma dezenas de decisões que definem sua safra. Quando irrigar. Se deve pulverizar. O ManejoORG muda isso. É o seu consultor pessoal, ciente do seu contexto, sempre ouvindo e sincronizado com o ritmo da sua propriedade.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-5">
                            <button onClick={() => navigate(user ? '/dashboard' : '/cadastro')} className="group bg-emerald-700 text-white px-10 py-5 rounded-full font-bold text-lg hover:bg-emerald-800 hover:shadow-2xl hover:shadow-emerald-700/30 transition-all duration-500 flex items-center justify-center gap-3">
                                {user ? 'Ir para o Dashboard' : 'Começar Agora'}
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                    
                    {/* Visual Mockup */}
                    <div className="lg:col-span-6 w-full">
                        <HeroVisualStack />
                    </div>
                </div>
            </section>

            {/* SEÇÃO DE MAPA E SAÚDE DO SOLO */}
            <MapFeatureSection />

            {/* SEÇÕES DE INTELIGÊNCIA E SOLUÇÕES */}
            <AgronomyShowcaseSection />
            <AgronomySolutionsSection />

            {/* SEÇÃO DE PROCESSO: HOW IT WORKS (INSPIRADO NA REFERÊNCIA) */}
            <HowItWorksSection />

            {/* RODAPÉ E LINKS ÚTEIS */}
            <footer className="bg-agro-floresta text-agro-creme py-20 border-t border-agro-creme/5">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                        <div className="md:col-span-2">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-agro-creme rounded-lg text-agro-floresta">
                                    <Tractor size={24} />
                                </div>
                                <span className="text-3xl font-serif font-bold tracking-tight">
                                    Manejo<span className="text-agro-ouro">ORG</span>
                                </span>
                            </div>
                            <p className="text-agro-creme/70 max-w-sm leading-relaxed font-light text-lg">
                                Inteligência agronômica que simplifica a complexidade da produção sustentável. Do plantio à colheita, da certificação à comercialização.
                            </p>
                        </div>
                        <div>
                            <h4 className="font-serif font-bold text-xl mb-8 text-agro-ouro">Produto</h4>
                            <ul className="space-y-4 text-agro-creme/70">
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Funcionalidades</a></li>
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Preços</a></li>
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Certificação PMO</a></li>
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Casos de Uso</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-serif font-bold text-xl mb-8 text-agro-ouro">Institucional & Legal</h4>
                            <ul className="space-y-4 text-agro-creme/70">
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Sobre Nós</a></li>
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Contato e Suporte</a></li>
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Termos de Serviço</a></li>
                                <li><a href="#" className="hover:text-agro-ouro transition-colors">Política de Privacidade</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-agro-creme/10 text-agro-creme/50 text-sm">
                        <p>© 2024 ManejoORG. Todos os direitos reservados.</p>
                        <div className="flex gap-4 mt-4 md:mt-0 items-center">
                            <span>contato@manejo.org</span>
                            <span className="w-1 h-1 rounded-full bg-agro-creme/30"></span>
                            <span>Feito com <span className="text-agro-ouro">♥</span> para quem planta o futuro.</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
