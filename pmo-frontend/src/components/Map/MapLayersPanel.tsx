// src/components/Map/MapLayersPanel.tsx
//
// Painel de camadas do mapa (apresentação apenas — todo o estado continua no FarmMap).
// Substitui o bloco de controles que ficava no canto superior esquerdo, mantendo
// as mesmas capacidades: escolha de camada, período, opacidade, status e legenda.

import React from 'react';
import { Layers, Calendar, SlidersHorizontal, Info, AlertTriangle, Loader2, X } from 'lucide-react';
import { SatelliteTileResponse } from '../../services/mapService';
import { cn } from '../../utils/cn';

export type MapLayerType = 'base' | 'sentinel_rgb' | 'sentinel_ndvi';

interface MapLayersPanelProps {
    open: boolean;
    onToggle: () => void;
    layerType: MapLayerType;
    onLayerTypeChange: (layer: MapLayerType) => void;
    period: string;
    onPeriodChange: (period: string) => void;
    opacity: number;
    onOpacityChange: (opacity: number) => void;
    tileLoading: boolean;
    tileError: string | null;
    tileData: SatelliteTileResponse | null;
    /** Estado do calculo de NDVI medio por talhao (sob demanda). */
    zonalLoading?: boolean;
    zonalError?: string | null;
    /** Quantos talhoes ficaram sem medida por nuvem/ausencia de cena. */
    zonalSemImagem?: number;
}

