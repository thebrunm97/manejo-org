// src/components/Common/PropertySelectorModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Home, MapPin, CheckCircle2, ArrowRightLeft, Loader2, Search, Settings, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Propriedade } from '../../domain/pmo/pmoTypes';
import { cn } from '../../utils/cn';
import { podeCriarPropriedade } from '../../utils/limitesCultivo';
import { toast } from 'react-toastify';

const MODALITY_CONFIG = {
    ORGANICO: { label: 'Orgânico', bg: 'bg-emerald-100', text: 'text-emerald-700' },
    TRANSICAO: { label: 'Transição', bg: 'bg-amber-100', text: 'text-amber-700' },
    CONVENCIONAL: { label: 'Convencional', bg: 'bg-slate-100', text: 'text-slate-600' },
};

interface PropertySelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PropertySelectorModal: React.FC<PropertySelectorModalProps> = ({ isOpen, onClose }) => {
    const { allPropriedades, currentPropriedade, switchPropriedade, profile } = useAuth();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [switchingId, setSwitchingId] = useState<number | null>(null);

    // Reset search when modal opens
    useEffect(() => {
        if (isOpen) setSearch('');
    }, [isOpen]);

    if (!isOpen) return null;

    const filtered = allPropriedades.filter(p =>
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        (p.endereco_cadastral ?? '').toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = async (farm: Propriedade) => {
        if (farm.id === currentPropriedade?.id) {
            onClose();
            return;
        }
        setSwitchingId(farm.id);
        await switchPropriedade(farm);
        setSwitchingId(null);
        onClose();
    };

    const handleManage = () => {
        onClose();
        navigate('/propriedade');
    };

    const handleCreateNew = () => {
        const { can, message } = podeCriarPropriedade(profile, allPropriedades.length);
        if (!can) {
            toast.info(message, {
                icon: <span>🌱</span>
            });
            return;
        }
        onClose();
        navigate('/onboarding');
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal Panel */}
            <div className="fixed z-[201] inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-[480px] max-h-[85vh] flex flex-col bg-white rounded-3xl shadow-2xl shadow-black/20 animate-in fade-in slide-in-from-bottom-4 duration-300">

                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <ArrowRightLeft size={16} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-black text-slate-900">Trocar Fazenda</h2>
                            <p className="text-xs text-slate-400 font-medium">{allPropriedades.length} propriedades disponíveis</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Search */}
                {allPropriedades.length > 3 && (
                    <div className="px-6 pt-4">
                        <div className="relative">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar propriedade..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>
                )}

                {/* Farm List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {filtered.length === 0 && (
                        <p className="text-center text-sm text-slate-400 font-medium py-8">
                            Nenhuma propriedade encontrada.
                        </p>
                    )}

                    {filtered.map(farm => {
                        const isActive = farm.id === currentPropriedade?.id;
                        const isLoading = switchingId === farm.id;
                        const modality = MODALITY_CONFIG[farm.modalidade_predominante] ?? MODALITY_CONFIG.CONVENCIONAL;

                        return (
                            <button
                                key={farm.id}
                                onClick={() => handleSelect(farm)}
                                disabled={!!switchingId}
                                className={cn(
                                    "w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200",
                                    "disabled:opacity-60 disabled:cursor-not-allowed",
                                    isActive
                                        ? "border-emerald-400 bg-emerald-50/50"
                                        : "border-slate-100 bg-slate-50/50 hover:border-emerald-200 hover:bg-emerald-50/30"
                                )}
                            >
                                {/* Icon */}
                                <div className={cn(
                                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                                    isActive ? "bg-emerald-500 text-white" : "bg-white border border-slate-200 text-slate-400"
                                )}>
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Home size={18} />}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-bold text-slate-900 text-sm truncate">{farm.nome}</p>
                                        {isActive && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", modality.bg, modality.text)}>
                                            {modality.label}
                                        </span>
                                        {farm.area_total_ha > 0 && (
                                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                <MapPin size={10} />
                                                {farm.area_total_ha.toLocaleString('pt-BR')} ha
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 flex flex-col gap-2">
                    <button
                        onClick={handleCreateNew}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition-all shadow-md shadow-emerald-900/10 active:scale-[0.98]"
                    >
                        <Plus size={16} strokeWidth={3} />
                        Nova Propriedade
                    </button>
                    
                    <button
                        onClick={handleManage}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors"
                    >
                        <Settings size={15} />
                        Gerenciar Propriedades
                    </button>
                </div>
            </div>
        </>
    );
};

export default PropertySelectorModal;
