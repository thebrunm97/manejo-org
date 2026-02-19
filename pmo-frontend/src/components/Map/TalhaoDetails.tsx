// src/components/Map/TalhaoDetails.tsx

import React, { useState, useEffect, ReactNode } from 'react';
import {
    ArrowLeft,
    FlaskConical,
    History,
    Layers,
    Microscope,
    Info,
    ChevronRight,
    Loader2,
    Plus,
    Edit2
} from 'lucide-react';
import { analiseService } from '../../services/analiseService';
import { soilLogic } from '../../utils/soilLogic';
import AnaliseFormDialog from './AnaliseFormDialog';
import { cn } from '../../utils/cn';

// Types
interface Analise {
    id?: string;
    data_analise?: string;
    ph?: number;
    fosforo?: number;
    potassio?: number;
    calcio?: number;
    magnesio?: number;
    saturacao_bases?: number;
    materia_organica?: number;
    argila?: number;
    areia?: number;
    silte?: number;
}

interface Talhao {
    id: string;
    nome: string;
    cultura?: string;
    area_ha?: number;
}

interface NutrientGaugeProps {
    label: string;
    value?: number;
    unit: string;
    ideal?: number;
    max?: number;
}

interface TalhaoDetailsProps {
    talhao: Talhao | null;
    onBack?: () => void;
}

