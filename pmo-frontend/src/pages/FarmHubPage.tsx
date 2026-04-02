// src/pages/FarmHubPage.tsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, MapPin, Layers, ArrowRight, CheckCircle2, Loader2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Propriedade } from '../domain/pmo/pmoTypes';
import { cn } from '../utils/cn';
import { podeCriarPropriedade } from '../utils/limitesCultivo';
import { toast } from 'react-toastify';

const MODALITY_CONFIG = {
    ORGANICO: { label: 'Orgânico', bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500' },
    TRANSICAO: { label: 'Transição', bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500' },
    CONVENCIONAL: { label: 'Convencional', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
};

interface FarmCardProps {
    farm: Propriedade;
    isActive: boolean;
    onSelect: (farm: Propriedade) => void;
    isLoading: boolean;
}

const FarmCard: React.FC<FarmCardProps> = ({ farm, isActive, onSelect, isLoading }) => {
    const modality = MODALITY_CONFIG[farm.modalidade_predominante] ?? MODALITY_CONFIG.CONVENCIONAL;

    return (
        <button
            onClick={() => onSelect(farm)}
            disabled={isLoading}
            className={cn(
                "group relative w-full text-left bg-white rounded-3xl border-2 p-8 shadow-sm",
                "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed",
                isActive
                    ? "border-emerald-500 shadow-emerald-100/80 shadow-lg"
                    : "border-slate-200 hover:border-emerald-300"
            )}
        >
            {/* Active Badge */}
            {isActive && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-emerald-500 text-white rounded-full text-xs font-bold">
                    <CheckCircle2 size={12} />
                    Ativa
                </div>
            )}

            {/* Card Header */}
            <div className="flex items-start gap-4 mb-6">
                <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                    isActive ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600"
                )}>
                    <Home size={26} />
                </div>
                <div className="min-w-0">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{farm.nome}</h3>
                    {farm.endereco_cadastral && (
                        <p className="text-sm text-slate-500 font-medium flex items-center gap-1 mt-1 truncate">
                            <MapPin size={12} className="shrink-0" />
                            {farm.endereco_cadastral}
                        </p>
                    )}
                </div>
            </div>

            {/* Modality Badge */}
            <div className="flex items-center gap-2 mb-6">
                <span className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold", modality.bg, modality.text)}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", modality.dot)} />
                    {modality.label}
                </span>
                {farm.tem_producao_paralela && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                        Paralela
                    </span>
                )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Área</p>
                    <p className="text-lg font-black text-slate-800">
                        {farm.area_total_ha > 0 ? farm.area_total_ha.toLocaleString('pt-BR') : '—'}
                        <span className="text-xs font-bold text-slate-400 ml-1">ha</span>
                    </p>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CAR</p>
                    <p className="text-sm font-bold text-slate-700 truncate">{farm.car || '—'}</p>
                </div>
            </div>

            {/* CTA */}
            <div className={cn(
                "mt-6 flex items-center justify-between py-3 px-4 rounded-2xl transition-all",
                isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-50 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700"
            )}>
                <span className="text-sm font-bold">
                    {isLoading ? 'Entrando...' : isActive ? 'Dashboard desta fazenda' : 'Abrir fazenda'}
                </span>
                {isLoading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                }
            </div>
        </button>
    );
};

const FarmHubPage: React.FC = () => {
    const navigate = useNavigate();
    const { allPropriedades, currentPropriedade, switchPropriedade, isLoadingRole, profile } = useAuth();
    const [selectingId, setSelectingId] = React.useState<number | null>(null);

    // If user ends up with only 1 or 0 properties, redirect to dashboard
    useEffect(() => {
        if (!isLoadingRole && allPropriedades.length === 1) {
            navigate('/dashboard', { replace: true });
        }
    }, [allPropriedades.length, isLoadingRole, navigate]);

    const handleSelect = async (farm: Propriedade) => {
        setSelectingId(farm.id);
        await switchPropriedade(farm);
        navigate('/dashboard', { replace: true });
    };

    const handleCreateNew = () => {
        const { can, message } = podeCriarPropriedade(profile, allPropriedades.length);
        if (!can) {
            toast.info(message, {
                position: "bottom-center",
                autoClose: 6000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                icon: <span>🌱</span>
            });
            return;
        }
        navigate('/onboarding');
    };

    if (isLoadingRole) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-4 py-12">
            <div className="max-w-5xl mx-auto">

                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full text-sm font-bold text-emerald-700 mb-6">
                        <Layers size={14} />
                        Central de Propriedades
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">
                        Qual fazenda vamos gerenciar?
                    </h1>
                    <p className="text-slate-500 font-medium max-w-md mx-auto">
                        Selecione a propriedade para acessar seu dashboard, caderno de campo e mapa.
                    </p>

                    <button
                        onClick={handleCreateNew}
                        className="mt-8 inline-flex items-center gap-2 px-8 py-3.5 bg-white border-2 border-emerald-500 text-emerald-600 font-black rounded-3xl hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-100 hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <Plus size={20} />
                        Nova Propriedade
                    </button>
                </div>

                {/* Farm Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allPropriedades.map(farm => (
                        <FarmCard
                            key={farm.id}
                            farm={farm}
                            isActive={currentPropriedade?.id === farm.id}
                            onSelect={handleSelect}
                            isLoading={selectingId === farm.id}
                        />
                    ))}
                </div>

                {allPropriedades.length === 0 && (
                    <div className="text-center py-20">
                        <Home size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-500 font-medium">Nenhuma propriedade cadastrada ainda.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FarmHubPage;
