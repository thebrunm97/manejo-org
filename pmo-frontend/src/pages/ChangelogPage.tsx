import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { changelogData } from '../data/changelog';
import {
    ChevronDown,
    Tag,
    Calendar,
    CheckCircle,
    AlertCircle,
    Zap,
    Star,
    ArrowLeft
} from 'lucide-react';

const ChangelogPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const handleBack = () => {
        navigate(user ? '/dashboard' : '/');
    };

    // Helper para ícones por tipo
    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Improvements': return <Zap size={16} className="text-amber-500" />;
            case 'Fixes': return <CheckCircle size={16} className="text-emerald-500" />;
            case 'Patches': return <AlertCircle size={16} className="text-rose-500" />;
            case 'New': return <Star size={16} className="text-blue-500" />;
            default: return <Tag size={16} />;
        }
    };

    const getTypeColorClasses = (type: string) => {
        switch (type) {
            case 'Improvements': return 'bg-amber-50 text-amber-700 border-amber-100';
            case 'Fixes': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'Patches': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'New': return 'bg-blue-50 text-blue-700 border-blue-100';
            default: return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Nav Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
                    <button
                        onClick={handleBack}
                        className="p-2 mr-3 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900">Novidades</h1>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="mb-16 text-center">
                    <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                        Novidades e Atualizações
                    </h2>
                    <p className="text-lg text-slate-500">
                        Acompanhe a evolução do Manejo Orgânico.
                    </p>
                </div>

                <div className="flex flex-col gap-16">
                    {changelogData.map((entry, index) => (
                        <div key={index} className="flex flex-col md:flex-row gap-8">
                            {/* Left: Version Info */}
                            <div className="w-full md:w-52 shrink-0 pt-2">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tighter">
                                    {entry.version}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-2 text-slate-500">
                                    <Calendar size={14} />
                                    <span className="text-sm font-medium">
                                        {entry.date}
                                    </span>
                                </div>
                            </div>

                            {/* Right: Content Card */}
                            <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm shadow-slate-200/50 overflow-hidden">
                                <div className="p-8 md:p-10">
                                    <h4 className="text-2xl font-bold text-slate-800 mb-4 tracking-tight">
                                        {entry.title}
                                    </h4>
                                    <p className="text-slate-600 text-lg leading-relaxed mb-10">
                                        {entry.description}
                                    </p>

                                    <div className="space-y-10">
                                        {entry.sections.map((section, sIndex) => (
                                            <div key={sIndex} className="space-y-6">
                                                {/* Section Header */}
                                                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                                                    <div className={`p-1.5 rounded-lg flex items-center justify-center ${getTypeColorClasses(section.type)}`}>
                                                        {getTypeIcon(section.type)}
                                                    </div>
                                                    <span className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                                        {section.type === 'Improvements' ? 'Melhorias' :
                                                            section.type === 'Fixes' ? 'Correções' :
                                                                section.type === 'Patches' ? 'Ajustes' : 'Novidades'}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${getTypeColorClasses(section.type)} border`}>
                                                        {section.items.length}
                                                    </span>
                                                </div>

                                                {/* Items List */}
                                                <ul className="space-y-4 ml-2">
                                                    {section.items.map((item, iIndex) => (
                                                        <li key={iIndex} className="flex gap-3 text-slate-600 relative">
                                                            <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0" />
                                                            <span className="text-base leading-relaxed">{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default ChangelogPage;
