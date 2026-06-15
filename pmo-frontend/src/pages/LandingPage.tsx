import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Tractor,
    LayoutDashboard,
    MessageSquare,
    ArrowRight,
    TrendingUp,
    Zap,
    Send
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
                    
                    // Suporta preferência por movimento reduzido (A11y)
                    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    if (prefersReduced) {
                        setCount(target);
                        return;
                    }

                    const startTime = performance.now();

                    const animate = (currentTime: number) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // Easing function (easeOutQuad) para movimento desacelerado natural
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

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => {
            if (elementRef.current) {
                observer.unobserve(elementRef.current);
            }
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
                    // Dispara a conversa via WhatsApp de forma sequencial e cadenciada
                    setTimeout(() => setChatStep(1), 600);
                    setTimeout(() => setChatStep(2), 2200);
                    setTimeout(() => setChatStep(3), 3800);
                    setTimeout(() => setChatStep(4), 5400);
                }
            },
            { threshold: 0.1 }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, []);

    return (
        <div ref={containerRef} className="relative flex flex-col lg:block items-center gap-10 lg:gap-0 w-full max-w-2xl mx-auto h-auto lg:h-[500px]">
            {/* Esfera decorativa de luz ao fundo */}
            <div className="absolute inset-0 bg-agro-ouro/10 rounded-full blur-[100px] -z-10 animate-pulse"></div>

            {/* MOCKUP 1: Dashboard da Aplicação (Background, inclinado em -2 graus) */}
            <div className="relative lg:absolute lg:left-0 lg:top-6 w-[95%] sm:w-[85%] lg:w-[85%] bg-white rounded-2xl border border-agro-floresta/10 shadow-2xl overflow-hidden transition-all duration-700 hover:scale-[1.01] lg:-rotate-2 origin-bottom-left z-10 order-2">
                {/* Janela estilo macOS */}
                <div className="bg-agro-floresta/5 px-4 py-3 border-b border-agro-floresta/10 flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                    <span className="text-[10px] text-agro-floresta/30 ml-4 font-mono font-medium">app.manejo.org</span>
                </div>
                
                {/* Visual do Painel Interno */}
                <div className="grid grid-cols-4 h-72">
                    {/* Sidebar Simulado */}
                    <div className="col-span-1 bg-agro-floresta/5 p-3 border-r border-agro-floresta/10 flex flex-col gap-2">
                        <div className="h-5 w-full bg-agro-floresta/10 rounded"></div>
                        <div className="h-3.5 w-[85%] bg-agro-floresta/10 rounded"></div>
                        <div className="h-3.5 w-[65%] bg-agro-floresta/10 rounded"></div>
                        <div className="h-3.5 w-[75%] bg-agro-floresta/10 rounded"></div>
                        <div className="mt-auto h-5 w-8 bg-agro-ouro/20 rounded"></div>
                    </div>
                    
                    {/* Conteúdo Principal Simulado */}
                    <div className="col-span-3 p-4 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <div className="h-4.5 w-24 bg-agro-floresta/25 rounded"></div>
                            <div className="h-5 w-16 bg-agro-ouro/20 text-agro-ouro text-[9px] font-bold rounded-full flex items-center justify-center">Safra Ativa</div>
                        </div>
                        
                        {/* Mini Cards de Estatísticas */}
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
                        
                        {/* Mini Gráfico de Produção */}
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

            {/* MOCKUP 2: Interface de Chat do WhatsApp (Foreground, Rotacionado em 1 grau) */}
            <div className="relative lg:absolute lg:right-2 xl:lg:right-4 lg:bottom-4 w-[260px] lg:w-[270px] bg-[#efeae2] rounded-[32px] border-[6px] border-slate-900 shadow-2xl overflow-hidden z-20 transition-all duration-700 hover:scale-[1.02] lg:rotate-1 order-1">
                {/* Notch do Alto-falante/Câmera */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-3.5 bg-slate-900 rounded-b-xl z-30"></div>
                
                {/* Cabeçalho do Chat */}
                <div className="bg-[#075e54] pt-4 pb-2.5 px-3.5 flex items-center gap-2 text-white relative z-25">
                    <div className="w-7.5 h-7.5 rounded-full bg-white/20 flex items-center justify-center text-xs font-serif font-bold text-white border border-white/10">
                        MO
                    </div>
                    <div>
                        <div className="text-[10px] font-bold font-sans tracking-wide">ManejoOrg Bot</div>
                        <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-[8px] text-emerald-100 font-sans font-medium">online</span>
                        </div>
                    </div>
                </div>

                {/* Histórico do Chat (Staggered Animations) */}
                <div className="p-3 h-64 overflow-y-auto flex flex-col gap-2.5 scrollbar-none scroll-smooth">
                    {chatStep >= 1 && (
                        <div className="self-end bg-[#d9fdd3] text-agro-floresta text-[10px] p-2.5 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] border border-[#cbd8cb]/30 animate-fade-in-up">
                            Registrar colheita de 4.2 toneladas de milho orgânico no talhão B.
                            <div className="text-[7px] text-right mt-1 text-agro-floresta/50 font-semibold">10:42</div>
                        </div>
                    )}

                    {chatStep >= 2 && (
                        <div className="self-start bg-white text-agro-floresta text-[10px] p-2.5 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] border border-agro-floresta/5 animate-fade-in-up">
                            📝 <strong>Lançamento Efetuado!</strong>
                            <ul className="mt-1 space-y-0.5 list-disc list-inside text-agro-floresta/80 text-[9.5px]">
                                <li>Produto: Milho Orgânico</li>
                                <li>Qtd: 4.2 ton</li>
                                <li>Local: Talhão B</li>
                            </ul>
                            <div className="text-[7px] text-right mt-1 text-agro-floresta/40">10:42</div>
                        </div>
                    )}

                    {chatStep >= 3 && (
                        <div className="self-end bg-[#d9fdd3] text-agro-floresta text-[10px] p-2.5 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] border border-[#cbd8cb]/30 animate-fade-in-up">
                            Adicionar despesa de R$ 850 com diesel.
                            <div className="text-[7px] text-right mt-1 text-agro-floresta/50 font-semibold">10:43</div>
                        </div>
                    )}

                    {chatStep >= 4 && (
                        <div className="self-start bg-white text-agro-floresta text-[10px] p-2.5 rounded-2xl rounded-tl-none shadow-sm max-w-[85%] border border-agro-floresta/5 animate-fade-in-up">
                            💵 <strong>Despesa Registrada!</strong>
                            <ul className="mt-1 space-y-0.5 list-disc list-inside text-agro-floresta/80 text-[9.5px]">
                                <li>Categoria: Combustíveis</li>
                                <li>Valor: R$ 850,00</li>
                            </ul>
                            <p className="mt-1 text-[9px] text-agro-ouro font-medium">✓ Caixa atualizado!</p>
                            <div className="text-[7px] text-right mt-1 text-agro-floresta/40">10:43</div>
                        </div>
                    )}
                </div>

                {/* Input de Mensagem */}
                <div className="bg-white p-2 flex items-center gap-2 border-t border-slate-200">
                    <div className="flex-grow bg-slate-100 rounded-full px-3 py-1 flex items-center text-[9px] text-slate-400">
                        Mensagem...
                    </div>
                    <div className="w-6.5 h-6.5 rounded-full bg-[#075e54] text-white flex items-center justify-center cursor-pointer">
                        <Send size={10} className="ml-0.5" />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==========================================================================
// 3. COMPONENTE DE PROCESSO EM PASSO A PASSO ASSIMÉTRICO (HOW IT WORKS)
// ==========================================================================
const HowItWorksSection: React.FC = () => {
    return (
        <section className="py-24 relative overflow-hidden bg-agro-creme bg-grain border-t border-agro-floresta/5">
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-2xl mx-auto mb-24">
                    <span className="inline-block text-agro-ouro font-bold tracking-[0.2em] uppercase text-xs mb-4 px-4 py-1.5 border border-agro-ouro/20 rounded-full bg-agro-ouro/5">
                        Como Funciona
                    </span>
                    <h2 className="text-4xl lg:text-5xl text-agro-floresta tracking-tight leading-tight font-serif">
                        A simplicidade do WhatsApp com a <br />
                        <span className="italic font-normal">potência de um ERP Agrícola</span>
                    </h2>
                </div>

                <div className="relative min-h-[480px]">
                    {/* Linha pontilhada conectando os passos (Apenas para telas grandes) */}
                    <div className="absolute inset-0 pointer-events-none hidden lg:block z-0">
                        <svg className="w-full h-full text-agro-ouro/30" viewBox="0 0 1000 400" fill="none">
                            <path 
                                d="M 180 150 C 320 150, 380 230, 500 230 C 620 230, 680 330, 820 330" 
                                stroke="currentColor" 
                                strokeWidth="3" 
                                strokeDasharray="8 8" 
                            />
                        </svg>
                    </div>

                    {/* Grid de Passos com Deslocamentos Assimétricos */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8 relative z-10">
                        {/* Passo 1 - Posição Padrão */}
                        <div className="group relative bg-white/80 backdrop-blur-sm p-10 rounded-3xl border border-agro-floresta/5 hover:bg-white hover:border-agro-ouro/20 hover:shadow-2xl hover:shadow-agro-ouro/10 transition-all duration-500 transform lg:-translate-y-4">
                            {/* Número de passo gigante em background */}
                            <span className="absolute right-6 top-4 text-8xl font-serif text-agro-ouro/10 select-none group-hover:text-agro-ouro/15 transition-colors duration-500">
                                01
                            </span>
                            
                            <div className="w-16 h-16 rounded-2xl bg-agro-floresta/5 flex items-center justify-center text-agro-ouro mb-8 group-hover:scale-110 group-hover:bg-agro-floresta group-hover:text-agro-creme transition-all duration-500">
                                <MessageSquare size={32} />
                            </div>
                            
                            <h3 className="text-2xl text-agro-floresta font-bold mb-4 font-serif">1. Envie no WhatsApp</h3>
                            <p className="text-agro-floresta/75 leading-relaxed text-sm">
                                Esqueça planilhas complexas ou aplicativos pesados. Basta enviar uma mensagem de texto ou áudio descrevendo sua atividade diária no WhatsApp — a mesma ferramenta que você e seus colaboradores já utilizam rotineiramente.
                            </p>
                        </div>

                        {/* Passo 2 - Deslocamento Médio */}
                        <div className="group relative bg-white/80 backdrop-blur-sm p-10 rounded-3xl border border-agro-floresta/5 hover:bg-white hover:border-agro-ouro/20 hover:shadow-2xl hover:shadow-agro-ouro/10 transition-all duration-500 transform lg:translate-y-8">
                            {/* Número de passo gigante em background */}
                            <span className="absolute right-6 top-4 text-8xl font-serif text-agro-ouro/10 select-none group-hover:text-agro-ouro/15 transition-colors duration-500">
                                02
                            </span>
                            
                            <div className="w-16 h-16 rounded-2xl bg-agro-floresta/5 flex items-center justify-center text-agro-ouro mb-8 group-hover:scale-110 group-hover:bg-agro-floresta group-hover:text-agro-creme transition-all duration-500">
                                <Zap size={32} />
                            </div>
                            
                            <h3 className="text-2xl text-agro-floresta font-bold mb-4 font-serif">2. Processamento IA</h3>
                            <p className="text-agro-floresta/75 leading-relaxed text-sm">
                                Nossa inteligência artificial proprietária analisa a mensagem e a processa instantaneamente. Ela reconhece o produto colhido, o talhão de origem, o custo de defensivos ou a receita da venda, estruturando o banco de dados de forma autônoma.
                            </p>
                        </div>

                        {/* Passo 3 - Deslocamento Alto */}
                        <div className="group relative bg-white/80 backdrop-blur-sm p-10 rounded-3xl border border-agro-floresta/5 hover:bg-white hover:border-agro-ouro/20 hover:shadow-2xl hover:shadow-agro-ouro/10 transition-all duration-500 transform lg:translate-y-20">
                            {/* Número de passo gigante em background */}
                            <span className="absolute right-6 top-4 text-8xl font-serif text-agro-ouro/10 select-none group-hover:text-agro-ouro/15 transition-colors duration-500">
                                03
                            </span>
                            
                            <div className="w-16 h-16 rounded-2xl bg-agro-floresta/5 flex items-center justify-center text-agro-ouro mb-8 group-hover:scale-110 group-hover:bg-agro-floresta group-hover:text-agro-creme transition-all duration-500">
                                <LayoutDashboard size={32} />
                            </div>
                            
                            <h3 className="text-2xl text-agro-floresta font-bold mb-4 font-serif">3. Gestão e Relatórios</h3>
                            <p className="text-agro-floresta/75 leading-relaxed text-sm">
                                Acompanhe o fluxo de caixa consolidado, controle o custo real por hectare e visualize mapas detalhados de manejo. Todas as informações são salvas de maneira auditável, prontas para certificações de sustentabilidade orgânica.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {/* Espaçador para acomodar a assimetria visual de forma harmoniosa */}
            <div className="h-16 lg:h-24"></div>
        </section>
    );
};

// ==========================================================================
// 4. SEÇÃO PREVIEW DO DASHBOARD FINANCEIRO (CASH FLOW + LUCRATIVIDADE)
// ==========================================================================
const FinancialPreviewSection: React.FC = () => {
    return (
        <section className="py-24 bg-white border-y border-agro-ouro/10 relative overflow-hidden">
            {/* Elemento de profundidade em background */}
            <div className="absolute top-0 right-0 w-1/3 h-full bg-agro-creme/30 -skew-x-12 translate-x-1/2 -z-10 animate-pulse"></div>
            
            <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-16 items-center">
                <div className="lg:col-span-5">
                    <div className="flex items-center gap-3 text-agro-ouro mb-6">
                        <TrendingUp size={24} />
                        <span className="font-bold uppercase tracking-widest text-xs">Visibilidade e Saúde</span>
                    </div>
                    <h2 className="text-4xl lg:text-5xl text-agro-floresta mb-8 leading-tight tracking-tight font-serif">
                        Painel Financeiro: <br /> 
                        <span className="font-normal italic">Gestão transparente e em tempo real.</span>
                    </h2>
                    <p className="text-base text-agro-floresta/70 leading-relaxed mb-10">
                        O painel financeiro do ManejoOrg consolida automaticamente os dados informados no campo. Sem precisar preencher planilhas complexas ao fim do dia, você acompanha seu fluxo de caixa real por safra, controla o custo exato de cada talhão e garante conformidade contábil e socioambiental instantânea.
                    </p>
                    
                    <div className="border-t border-agro-floresta/10 pt-8 grid grid-cols-2 gap-8">
                        <div>
                            <span className="block text-sm text-agro-floresta/50 font-bold uppercase tracking-wider mb-2">Conformidade Verde</span>
                            <p className="text-xs text-agro-floresta/70 leading-relaxed">Rastreabilidade simplificada e dados preparados para auditoria agronômica.</p>
                        </div>
                        <div>
                            <span className="block text-sm text-agro-floresta/50 font-bold uppercase tracking-wider mb-2">Decisão de Caixa</span>
                            <p className="text-xs text-agro-floresta/70 leading-relaxed">Avalie a viabilidade de novas safras com projeções e índices automáticos.</p>
                        </div>
                    </div>
                </div>
                
                {/* MOCKUP INTERATIVO: Painel Financeiro */}
                <div className="lg:col-span-7 bg-[#FDFBF7] p-8 lg:p-10 rounded-[2rem] border border-agro-floresta/10 shadow-2xl relative">
                    {/* Header do Mockup */}
                    <div className="flex justify-between items-center mb-8 border-b border-agro-floresta/5 pb-6">
                        <div>
                            <span className="text-[10px] text-agro-floresta/40 uppercase font-bold tracking-widest block mb-1">Fazenda Vista Alegre</span>
                            <h3 className="text-2.5xl text-agro-floresta font-serif font-bold">Fluxo de Caixa Mensal</h3>
                        </div>
                        <div className="bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Lucratividade Saudável
                        </div>
                    </div>

                    {/* Indicadores Principais */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-white p-4 rounded-2xl border border-agro-floresta/5 shadow-sm">
                            <span className="text-[9px] font-bold text-agro-floresta/40 uppercase tracking-wider block mb-1">Saldo Líquido</span>
                            <span className="text-lg lg:text-xl font-bold text-agro-floresta">R$ 48.720</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-agro-floresta/5 shadow-sm">
                            <span className="text-[9px] font-bold text-agro-floresta/40 uppercase tracking-wider block mb-1">Receitas</span>
                            <span className="text-lg lg:text-xl font-bold text-emerald-600">R$ 62.150</span>
                        </div>
                        <div className="bg-white p-4 rounded-2xl border border-agro-floresta/5 shadow-sm">
                            <span className="text-[9px] font-bold text-agro-floresta/40 uppercase tracking-wider block mb-1">Despesas</span>
                            <span className="text-lg lg:text-xl font-bold text-agro-ouro">R$ 13.430</span>
                        </div>
                    </div>

                    {/* Gráfico do Fluxo de Caixa */}
                    <div className="bg-white p-6 rounded-2xl border border-agro-floresta/5 shadow-sm mb-6">
                        <div className="flex justify-between items-center mb-6">
                            <span className="text-xs font-bold text-agro-floresta/60">Histórico de Caixa (Safra 2026)</span>
                            <div className="flex gap-4 text-[10px]">
                                <span className="flex items-center gap-1.5 font-medium text-agro-floresta/75">
                                    <span className="w-2 h-2 rounded bg-emerald-500"></span> Receitas
                                </span>
                                <span className="flex items-center gap-1.5 font-medium text-agro-floresta/75">
                                    <span className="w-2 h-2 rounded bg-agro-ouro"></span> Despesas
                                </span>
                            </div>
                        </div>

                        {/* Colunas do Gráfico */}
                        <div className="h-40 flex items-end justify-between px-2 pt-2 border-b border-slate-100">
                            {[
                                { month: 'Jan', inc: 35, exp: 12 },
                                { month: 'Fev', inc: 48, exp: 18 },
                                { month: 'Mar', inc: 42, exp: 22 },
                                { month: 'Abr', inc: 55, exp: 15 },
                                { month: 'Mai', inc: 60, exp: 20 },
                                { month: 'Jun', inc: 72, exp: 14 }
                            ].map((d, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 group cursor-pointer">
                                    <div className="flex items-end gap-1.5 h-28 relative">
                                        {/* Barra de Receitas */}
                                        <div 
                                            style={{ height: `${d.inc}%` }} 
                                            className="w-3.5 lg:w-4 bg-emerald-500 rounded-t-sm transition-all duration-500 group-hover:bg-emerald-600 relative"
                                        >
                                            {/* Tooltip */}
                                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-agro-floresta text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-30 font-sans pointer-events-none whitespace-nowrap">
                                                R$ {d.inc}k
                                            </span>
                                        </div>
                                        {/* Barra de Despesas */}
                                        <div 
                                            style={{ height: `${d.exp}%` }} 
                                            className="w-3.5 lg:w-4 bg-agro-ouro rounded-t-sm transition-all duration-500 group-hover:bg-agro-ouro/95 relative"
                                        >
                                            {/* Tooltip */}
                                            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-agro-floresta text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity z-30 font-sans pointer-events-none whitespace-nowrap">
                                                R$ {d.exp}k
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-agro-floresta/50 font-bold">{d.month}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Breakdown de Indicador por Cultura */}
                    <div className="bg-agro-creme/50 p-4 rounded-xl border border-agro-floresta/5 flex items-center justify-between text-[11px] gap-2">
                        <span className="text-agro-floresta/60 font-medium whitespace-nowrap">Margem por cultura esta safra:</span>
                        <div className="flex gap-4 font-bold text-agro-floresta">
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Milho Orgânico: 78%</span>
                            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-agro-ouro"></span> Hortaliças: 64%</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ==========================================================================
// 5. PÁGINA INICIAL PRINCIPAL (LANDING PAGE)
// ==========================================================================
const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-agro-creme text-agro-floresta font-sans selection:bg-agro-ouro/30 selection:text-agro-floresta relative overflow-hidden bg-grain">
            {/* AppBar / Navegação */}
            <header className="sticky top-0 z-50 bg-agro-creme/80 backdrop-blur-md border-b border-agro-floresta/5">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="p-2 bg-agro-floresta rounded-lg text-agro-creme transition-transform duration-500 group-hover:rotate-12">
                            <Tractor size={24} />
                        </div>
                        <span className="text-xl font-serif font-bold tracking-tight">
                            Manejo<span className="text-agro-ouro">Org</span>
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
                                    className="text-agro-floresta/80 hover:text-agro-floresta font-medium transition-colors"
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

            {/* SEÇÃO: HERO COM GRID ASSIMÉTRICO */}
            <section className="relative pt-20 pb-28 lg:pt-28 lg:pb-36">
                <div className="container mx-auto px-6 grid lg:grid-cols-12 gap-16 items-center">
                    <div className="lg:col-span-6 max-w-3xl">
                        <span className="inline-block text-agro-ouro font-bold tracking-[0.2em] uppercase text-xs mb-6 px-4 py-1.5 border border-agro-ouro/20 rounded-full bg-agro-ouro/5 animate-pmo-reveal">
                            ManejoOrg • Inteligência Agronômica
                        </span>
                        
                        <h1 className="text-5xl lg:text-7xl xl:text-8xl text-agro-floresta leading-[1.05] tracking-tight mb-8 animate-pmo-reveal font-serif font-bold">
                            Sustentabilidade Rural & <br />
                            <span className="italic font-normal">Futuro no Campo</span>
                        </h1>
                        
                        <p className="text-lg lg:text-xl text-agro-floresta/70 mb-10 leading-relaxed max-w-xl animate-pmo-reveal">
                            A tecnologia definitiva para gestão agroecológica, orgânica e convencional sustentável. Transforme seus registros de campo e dados agronômicos em rentabilidade real de forma automatizada.
                        </p>
                        
                        <div className="flex flex-col sm:flex-row gap-5 animate-pmo-reveal">
                            <button 
                                onClick={() => navigate('/cadastro')}
                                className="group bg-agro-floresta text-agro-creme px-10 py-5 rounded-full font-bold text-lg hover:shadow-2xl hover:shadow-agro-floresta/30 transition-all duration-500 flex items-center justify-center gap-3"
                            >
                                Iniciar Gestão Inteligente
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button 
                                onClick={() => navigate('/login')}
                                className="bg-transparent border border-agro-floresta/20 text-agro-floresta px-10 py-5 rounded-full font-bold text-lg hover:bg-agro-floresta/5 transition-all duration-500"
                            >
                                Ver Demonstração
                            </button>
                        </div>
                    </div>
                    
                    {/* Visual Mockup Híbrido e Overlapped no Lado Direito */}
                    <div className="lg:col-span-6 w-full animate-pmo-reveal">
                        <HeroVisualStack />
                    </div>
                </div>
            </section>

            {/* SEÇÃO: EFICIÊNCIA ECONÔMICA (CONTADORES ANIMADOS) */}
            <section className="bg-white border-y border-agro-ouro/10 py-24 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-agro-creme/30 -skew-x-12 translate-x-1/2"></div>
                
                <div className="container mx-auto px-6 grid md:grid-cols-2 gap-20 items-center relative z-10">
                    <div>
                        <div className="flex items-center gap-3 text-agro-ouro mb-6">
                            <TrendingUp size={24} />
                            <span className="font-bold uppercase tracking-widest text-xs">Rentabilidade Rural</span>
                        </div>
                        <h2 className="text-4xl lg:text-5xl text-agro-floresta mb-8 leading-tight font-serif">
                            Eficiência Econômica: <br /> 
                            <span className="font-normal italic">Resultado que fertiliza o lucro.</span>
                        </h2>
                        <p className="text-base text-agro-floresta/70 leading-relaxed mb-10 max-w-lg">
                            O ecossistema do ManejoOrg não apenas organiza o campo, ele calibra seus custos operacionais. Reduzimos o desperdício de insumos através de lançamentos integrados e inteligência de dados, comprovando que a gestão sustentável é o verdadeiro catalisador do lucro no campo.
                        </p>
                        
                        {/* Contadores Animados via Viewport */}
                        <div className="grid grid-cols-2 gap-10">
                            <div className="border-l-4 border-agro-ouro pl-6 py-2">
                                <div className="block mb-1">
                                    <AnimatedCounter target={15} suffix="%" />
                                </div>
                                <span className="text-xs text-agro-floresta/50 uppercase tracking-[0.2em] font-bold">Redução de Custos</span>
                            </div>
                            <div className="border-l-4 border-agro-ouro pl-6 py-2">
                                <div className="block mb-1">
                                    <AnimatedCounter target={22} suffix="%" />
                                </div>
                                <span className="text-xs text-agro-floresta/50 uppercase tracking-[0.2em] font-bold">Aumento de Margem</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Banner Ilustrativo de ROI */}
                    <div className="bg-agro-creme p-10 lg:p-12 rounded-3xl border border-agro-ouro/10 shadow-[0_20px_50px_rgba(197,160,89,0.1)] group">
                        <div className="h-72 flex flex-col items-center justify-center border-2 border-dashed border-agro-ouro/20 rounded-2xl text-agro-floresta/30 italic group-hover:border-agro-ouro/45 transition-colors duration-500">
                            <Zap size={48} className="mb-4 text-agro-ouro/40 group-hover:scale-110 transition-transform duration-500" />
                            <span className="text-center px-8 text-sm text-agro-floresta/60">Análise de Economia de Escala & Retorno sobre Investimento (ROI) Integrado</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* SEÇÃO PREVIEW DO DASHBOARD FINANCEIRO */}
            <FinancialPreviewSection />

            {/* SEÇÃO DE PROCESSO: HOW IT WORKS (ASSET ESTRUTURADO) */}
            <HowItWorksSection />

            {/* Rodapé (Footer) */}
            <footer className="bg-agro-floresta text-agro-creme pt-24 pb-12">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-20">
                        <div className="col-span-1 md:col-span-1">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="p-1.5 bg-agro-creme rounded text-agro-floresta">
                                    <Tractor size={20} />
                                </div>
                                <span className="text-xl font-serif font-bold">Manejo<span className="text-agro-ouro">Org</span></span>
                            </div>
                            <p className="text-agro-creme/60 leading-relaxed text-sm">
                                Elevando o padrão da agricultura sustentável por meio de inteligência agronômica e operacional avançada.
                            </p>
                        </div>
                        
                        {["Negócios", "Transparência", "Suporte"].map((cat, i) => (
                            <div key={i}>
                                <h4 className="text-agro-ouro font-bold uppercase tracking-widest text-xs mb-8">{cat}</h4>
                                <ul className="space-y-4 text-sm text-agro-creme/50">
                                    <li className="hover:text-agro-creme cursor-pointer transition-colors">Funcionalidades</li>
                                    <li className="hover:text-agro-creme cursor-pointer transition-colors">Termos de Uso</li>
                                    <li className="hover:text-agro-creme cursor-pointer transition-colors">Privacidade</li>
                                </ul>
                            </div>
                        ))}
                    </div>
                    
                    <div className="pt-12 border-t border-agro-creme/5 flex flex-col md:flex-row justify-between items-center text-xs text-agro-creme/40 tracking-widest uppercase">
                        <p>© {new Date().getFullYear()} Manejo<span className="text-agro-ouro">Org</span>. Todos os direitos reservados.</p>
                        <p className="mt-4 md:mt-0 italic font-serif">Cultivando o agro sustentável.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