const NutrientGauge: React.FC<NutrientGaugeProps> = ({ label, value, unit, ideal, max = 100 }) => {
    const numValue = value || 0;
    const percentage = Math.min((numValue / (ideal ? ideal * 1.5 : max)) * 100, 100);
    const idealPos = ideal ? (ideal / (ideal * 1.5)) * 100 : null;

    // Gradient from Red (deficiency) to Yellow (transition) to Green (ideal) to Dark Green (excess)
    const bgGradient = 'linear-gradient(90deg, #ef4444 0%, #f59e0b 40%, #10b981 80%, #065f46 100%)';

    return (
        <div className="mb-4">
            <div className="flex justify-between items-end mb-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-base font-extrabold text-slate-900">{numValue}</span>
                    <span className="text-[10px] font-medium text-slate-400">{unit}</span>
                </div>
            </div>
            <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
                <div
                    className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                    style={{
                        width: `${percentage}%`,
                        background: bgGradient
                    }}
                />

                {/* Marker for current value */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10 shadow-[0_0_2px_rgba(255,255,255,0.8)]"
                    style={{ left: `calc(${percentage}% - 1px)` }}
                />

                {/* Ideal Marker */}
                {idealPos && (
                    <div
                        className="absolute top-[-2px] bottom-[-2px] w-1 bg-blue-500 z-20 group cursor-help transition-transform hover:scale-y-125"
                        style={{ left: `calc(${idealPos}% - 0.5px)` }}
                        title={`Meta Ideal: ${ideal} ${unit}`}
                    >
                        <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 border-[3px] border-transparent border-t-blue-500" />
                    </div>
                )}
            </div>
        </div>
    );
};

const TalhaoDetails: React.FC<TalhaoDetailsProps> = ({ talhao, onBack }) => {
    const [tabValue, setTabValue] = useState(1);
    const [analise, setAnalise] = useState<Analise | null>(null);
    const [loading, setLoading] = useState(false);
    const [openForm, setOpenForm] = useState(false);
    const [editingData, setEditingData] = useState<Analise | null>(null);

    const fetchAnalise = async () => {
        if (!talhao?.id) return;
        setLoading(true);
        try {
            const data = await analiseService.getLatestAnalise(talhao.id);
            setAnalise(data);
        } catch (error) {
            console.error("Erro ao carregar análise:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAnalise(); }, [talhao?.id]);

    const handleOpenNew = () => { setEditingData(null); setOpenForm(true); };
    const handleOpenEdit = () => { setEditingData(analise); setOpenForm(true); };

    if (!talhao) return null;

    const targets = soilLogic.getCropTargets(talhao.cultura);
    const classificacaoSolo = analise ? soilLogic.getClassificacaoTextural(analise.argila) : '';

    const getNutrientesList = (dados: Analise | null): NutrientGaugeProps[] => {
        if (!dados) return [];
        return [
            { label: 'pH (H₂O)', value: dados.ph, ideal: targets.ph_ideal, unit: '', max: 14 },
            { label: 'Saturação (V%)', value: dados.saturacao_bases, ideal: targets.v_ideal, unit: '%', max: 100 },
            { label: 'Fósforo (P)', value: dados.fosforo, ideal: 15, unit: 'mg/dm³', max: 100 },
            { label: 'Potássio (K)', value: dados.potassio, ideal: 120, unit: 'mg/dm³', max: 300 },
            { label: 'Cálcio (Ca)', value: dados.calcio, ideal: 3, unit: 'cmol', max: 10 },
            { label: 'Magnésio (Mg)', value: dados.magnesio, ideal: 1, unit: 'cmol', max: 5 },
            { label: 'M.O.', value: dados.materia_organica, ideal: 3, unit: '%', max: 10 },
        ].filter(n => n.value != null);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="shrink-0 bg-white p-4 border-b border-slate-200 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h3 className="text-lg font-extrabold text-slate-900 leading-tight">{talhao.nome}</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                            {talhao.cultura || 'Sem cultura'}
                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                            {Number(talhao.area_ha).toFixed(2)} ha
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleOpenNew}
                    className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl border border-blue-100 shadow-sm transition-all active:scale-95"
                    title="Nova Análise"
                >
                    <Plus size={20} />
                </button>
            </div>

            {/* Tabs */}
            <div className="shrink-0 flex bg-white border-b border-slate-200 z-[5]">
                <button
                    onClick={() => setTabValue(0)}
                    className={cn(
                        "flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2",
                        tabValue === 0 ? "text-green-600 border-green-600 bg-green-50/30" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                >
                    Geral
                </button>
                <button
                    onClick={() => setTabValue(1)}
                    className={cn(
                        "flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2",
                        tabValue === 1 ? "text-green-600 border-green-600 bg-green-50/30" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                >
                    <Microscope size={14} />
                    Solo
                </button>
                <button
                    onClick={() => setTabValue(2)}
                    className={cn(
                        "flex-1 py-3 text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2",
                        tabValue === 2 ? "text-green-600 border-green-600 bg-green-50/30" : "text-slate-400 border-transparent hover:text-slate-600"
                    )}
                >
                    <History size={14} />
                    Histórico
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide pb-20">

                {tabValue === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                                <Loader2 size={40} className="animate-spin text-green-500 opacity-50" />
                                <span className="text-sm font-medium tracking-wide">Analizando solo...</span>
                            </div>
                        ) : !analise ? (
                            <div className="text-center py-12 px-6 bg-white border border-slate-200 border-dashed rounded-3xl">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <FlaskConical size={32} />
                                </div>
                                <h4 className="text-lg font-bold text-slate-900 mb-1">Sem dados recentes</h4>
                                <p className="text-sm text-slate-500 mb-6">Cadastre sua primeira análise de solo para gerar insights sobre fertilidade.</p>
                                <button
                                    onClick={handleOpenNew}
                                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} />
                                    Registrar Análise
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* IQS Indicator Card */}
                                <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 shadow-sm group">
                                    {/* Glassmorphism gradient */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 blur-3xl -mr-16 -mt-16 group-hover:bg-green-500/10 transition-colors" />

                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[10px] font-extrabold text-green-600 uppercase tracking-widest bg-green-50 px-2 py-0.5 rounded-lg border border-green-100">
                                                Saturação por Bases (V%)
                                            </span>
                                            <div className="flex items-baseline gap-2 mt-2">
                                                <h2 className="text-5xl font-extrabold text-slate-900 leading-none">
                                                    {analise.saturacao_bases ? Math.round(analise.saturacao_bases) : '-'}
                                                </h2>
                                                <span className="text-xl font-bold text-slate-400">%</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-3">
                                                <div className={cn(
                                                    "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tight",
                                                    analise.saturacao_bases && analise.saturacao_bases >= targets.v_ideal
                                                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                                                        : "bg-amber-500 text-white shadow-sm shadow-amber-200"
                                                )}>
                                                    {analise.saturacao_bases && analise.saturacao_bases >= targets.v_ideal ? 'Alta Fertilidade' : 'Abaixo da Meta'}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400">Meta: {targets.v_ideal}%</span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col items-end gap-3">
                                            <button
                                                onClick={handleOpenEdit}
                                                className="p-2 bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-white hover:shadow-md border border-slate-100 rounded-xl transition-all"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <div className="text-right">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Última Análise</p>
                                                <p className="text-[11px] font-bold text-slate-600">{new Date(analise.data_analise || '').toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Nutrients Grid */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <FlaskConical size={14} className="text-blue-500" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Química do Solo</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {getNutrientesList(analise).map((n, i) => (
                                            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-colors">
                                                <NutrientGauge {...n} />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Textura Card */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <Layers size={14} className="text-amber-600" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Textura Física</span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">Classificação</p>
                                                <h4 className="text-base font-black text-slate-800 tracking-tight">{classificacaoSolo}</h4>
                                            </div>
                                            <div className="px-3 py-1 bg-[#451a03] text-white text-[10px] font-black rounded-full uppercase">
                                                Solo Mineral
                                            </div>
                                        </div>

                                        {/* Stacked Texture Bar */}
                                        <div className="relative h-10 w-full bg-slate-100 rounded-2xl overflow-hidden flex shadow-inner border border-slate-200/50">
                                            <div className="group relative h-full bg-[#5D4037] transition-all duration-1000 border-r border-white/20 flex items-center justify-center overflow-hidden" style={{ width: `${analise.argila || 0}%` }}>
                                                {(analise.argila || 0) > 15 && <span className="text-[10px] font-black text-white/90">{analise.argila}%</span>}
                                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="group relative h-full bg-slate-400 transition-all duration-1000 border-r border-white/20 flex items-center justify-center overflow-hidden" style={{ width: `${analise.silte || 0}%` }}>
                                                {(analise.silte || 0) > 15 && <span className="text-[10px] font-black text-white/90">{analise.silte}%</span>}
                                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="group relative h-full bg-amber-400 transition-all duration-1000 flex items-center justify-center overflow-hidden" style={{ width: `${analise.areia || 0}%` }}>
                                                {(analise.areia || 0) > 15 && <span className="text-[10px] font-black text-[#5D4037]">{analise.areia}%</span>}
                                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </div>

                                        {/* Legend */}
                                        <div className="mt-6 flex justify-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#5D4037]" />
                                                <span className="text-[11px] font-bold text-slate-500 uppercase">Argila</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                                <span className="text-[11px] font-bold text-slate-500 uppercase">Silte</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                <span className="text-[11px] font-bold text-slate-500 uppercase">Areia</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {tabValue === 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-12 text-center text-slate-400 flex flex-col items-center gap-4">
                        <div className="p-4 bg-white rounded-full border border-slate-100 shadow-sm">
                            <Layers size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium">Em breve: Histórico de Culturas</p>
                    </div>
                )}

                {tabValue === 2 && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-12 text-center text-slate-400 flex flex-col items-center gap-4">
                        <div className="p-4 bg-white rounded-full border border-slate-100 shadow-sm">
                            <History size={32} className="opacity-20" />
                        </div>
                        <p className="text-sm font-medium">Em breve: Gráficos de Evolução</p>
                    </div>
                )}

            </div>

            <AnaliseFormDialog
                open={openForm}
                onClose={() => setOpenForm(false)}
                talhaoId={talhao.id}
                initialData={editingData}
                onSaveSuccess={() => { fetchAnalise(); setOpenForm(false); }}
            />
        </div>
    );
};

export default TalhaoDetails;