const LAYER_OPTIONS: { value: MapLayerType; label: string; preview: React.ReactNode }[] = [
    {
        value: 'base',
        label: 'Mapa-base',
        preview: (
            <div className="absolute inset-0 bg-[#2b3a22]">
                <div className="absolute -inset-[20%] grid grid-cols-3 grid-rows-2 gap-1 rotate-[-11deg]">
                    {['#4ade80', '#fb7185', '#16a34a', '#fbbf24', '#a78bfa', '#38bdf8'].map((cor) => (
                        <span key={cor} className="rounded-[3px]" style={{ background: cor, opacity: 0.8 }} />
                    ))}
                </div>
            </div>
        ),
    },
    {
        value: 'sentinel_rgb',
        label: 'Satélite RGB',
        preview: (
            <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(80% 80% at 30% 25%, #6b7f4a 0%, #3f5230 45%, #26361f 100%)' }}
            />
        ),
    },
    {
        value: 'sentinel_ndvi',
        label: 'NDVI (vigor)',
        preview: (
            <div
                className="absolute inset-0"
                style={{ background: 'radial-gradient(70% 70% at 30% 30%, #166534 0%, #22c55e 38%, #facc15 68%, #d97706 100%)' }}
            />
        ),
    },
];

const MapLayersPanel: React.FC<MapLayersPanelProps> = ({
    open, onToggle, layerType, onLayerTypeChange, period, onPeriodChange,
    opacity, onOpacityChange, tileLoading, tileError, tileData,
    zonalLoading = false, zonalError = null, zonalSemImagem = 0,
}) => {
    const isSentinel = layerType !== 'base';
    const isMock = import.meta.env.VITE_USE_GEE_MOCK === 'true';

    return (
        <>
            {/* Botão do rail */}
            <button
                onClick={onToggle}
                aria-label="Camadas do mapa"
                aria-expanded={open}
                className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center transition-all pointer-events-auto',
                    open ? 'bg-slate-900 text-white' : 'bg-white/95 text-slate-700 hover:bg-white'
                )}
            >
                <Layers size={19} />
            </button>

            {open && (
                <div className="absolute right-[62px] top-0 w-[300px] max-w-[calc(100vw-5rem)] bg-white rounded-3xl p-5 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.55)] pointer-events-auto animate-in fade-in slide-in-from-right-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-base font-extrabold text-slate-900 tracking-tight">Camadas do mapa</span>
                        <button onClick={onToggle} aria-label="Fechar" className="text-slate-400 hover:text-slate-600">
                            <X size={17} />
                        </button>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Camada principal</div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {LAYER_OPTIONS.map((opt) => (
                            <button key={opt.value} onClick={() => onLayerTypeChange(opt.value)} className="text-left">
                                <div className={cn(
                                    'relative h-[60px] rounded-2xl overflow-hidden transition-all',
                                    layerType === opt.value ? 'ring-[3px] ring-emerald-600' : 'ring-2 ring-slate-200 hover:ring-slate-300'
                                )}>
                                    {opt.preview}
                                </div>
                                <div className={cn(
                                    'text-[11px] font-bold mt-1.5 leading-tight',
                                    layerType === opt.value ? 'text-slate-900' : 'text-slate-400'
                                )}>
                                    {opt.label}
                                </div>
                            </button>
                        ))}
                    </div>

                    {isSentinel && (
                        <div className="animate-in fade-in duration-200">
                            <div className="h-px bg-slate-200 mb-4" />

                            <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                <Calendar size={13} /> Período
                            </label>
                            <input
                                type="month"
                                value={period}
                                onChange={(e) => onPeriodChange(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/10 mb-4"
                            />

                            <label className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                                <span className="flex items-center gap-1.5"><SlidersHorizontal size={13} /> Opacidade</span>
                                <span className="text-slate-900">{Math.round(opacity * 100)}%</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={opacity}
                                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                                className="w-full accent-emerald-600 cursor-pointer mb-4"
                            />

                            {tileLoading ? (
                                <div className="flex items-center gap-2.5 bg-slate-50 rounded-2xl px-4 py-3.5 text-emerald-700">
                                    <Loader2 className="animate-spin shrink-0" size={18} />
                                    <span className="text-[12.5px] font-bold">Processando cena…</span>
                                </div>
                            ) : tileError ? (
                                <div className="flex items-start gap-2.5 bg-red-50 rounded-2xl px-4 py-3.5 text-red-600">
                                    <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                    <span className="flex flex-col">
                                        <span className="text-[13px] font-extrabold">Sem imagens</span>
                                        <span className="text-[11.5px] font-semibold opacity-90 leading-snug">{tileError}</span>
                                    </span>
                                </div>
                            ) : tileData ? (
                                <div className="bg-slate-50 rounded-2xl px-4 py-3.5">
                                    <div className="flex items-start gap-2.5">
                                        <Info size={16} className="shrink-0 mt-0.5 text-sky-500" />
                                        <span className="flex flex-col text-[11.5px] leading-snug text-slate-500">
                                            <span className="font-extrabold text-slate-700">
                                                {layerType === 'sentinel_rgb'
                                                    ? 'Camada simulada — estrutura raster validada'
                                                    : 'NDVI simulado — não utilizar para análise'}
                                            </span>
                                            <span>
                                                {isMock
                                                    ? `Cenas de referência: ${tileData.metadata.imageCount} (mock)`
                                                    : `${tileData.metadata.imageCount} cenas combinadas`}
                                            </span>
                                            <span>Nuvens &lt; {tileData.metadata.cloudThreshold}%</span>
                                            {isMock && (
                                                <span className="mt-2 w-max text-[10px] font-black uppercase tracking-widest text-orange-600 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1">
                                                    Modo desenvolvimento
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    {layerType === 'sentinel_ndvi' && (
                                        <div className="mt-3">
                                            <div className="h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg, #dc2626, #facc15, #16a34a)' }} />
                                            <div className="flex justify-between mt-1.5 text-[10px] font-bold text-slate-500">
                                                <span>-1 água/solo</span>
                                                <span>+1 vegetação densa</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {layerType === 'sentinel_ndvi' && (
                                <div className="mt-3">
                                    {zonalLoading ? (
                                        <div className="flex items-center gap-2.5 bg-slate-50 rounded-2xl px-4 py-3 text-slate-600">
                                            <Loader2 className="animate-spin shrink-0" size={16} />
                                            <span className="text-[12px] font-bold">Medindo NDVI por talhão…</span>
                                        </div>
                                    ) : zonalError ? (
                                        <div className="flex items-start gap-2.5 bg-amber-50 rounded-2xl px-4 py-3 text-amber-700">
                                            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                            <span className="text-[12px] font-bold leading-snug">{zonalError}</span>
                                        </div>
                                    ) : zonalSemImagem > 0 ? (
                                        <div className="flex items-start gap-2.5 bg-slate-50 rounded-2xl px-4 py-3 text-slate-600">
                                            <Info size={16} className="shrink-0 mt-0.5 text-slate-400" />
                                            <span className="text-[12px] font-bold leading-snug">
                                                {zonalSemImagem === 1
                                                    ? '1 talhão ficou em cinza: sem imagem sem nuvem no período.'
                                                    : `${zonalSemImagem} talhões ficaram em cinza: sem imagem sem nuvem no período.`}
                                            </span>
                                        </div>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default MapLayersPanel;
