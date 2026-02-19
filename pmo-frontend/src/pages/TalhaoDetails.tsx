// src/pages/TalhaoDetails.tsx (Page version)

import React, { useState, ReactNode } from 'react';
import {
    ArrowLeft,
    FlaskConical,
    History,
    Layers,
    Microscope,
    Info,
    ChevronRight,
    Loader2
} from 'lucide-react';

// Types
interface Nutriente {
    label: string;
    valor: number;
    ideal: number;
    status: string;
    unit: string;
    color: string;
}

interface Analise {
    data_analise: string;
    profundidade: string;
    iqs: number;
    iqs_label: string;
    quimica: {
        ph: number;
        nutrientes: Nutriente[];
    };
    fisica: {
        argila: number;
        areia: number;
        silte: number;
        classificacao: string;
    };
}

interface Talhao {
    nome: string;
    area_ha?: number;
    area?: number;
    cultura?: string;
}

interface TabPanelProps {
    children: ReactNode;
    value: number;
    index: number;
}

interface NutrientGaugeProps {
    label: string;
    value: number;
    unit: string;
    min?: number;
    max?: number;
    ideal: number;
}

interface TalhaoDetailsProps {
    talhao: Talhao | null;
    onBack?: () => void;
}

// Mock data
const MOCK_ANALISE: Analise = {
    data_analise: '2023-09-15',
    profundidade: '0-20 cm',
    iqs: 78,
    iqs_label: 'Alta Fertilidade',
    quimica: {
        ph: 5.8,
        nutrientes: [
            { label: 'pH (H₂O)', valor: 5.8, ideal: 6.0, status: 'Médio', unit: '', color: 'warning' },
            { label: 'Saturação (V%)', valor: 60, ideal: 70, status: 'Médio', unit: '%', color: 'info' },
            { label: 'Fósforo (P)', valor: 12, ideal: 15, status: 'Baixo', unit: 'mg/dm³', color: 'warning' },
            { label: 'Potássio (K)', valor: 140, ideal: 120, status: 'Alto', unit: 'mg/dm³', color: 'success' }
        ]
    },
    fisica: {
        argila: 55,
        areia: 30,
        silte: 15,
        classificacao: 'MUITO ARGILOSO'
    }
};

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
    <div
        role="tabpanel"
        className={`${value !== index ? 'hidden' : 'block'} h-full overflow-y-auto`}
    >
        {value === index && <div className="p-6">{children}</div>}
    </div>
);

