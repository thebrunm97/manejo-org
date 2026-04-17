import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changelogData } from '../data/changelog';
import {
    Tag,
    Calendar,
    CheckCircle,
    ArrowLeft,
    Sparkles,
    Rocket,
    Wrench
} from 'lucide-react';

const ChangelogPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const handleBack = () => {
        navigate(user ? '/dashboard' : '/');
    };

    // Helper para ícones por tipo (usando ícones mais "premium")
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Improvements': return <Rocket size={14} className="text-emerald-600" />;
            case 'Fixes': return <CheckCircle size={14} className="text-blue-600" />;
            case 'Patches': return <Wrench size={14} className="text-slate-600" />;
            case 'New': return <Sparkles size={14} className="text-amber-600" />;
            default: return <Tag size={14} />;
        }
    };

    const getTypeStyles = (type: string) => {
        switch (type) {
            case 'Improvements': return 'bg-emerald-50 text-emerald-700 border-emerald-100/50';
            case 'Fixes': return 'bg-blue-50 text-blue-700 border-blue-100/50';
            case 'Patches': return 'bg-slate-50 text-slate-700 border-slate-100/50';
            case 'New': return 'bg-amber-50 text-amber-700 border-amber-100/50';
            default: return 'bg-slate-50 text-slate-700 border-slate-100/50';
        }
    };

    const latestVersion = changelogData[0]?.version || 'v1.0.0';

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            // Fallback for cases where direct date constructor fails with some strings
            if (isNaN(date.getTime())) return dateStr;
            return new Intl.DateTimeFormat('pt-BR', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            }).format(date);
        } catch (e) {
            return dateStr;
        }
    };

    return (
        <div className="min-h-screen bg-agro-creme font-sans selection:bg-agro-ouro/30 selection:text-agro-floresta relative overflow-hidden bg-grain">
            {/* Header / Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-agro-creme/80 backdrop-blur-xl border-b border-agro-floresta/5 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        aria-label="Voltar para a página anterior"
                        className="group flex items-center gap-2 text-agro-floresta/60 hover:text-agro-floresta transition-colors outline-none focus-visible:ring-2 focus-visible:ring-agro-ouro rounded-lg"
                    >
                        <div className="p-2 rounded-full group-hover:bg-agro-floresta/5 transition-colors">
                            <ArrowLeft size={18} />
                        </div>
                        <span className="text-sm font-bold tracking-tight">Voltar</span>
                    </button>
                    <div className="h-6 w-px bg-agro-floresta/10 mx-4 hidden sm:block" />
                    <div className="flex-1 hidden sm:flex items-center">
                        <span className="text-sm font-black uppercase tracking-[0.15em] text-agro-floresta/40">Novidades da Plataforma</span>
                    </div>
                </div>
            </header>

            <main className="pt-32 pb-24 px-6 md:px-8">
                {/* Hero Section */}
                <section className="max-w-3xl mx-auto text-center mb-24 animate-pmo-reveal">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-agro-ouro/10 border border-agro-ouro/20 text-agro-ouro text-[10px] font-black mb-6 tracking-[0.2em] uppercase">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-agro-ouro opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-agro-ouro"></span>
                        </span>
                        Versão Atual: {latestVersion}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-agro-floresta mb-6 tracking-tighter leading-[1.05] text-wrap-balance">
                        Novidades do Manejo<span className="text-agro-ouro">Org</span>
                    </h1>
                    <p className="text-lg md:text-xl text-agro-floresta/60 leading-relaxed max-w-2xl mx-auto font-medium">
                        Acompanhe cada melhoria, nova ferramenta e ajuste que criamos para simplificar sua vida no campo.
                    </p>
                </section>

                {/* Timeline Container */}
                <div className="max-w-4xl mx-auto relative">
                    {/* Vertical Line */}
                    <div className="absolute left-[11px] md:left-1/2 md:-ml-[0.5px] top-4 bottom-0 w-[1px] bg-slate-200/80" />

                    <div className="space-y-24">
                        {changelogData.map((entry, index) => (
                            <div 
                                key={entry.version} 
                                className="relative grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 items-start animate-pmo-reveal"
                                style={{ animationDelay: `${index * 150}ms` }}
                            >
                                {/* Dot Marker */}
                                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-2 z-10 flex items-center justify-center">
                                    <div className="w-[23px] h-[23px] rounded-full bg-agro-creme border-2 border-agro-floresta/10 flex items-center justify-center group shadow-sm">
                                        <div className="w-2.5 h-2.5 rounded-full bg-agro-ouro shadow-[0_0_10px_rgba(197,160,89,0.4)]" />
                                    </div>
                                </div>

                                {/* Metadata (Versão & Data) */}
                                <div className={`pl-10 md:pl-0 pt-1 flex flex-col ${index % 2 === 0 ? 'md:items-end md:text-right' : 'md:col-start-2'}`}>
                                    <div className="flex items-center gap-1.5 text-agro-ouro font-black text-sm mb-1 tracking-widest uppercase">
                                        {entry.version}
                                    </div>
                                    <div className={`flex items-center gap-2 text-agro-floresta/40 text-xs font-bold uppercase tracking-wider ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                                        <Calendar size={13} className="text-agro-floresta/30" />
                                        {formatDate(entry.date)}
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className={`pl-10 md:pl-0 ${index % 2 === 0 ? 'md:col-start-2' : 'md:row-start-1 md:col-start-1 md:text-right'}`}>
                                    <h2 className="text-2xl font-black text-agro-floresta mb-3 tracking-tight">
                                        {entry.title}
                                    </h2>
                                    <p className="text-agro-floresta/70 leading-relaxed mb-8 font-medium">
                                        {entry.description}
                                    </p>

                                    <div className="space-y-8">
                                        {entry.sections.map((section, sIndex) => (
                                            <div key={sIndex} className={`space-y-4 ${index % 2 !== 0 ? 'md:flex md:flex-col md:items-end' : ''}`}>
                                                {/* Section Header */}
                                                <div className="flex items-center gap-2">
                                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-[0.1em] ${getTypeStyles(section.type).replace('emerald', 'agro-floresta').replace('blue', 'sky').replace('slate', 'stone').replace('amber', 'agro-ouro')}`}>
                                                        {getTypeIcon(section.type).props.className.includes('emerald') ? <Rocket size={14} className="text-agro-floresta" /> : getTypeIcon(section.type)}
                                                        {section.type === 'Improvements' ? 'Melhorias' :
                                                            section.type === 'Fixes' ? 'Correções' :
                                                            section.type === 'Patches' ? 'Ajustes' : 'Novidades'}
                                                    </div>
                                                </div>

                                                {/* Items List */}
                                                <ul className={`space-y-4 ${index % 2 !== 0 ? 'md:text-right' : ''}`}>
                                                    {section.items.map((item, iIndex) => (
                                                        <li key={iIndex} className={`flex gap-3 text-agro-floresta/80 text-[13px] leading-relaxed font-bold ${index % 2 !== 0 ? 'md:flex-row-reverse md:text-right' : ''}`}>
                                                            <div className={`mt-2 w-1.5 h-1.5 rounded-full bg-agro-ouro/40 shrink-0 ${index % 2 !== 0 ? 'md:mt-2' : ''}`} />
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer CTA */}
                <section className="max-w-3xl mx-auto mt-32 text-center p-12 rounded-[40px] bg-agro-floresta text-agro-creme border border-white/5 shadow-2xl relative overflow-hidden group">
                    <div className="absolute inset-0 bg-agro-ouro/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <h3 className="text-2xl font-black mb-4 tracking-tight">Dúvidas sobre as atualizações?</h3>
                    <p className="text-agro-creme/60 mb-8 font-bold leading-relaxed max-w-md mx-auto">Siga nosso canal oficial e acompanhe as demonstrações técnicas e novidades em tempo real.</p>
                    <a 
                        href="https://instagram.com/manejo_org" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-10 py-4 rounded-full bg-agro-ouro text-agro-floresta font-black hover:shadow-xl hover:shadow-agro-ouro/20 transition-all active:scale-95 text-sm uppercase tracking-widest"
                    >
                        Acessar Novidades @manejo<span className="opacity-50">org</span>
                    </a>
                </section>
            </main>
        </div>
    );
};

export default ChangelogPage;
