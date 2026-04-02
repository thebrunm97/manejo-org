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

    return (
        <div className="min-h-screen bg-white font-sans selection:bg-emerald-100 selection:text-emerald-900">
            {/* Header / Nav */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <button
                        onClick={handleBack}
                        className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        <div className="p-2 rounded-full group-hover:bg-slate-100 transition-colors">
                            <ArrowLeft size={18} />
                        </div>
                        <span className="text-sm font-medium">Voltar</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200 mx-4 hidden sm:block" />
                    <div className="flex-1 hidden sm:flex items-center">
                        <span className="text-sm font-semibold text-slate-900">Release Notes</span>
                    </div>
                </div>
            </header>

            <main className="pt-32 pb-24 px-6 md:px-8">
                {/* Hero Section */}
                <section className="max-w-3xl mx-auto text-center mb-24 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold mb-6 tracking-wide uppercase">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Versão Atual: {latestVersion}
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight leading-[1.1]">
                        Novidades do <span className="text-emerald-600">ManejoORG</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto">
                        Acompanhe em tempo real cada melhoria, nova ferramenta e ajuste que criamos para simplificar sua vida no campo.
                    </p>
                </section>

                {/* Timeline Container */}
                <div className="max-w-4xl mx-auto relative">
                    {/* Vertical Line */}
                    <div className="absolute left-[11px] md:left-1/2 md:-ml-[0.5px] top-4 bottom-0 w-[1px] bg-slate-200/80" />

                    <div className="space-y-24">
                        {changelogData.map((entry, index) => (
                            <div key={index} className="relative grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-24 items-start">
                                {/* Dot Marker */}
                                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 top-2 z-10 flex items-center justify-center">
                                    <div className="w-[23px] h-[23px] rounded-full bg-white border-2 border-slate-200 flex items-center justify-center group">
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
                                    </div>
                                </div>

                                {/* Link Metadata (Mobile & Desktop split) */}
                                <div className={`pl-10 md:pl-0 pt-1 flex flex-col ${index % 2 === 0 ? 'md:items-end md:text-right' : 'md:col-start-2'}`}>
                                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm mb-1">
                                        {entry.version}
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                                        <Calendar size={14} />
                                        {entry.date}
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className={`pl-10 md:pl-0 ${index % 2 === 0 ? 'md:col-start-2' : 'md:row-start-1 md:col-start-1 md:text-right'}`}>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">
                                        {entry.title}
                                    </h2>
                                    <p className="text-slate-600 leading-relaxed mb-8">
                                        {entry.description}
                                    </p>

                                    <div className="space-y-8">
                                        {entry.sections.map((section, sIndex) => (
                                            <div key={sIndex} className={`space-y-4 ${index % 2 !== 0 ? 'md:flex md:flex-col md:items-end' : ''}`}>
                                                {/* Section Header */}
                                                <div className="flex items-center gap-2">
                                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getTypeStyles(section.type)}`}>
                                                        {getTypeIcon(section.type)}
                                                        {section.type === 'Improvements' ? 'Melhorias' :
                                                            section.type === 'Fixes' ? 'Correções' :
                                                            section.type === 'Patches' ? 'Ajustes' : 'Novidades'}
                                                    </div>
                                                </div>

                                                {/* Items List */}
                                                <ul className={`space-y-3 ${index % 2 !== 0 ? 'md:text-right' : ''}`}>
                                                    {section.items.map((item, iIndex) => (
                                                        <li key={iIndex} className={`flex gap-3 text-slate-600 text-sm leading-relaxed ${index % 2 !== 0 ? 'md:flex-row-reverse md:text-right' : ''}`}>
                                                            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0 ${index % 2 !== 0 ? 'md:mt-1.5' : ''}`} />
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
                <section className="max-w-3xl mx-auto mt-32 text-center p-12 rounded-[32px] bg-slate-50 border border-slate-100">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Quer saber mais?</h3>
                    <p className="text-slate-500 mb-6 font-medium">Fique por dentro das novidades em tempo real seguindo nosso Instagram.</p>
                    <a 
                        href="https://instagram.com/manejo_org" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
                    >
                        Seguir @manejo_org
                    </a>
                </section>
            </main>
        </div>
    );
};

export default ChangelogPage;