const NutrientGauge: React.FC<NutrientGaugeProps> = ({ label, value, unit, min = 0, max = 100, ideal }) => {
    const percentage = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
    const idealPercentage = Math.min(Math.max(((ideal - min) / (max - min)) * 100, 0), 100);

    let statusLabel = 'Ideal';
    let statusColorClass = 'bg-emerald-500';
    let statusBgClass = 'bg-emerald-50 text-emerald-700';

    if (value < ideal * 0.8) {
        statusLabel = 'Baixo';
        statusColorClass = 'bg-amber-500';
        statusBgClass = 'bg-amber-50 text-amber-700';
    } else if (value > ideal * 1.2) {
        statusLabel = 'Alto';
        statusColorClass = 'bg-rose-500';
        statusBgClass = 'bg-rose-50 text-rose-700';
    }

    if (label.includes('pH') && (value < 5.5 || value > 6.5)) {
        statusLabel = 'Atenção';
        statusColorClass = 'bg-amber-500';
        statusBgClass = 'bg-amber-50 text-amber-700';
    }

    return (
        <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-semibold text-slate-500">{label}</span>
                <span className="text-lg font-black text-slate-800">
                    {value} <span className="text-xs font-normal text-slate-400 ml-0.5">{unit}</span>
                </span>
            </div>

            <div className="relative h-2.5 bg-slate-100 rounded-full mb-2.5 overflow-hidden">
                <div
                    className={`absolute left-0 top-0 h-full ${statusColorClass} rounded-full transition-all duration-700 ease-out shadow-sm`}
                    style={{ width: `${percentage}%` }}
                />
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-slate-900 z-10"
                    style={{ left: `${idealPercentage}%` }}
                    title={`Ideal: ${ideal}`}
                />
            </div>

            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${statusBgClass}`}>
                {statusLabel}
            </span>
        </div>
    );
};

const TalhaoDetails: React.FC<TalhaoDetailsProps> = ({ talhao, onBack }) => {
    const [tabValue, setTabValue] = useState(1);

    if (!talhao) return null;

    const tabs = [
        { label: 'Visão Geral', icon: <Info size={18} /> },
        { label: 'Saúde do Solo', icon: <FlaskConical size={18} /> },
        { label: 'Histórico', icon: <History size={18} /> }
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans">
            {/* Header */}
            <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-4">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-colors border border-slate-100"
                    >
                        <ArrowLeft size={20} />
                    </button>
                )}
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                        {talhao.nome}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            {talhao.area_ha || talhao.area || '--'} ha
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                            {talhao.cultura || 'Cultura não definida'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="bg-white border-b border-slate-200 shrink-0 overflow-x-auto no-scrollbar">
                <nav className="flex px-2 space-x-1" aria-label="Tabs">
                    {tabs.map((tab, index) => (
                        <button
                            key={index}
                            onClick={() => setTabValue(index)}
                            className={`flex flex-1 items-center justify-center gap-2 py-4 px-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${tabValue === index
                                    ? 'border-green-600 text-green-700'
                                    : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto">
                {/* Tab 1: Visão Geral */}
                <TabPanel value={tabValue} index={0}>
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                        <Info size={48} className="text-slate-400 mb-4" />
                        <p className="text-slate-500 font-medium tracking-tight">
                            Visão operacional e status atual do talhão.
                        </p>
                    </div>
                </TabPanel>

                {/* Tab 2: Saúde do Solo */}
                <TabPanel value={tabValue} index={1}>
                    {/* IQS Card */}
                    <div className="bg-white rounded-3xl p-6 mb-8 border border-slate-200 shadow-sm flex items-center gap-6 bg-gradient-to-br from-white to-emerald-50/30">
                        <div className="relative shrink-0 flex items-center justify-center">
                            <svg className="w-24 h-24 transform -rotate-90">
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    className="text-slate-100"
                                />
                                <circle
                                    cx="48"
                                    cy="48"
                                    r="40"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={2 * Math.PI * 40}
                                    strokeDashoffset={2 * Math.PI * 40 * (1 - MOCK_ANALISE.iqs / 100)}
                                    className="text-emerald-500 stroke-round transition-all duration-1000 ease-in-out"
                                />
                            </svg>
                            <span className="absolute text-2xl font-black text-slate-800 tracking-tighter">
                                {MOCK_ANALISE.iqs}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black tracking-[0.2em] text-emerald-600 uppercase mb-1 block">
                                ÍNDICE DE QUALIDADE (IQS)
                            </span>
                            <h3 className="text-xl font-bold text-slate-800 leading-tight">
                                {MOCK_ANALISE.iqs_label}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1 capitalize">
                                Solo com boa fertilidade geral.
                            </p>
                        </div>
                    </div>

                    {/* Química Section */}
                    <div className="mb-10">
                        <div className="flex items-center gap-2 mb-6">
                            <Microscope size={18} className="text-slate-400" />
                            <h4 className="text-xs font-black tracking-widest text-slate-500 uppercase">
                                Análise Química
                            </h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(MOCK_ANALISE.quimica.nutrientes || []).map((nutriente, index) => (
                                <div key={index} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-colors">
                                    <NutrientGauge
                                        label={nutriente.label}
                                        value={nutriente.valor}
                                        unit={nutriente.unit}
                                        ideal={nutriente.ideal}
                                        max={nutriente.label.includes('Potássio') ? 300 : 100}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Física Section */}
                    <div>
                        <div className="flex items-center gap-2 mb-6">
                            <Layers size={18} className="text-slate-400" />
                            <h4 className="text-xs font-black tracking-widest text-slate-500 uppercase">
                                Composição Física
                            </h4>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-sm font-bold text-slate-400 tracking-tight">Classe Textural</span>
                                <span className="px-3 py-1 bg-amber-900 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                                    {MOCK_ANALISE.fisica.classificacao}
                                </span>
                            </div>

                            {/* Textural Bar */}
                            <div className="h-4 rounded-full flex overflow-hidden border-2 border-white shadow-inner mb-6 ring-1 ring-slate-100">
                                <div
                                    className="h-full bg-slate-700 transition-all duration-1000"
                                    style={{ width: `${MOCK_ANALISE.fisica.argila}%` }}
                                    title={`Argila: ${MOCK_ANALISE.fisica.argila}%`}
                                />
                                <div
                                    className="h-full bg-slate-400 transition-all duration-1000"
                                    style={{ width: `${MOCK_ANALISE.fisica.silte}%` }}
                                    title={`Silte: ${MOCK_ANALISE.fisica.silte}%`}
                                />
                                <div
                                    className="h-full bg-amber-400 transition-all duration-1000"
                                    style={{ width: `${MOCK_ANALISE.fisica.areia}%` }}
                                    title={`Areia: ${MOCK_ANALISE.fisica.areia}%`}
                                />
                            </div>

                            {/* Legend */}
                            <div className="grid grid-cols-3 gap-2">
                                <div className="text-center group">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-700 mx-auto mb-2 shadow-sm" />
                                    <p className="text-[10px] font-bold text-slate-500">Argila</p>
                                    <p className="text-xs font-black text-slate-900">{MOCK_ANALISE.fisica.argila}%</p>
                                </div>
                                <div className="text-center group border-x border-slate-100">
                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400 mx-auto mb-2 shadow-sm" />
                                    <p className="text-[10px] font-bold text-slate-500">Silte</p>
                                    <p className="text-xs font-black text-slate-900">{MOCK_ANALISE.fisica.silte}%</p>
                                </div>
                                <div className="text-center group">
                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 mx-auto mb-2 shadow-sm" />
                                    <p className="text-[10px] font-bold text-slate-500">Areia</p>
                                    <p className="text-xs font-black text-slate-900">{MOCK_ANALISE.fisica.areia}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 text-center">
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">
                            Análise de {new Date(MOCK_ANALISE.data_analise).toLocaleDateString()}
                        </span>
                    </div>
                </TabPanel>

                {/* Tab 3: Histórico */}
                <TabPanel value={tabValue} index={2}>
                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                        <History size={48} className="text-slate-400 mb-4" />
                        <p className="text-slate-500 font-medium tracking-tight">
                            Rastreabilidade completa do talhão.
                        </p>
                    </div>
                </TabPanel>
            </div>
        </div>
    );
};

export default TalhaoDetails;
