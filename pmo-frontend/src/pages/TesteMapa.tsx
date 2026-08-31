// src/pages/TesteMapa.tsx
//
// Página de teste do redesenho do /mapa (rota pública: /teste-mapa).
// Usa imagem de satélite real (Google se houver VITE_GOOGLE_MAPS_TILES_KEY,
// senão o fallback ESRI) e talhões fictícios gerados em torno de um centro.
// Centro ajustável pela URL: /teste-mapa?lat=-22.9&lng=-47.1&z=15

import React, { useMemo, useState } from 'react';
import Map, { Source, Layer, Marker, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
    Layers, Crosshair, Printer, Sprout, Search, LayoutGrid, Map as MapIcon,
    ChevronLeft, ChevronDown, X, Check, Pencil, Calendar, Plus, ArrowUpRight, FlaskConical
} from 'lucide-react';
import { useSatelliteMapStyle, maxZoomForProvider } from '../components/Map/useSatelliteMapStyle';
import FarmMap from '../components/Map/FarmMap';
import type { Talhao } from '../domain/geo/geoTypes';
import { cn } from '../utils/cn';

type LayerMode = 'culturas' | 'ndvi';

interface TesteTalhao {
    id: string;
    codigo: string;
    nome: string;
    cultura: string;
    corCultura: string;
    corNdvi: string;
    ndvi: string;
    areaHa: string;
    canteiros: number;
    manejo: string;
    manejoStatus: string;
    status: 'ok' | 'plan' | 'warn';
    conformidade: string;
    ph: string;
    v: string;
    mo: string;
    analise: string;
    // posição relativa ao centro, em metros: [leste, norte, largura, altura]
    box: [number, number, number, number];
}

const TALHOES: TesteTalhao[] = [
    { id: 'norte', codigo: '#01', nome: 'Talhão Norte', cultura: 'Alface crespa · folhosas', corCultura: '#4ade80', corNdvi: '#22c55e', ndvi: '0,78', areaHa: '1,2', canteiros: 18, manejo: 'Transplantio', manejoStatus: 'Em andamento', status: 'ok', conformidade: '92%', ph: '6,2', v: '68', mo: '3,4', analise: 'mar/2025', box: [-160, 210, 300, 150] },
    { id: 'estufa', codigo: '#02', nome: 'Estufa 1', cultura: 'Tomate · solanáceas', corCultura: '#fb7185', corNdvi: '#4ade80', ndvi: '0,71', areaHa: '0,3', canteiros: 6, manejo: 'Poda e tutoramento', manejoStatus: 'Em andamento', status: 'ok', conformidade: '88%', ph: '6,5', v: '72', mo: '4,1', analise: 'fev/2025', box: [190, 210, 140, 150] },
    { id: 'saf', codigo: '#03', nome: 'Quintal Agroflorestal', cultura: 'SAF banana e café', corCultura: '#16a34a', corNdvi: '#15803d', ndvi: '0,86', areaHa: '2,4', canteiros: 9, manejo: 'Roçada seletiva', manejoStatus: 'Em andamento', status: 'ok', conformidade: '95%', ph: '5,9', v: '61', mo: '5,2', analise: 'abr/2025', box: [-235, -60, 150, 260] },
    { id: 'riacho', codigo: '#04', nome: 'Talhão do Riacho', cultura: 'Cenoura · raízes', corCultura: '#fbbf24', corNdvi: '#a3e635', ndvi: '0,64', areaHa: '0,8', canteiros: 12, manejo: 'Adubação de cobertura', manejoStatus: 'Programado', status: 'plan', conformidade: '84%', ph: '6,0', v: '58', mo: '2,9', analise: 'jan/2025', box: [-20, 30, 210, 120] },
    { id: 'sul', codigo: '#05', nome: 'Talhão Sul', cultura: 'Pousio · adubação verde', corCultura: '#a78bfa', corNdvi: '#facc15', ndvi: '0,44', areaHa: '1,6', canteiros: 0, manejo: 'Crotalária em floração', manejoStatus: 'Em andamento', status: 'ok', conformidade: '90%', ph: '5,7', v: '52', mo: '2,4', analise: 'dez/2024', box: [215, 30, 190, 120] },
    { id: 'pomar', codigo: '#06', nome: 'Pomar de Cima', cultura: 'Citros · fruteiras', corCultura: '#38bdf8', corNdvi: '#d97706', ndvi: '0,29', areaHa: '1,1', canteiros: 0, manejo: 'Controle de formiga', manejoStatus: 'Requer atenção', status: 'warn', conformidade: '76%', ph: '6,3', v: '64', mo: '3,0', analise: 'mai/2025', box: [60, -150, 340, 140] },
];

const STATUS_COLORS: Record<TesteTalhao['status'], { dot: string; text: string }> = {
    ok: { dot: 'bg-emerald-500', text: 'text-emerald-600' },
    plan: { dot: 'bg-sky-400', text: 'text-sky-600' },
    warn: { dot: 'bg-amber-500', text: 'text-amber-600' },
};

const EXTRAS = [
    { key: 'talhoes', label: 'Talhões' },
    { key: 'canteiros', label: 'Canteiros' },
    { key: 'analises', label: 'Análises de solo' },
    { key: 'medir', label: 'Medir' },
] as const;

/** Retângulo em torno do centro, deslocado em metros e girado alguns graus. */
const buildPolygon = (
    lat: number,
    lng: number,
    [east, north, width, height]: [number, number, number, number],
    rotationDeg: number
): [number, number][] => {
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
    const rad = (rotationDeg * Math.PI) / 180;

    const corners: [number, number][] = [
        [east - width / 2, north - height / 2],
        [east + width / 2, north - height / 2],
        [east + width / 2, north + height / 2],
        [east - width / 2, north + height / 2],
    ];

    const ring = corners.map(([x, y]) => {
        const rx = x * Math.cos(rad) - y * Math.sin(rad);
        const ry = x * Math.sin(rad) + y * Math.cos(rad);
        return [lng + rx / mPerDegLng, lat + ry / mPerDegLat] as [number, number];
    });

    return [...ring, ring[0]];
};

const centroid = (ring: [number, number][]): [number, number] => {
    const pts = ring.slice(0, -1);
    const lng = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
    const lat = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
    return [lng, lat];
};

const TesteMapa: React.FC = () => {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get('lat') ?? -21.5748);
    const lng = Number(params.get('lng') ?? -48.4302);
    const zoom = Number(params.get('z') ?? 15.6);

    const { style, provider, usingFallback } = useSatelliteMapStyle();
    const [layerMode, setLayerMode] = useState<LayerMode>('culturas');
    const [selectedId, setSelectedId] = useState<string>('saf');
    const [layersOpen, setLayersOpen] = useState(true);
    const [tab, setTab] = useState<'manejo' | 'solo'>('manejo');
    const [extras, setExtras] = useState<Record<string, boolean>>({
        talhoes: true, canteiros: false, analises: true, medir: false,
    });

    // ?real=1 monta o FarmMap de produção (investigação do primeiro paint do raster).
    // ?real=1&vazio=1 remove talhões e centro, tirando o fitBounds/flyTo que mascara o sintoma.
    const modoReal = params.get('real') === '1';
    const semDados = params.get('vazio') === '1';

    const geometrias = useMemo(
        () => TALHOES.map((t) => {
            const ring = buildPolygon(lat, lng, t.box, -11);
            return { talhao: t, ring, center: centroid(ring) };
        }),
        [lat, lng]
    );

    const geojson = useMemo(() => ({
        type: 'FeatureCollection' as const,
        features: geometrias.map(({ talhao, ring }) => ({
            type: 'Feature' as const,
            id: talhao.id,
            properties: {
                id: talhao.id,
                cor: layerMode === 'ndvi' ? talhao.corNdvi : talhao.corCultura,
                selecionado: talhao.id === selectedId,
            },
            geometry: { type: 'Polygon' as const, coordinates: [ring] },
        })),
    }), [geometrias, layerMode, selectedId]);

    const selecionado = TALHOES.find((t) => t.id === selectedId) ?? TALHOES[0];
    const status = STATUS_COLORS[selecionado.status];

    const handleMapClick = (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.id;
        if (typeof id === 'string') setSelectedId(id);
    };

    const chipClass = (on: boolean) =>
        cn(
            'flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-bold transition-all',
            on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
        );

    if (modoReal) {
        const talhoesReais: Talhao[] = semDados ? [] : geometrias.map(({ talhao, ring }, i) => ({
            id: i + 1,
            nome: talhao.nome,
            cultura: talhao.cultura,
            fill_color: talhao.corCultura,
            border_color: '#ffffff',
            geometry: JSON.stringify({ type: 'Polygon', coordinates: [ring] }),
        }));

        return (
            <div className="relative w-full h-screen overflow-hidden bg-slate-50">
                <FarmMap
                    talhoes={talhoesReais}
                    centerCoords={semDados ? null : { latitude: lat, longitude: lng }}
                />
                <div className="absolute left-6 bottom-6 z-10 bg-slate-900/80 text-white rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                    FarmMap de produção · {semDados ? 'sem talhões e sem centro' : 'com talhões'}
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen overflow-hidden bg-slate-50">
            {/* Monta o mapa só com o provedor resolvido, evitando um setStyle
                logo depois da montagem (ESRI -> Google). */}
            {provider === 'loading' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Carregando satélite…</span>
                </div>
            ) : (
            <Map
                key={provider}
                initialViewState={{ latitude: lat, longitude: lng, zoom }}
                mapStyle={style as any}
                maxZoom={maxZoomForProvider(provider)}
                interactiveLayerIds={['talhoes-fill']}
                onClick={handleMapClick}
                style={{ width: '100%', height: '100%' }}
            >
                <Source id="talhoes-teste" type="geojson" data={geojson}>
                    <Layer
                        id="talhoes-fill"
                        type="fill"
                        paint={{
                            'fill-color': ['get', 'cor'],
                            'fill-opacity': ['case', ['get', 'selecionado'], 0.62, 0.42],
                        }}
                    />
                    <Layer
                        id="talhoes-line"
                        type="line"
                        paint={{
                            'line-color': ['case', ['get', 'selecionado'], '#ffffff', 'rgba(255,255,255,0.55)'],
                            'line-width': ['case', ['get', 'selecionado'], 3.5, 1.5],
                        }}
                    />
                </Source>

                {extras.talhoes && geometrias.map(({ talhao, center }) => (
                    <Marker key={talhao.id} longitude={center[0]} latitude={center[1]} anchor="center">
                        {talhao.id === selectedId ? (
                            <div className="flex items-center gap-2.5 bg-white rounded-full pl-1.5 pr-4 py-1.5 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.5)] whitespace-nowrap">
                                <span className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center">
                                    <Sprout size={17} className="text-white" />
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{talhao.areaHa} ha</span>
                                    <span className="text-sm font-extrabold text-slate-900">{talhao.nome}</span>
                                </span>
                            </div>
                        ) : (
                            <button
                                onClick={() => setSelectedId(talhao.id)}
                                className="w-9 h-9 rounded-full bg-white/25 border border-white/45 backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-transform"
                            >
                                <span className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center">
                                    <Sprout size={13} className="text-white" />
                                </span>
                            </button>
                        )}
                    </Marker>
                ))}
            </Map>
            )}

            {/* FILTROS TOPO-ESQUERDA */}
            <div className="absolute left-6 top-6 z-10 flex gap-2.5">
                <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md rounded-full px-4 py-2.5 shadow-[0_10px_26px_-12px_rgba(15,23,42,0.5)]">
                    <span className="text-[13px] font-bold text-slate-900">Safra 2025/26</span>
                    <ChevronDown size={15} className="text-slate-500" />
                </div>
                <div className="flex items-center gap-2.5 bg-white/95 backdrop-blur-md rounded-full pl-4 pr-2.5 py-2.5 shadow-[0_10px_26px_-12px_rgba(15,23,42,0.5)]">
                    <span className="text-[13px] font-bold text-slate-900">Talhões</span>
                    <span className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center">
                        <ChevronDown size={14} className="text-white" />
                    </span>
                </div>
            </div>

            {/* TOGGLE CROQUI / SATÉLITE */}
            <div className="absolute left-1/2 -translate-x-1/2 top-6 z-10 flex gap-1 bg-white/95 backdrop-blur-md p-1.5 rounded-full shadow-[0_10px_26px_-12px_rgba(15,23,42,0.5)]">
                <span className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <LayoutGrid size={14} /> Croqui
                </span>
                <span className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-lg shadow-emerald-500/30">
                    <MapIcon size={14} /> Satélite
                </span>
            </div>

            {/* RAIL DE CONTROLES */}
            <div className="absolute right-6 top-6 z-10 flex flex-col gap-2 p-2 rounded-full bg-slate-900/30 backdrop-blur-md">
                <button
                    onClick={() => setLayersOpen((v) => !v)}
                    className={cn(
                        'w-11 h-11 rounded-full flex items-center justify-center transition-all',
                        layersOpen ? 'bg-slate-900 text-white' : 'bg-white/95 text-slate-700 hover:bg-white'
                    )}
                >
                    <Layers size={19} />
                </button>
                <button className="w-11 h-11 rounded-full bg-white/95 text-slate-700 flex items-center justify-center hover:bg-white transition-all">
                    <Crosshair size={19} />
                </button>
                <button className="w-11 h-11 rounded-full bg-white/95 text-slate-700 flex items-center justify-center hover:bg-white transition-all">
                    <Printer size={19} />
                </button>
            </div>

            {/* PAINEL DE CAMADAS */}
            {layersOpen && (
                <div className="absolute right-[84px] top-6 z-10 w-[300px] bg-white rounded-3xl p-5 shadow-[0_30px_60px_-24px_rgba(15,23,42,0.55)]">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-base font-extrabold text-slate-900 tracking-tight">Camadas do mapa</span>
                        <button onClick={() => setLayersOpen(false)} className="text-slate-400 hover:text-slate-600">
                            <X size={17} />
                        </button>
                    </div>

                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Camada principal</div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <button onClick={() => setLayerMode('culturas')} className="text-left">
                            <div className={cn(
                                'h-[74px] rounded-2xl overflow-hidden grid grid-cols-3 grid-rows-2 gap-1 p-1 bg-[#2b3a22]',
                                layerMode === 'culturas' ? 'ring-[3px] ring-emerald-600' : 'ring-2 ring-slate-200'
                            )}>
                                {TALHOES.map((t) => (
                                    <span key={t.id} className="rounded-[3px]" style={{ background: t.corCultura, opacity: 0.8 }} />
                                ))}
                            </div>
                            <div className={cn('text-[12.5px] font-bold mt-2', layerMode === 'culturas' ? 'text-slate-900' : 'text-slate-400')}>Culturas</div>
                        </button>
                        <button onClick={() => setLayerMode('ndvi')} className="text-left">
                            <div
                                className={cn(
                                    'h-[74px] rounded-2xl overflow-hidden',
                                    layerMode === 'ndvi' ? 'ring-[3px] ring-emerald-600' : 'ring-2 ring-slate-200'
                                )}
                                style={{ background: 'radial-gradient(70% 70% at 30% 30%, #166534 0%, #22c55e 38%, #facc15 68%, #d97706 100%)' }}
                            />
                            <div className={cn('text-[12.5px] font-bold mt-2', layerMode === 'ndvi' ? 'text-slate-900' : 'text-slate-400')}>NDVI (vigor)</div>
                        </button>
                    </div>

                    <div className="h-px bg-slate-200 mb-4" />
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Camadas adicionais</div>
                    <div className="flex flex-wrap gap-2">
                        {EXTRAS.map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setExtras((prev) => ({ ...prev, [key]: !prev[key] }))}
                                className={chipClass(extras[key])}
                            >
                                {extras[key] && <Check size={13} strokeWidth={3} />}
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* LEGENDA NDVI */}
            {layerMode === 'ndvi' && (
                <div className="absolute right-6 bottom-6 z-10 w-[234px] bg-white/95 backdrop-blur-md rounded-2xl px-4 py-3.5 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.6)]">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Índice de vegetação</div>
                    <div className="h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg, #b45309, #facc15, #4ade80, #15803d)' }} />
                    <div className="flex justify-between mt-1.5 text-[11px] font-bold text-slate-500">
                        <span>0,20 baixo</span><span>0,90 alto</span>
                    </div>
                    <div className="mt-2.5 text-[11px] font-semibold text-slate-400 leading-snug">Valores fictícios — página de teste de layout</div>
                </div>
            )}

            {/* PAINEL DO TALHÃO */}
            <div className="absolute left-6 top-[92px] z-10 w-[372px] bg-white rounded-[26px] p-5 shadow-[0_30px_70px_-28px_rgba(15,23,42,0.6)]">
                <div className="flex items-center justify-between mb-4">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-slate-500">
                        <ChevronLeft size={16} />
                        Talhão <span className="text-slate-900 font-extrabold">{selecionado.codigo}</span>
                    </span>
                    <X size={17} className="text-slate-400" />
                </div>

                <div className="flex items-center gap-3 mb-4">
                    <span className="w-[46px] h-[46px] rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                        <Sprout size={24} className="text-white" />
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[19px] font-extrabold tracking-tight text-slate-900 leading-tight truncate">{selecionado.nome}</span>
                        <span className="text-[13px] font-semibold text-slate-400 truncate">{selecionado.cultura}</span>
                    </span>
                    <span className="flex gap-1.5">
                        <span className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center"><Pencil size={16} className="text-emerald-600" /></span>
                        <span className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center"><Calendar size={16} className="text-emerald-600" /></span>
                        <span className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center"><Printer size={16} className="text-emerald-600" /></span>
                    </span>
                </div>

                <div className="flex gap-1 bg-slate-100 rounded-full p-1 mb-4">
                    {(['manejo', 'solo'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                'flex-1 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all',
                                tab === t ? 'bg-white text-slate-900 shadow-[0_6px_18px_-8px_rgba(15,23,42,0.35)]' : 'text-slate-400'
                            )}
                        >
                            {t === 'manejo' ? 'Manejo' : 'Solo'}
                        </button>
                    ))}
                </div>

                {tab === 'manejo' ? (
                    <div>
                        <div className="border border-slate-200 rounded-[20px] p-4 mb-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[15px] font-extrabold text-slate-900">{selecionado.manejo}</span>
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">Novo manejo <Plus size={14} strokeWidth={2.6} /></span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 mb-4">
                                <span className={cn('w-1.5 h-1.5 rounded-full', status.dot)} />
                                <span className={cn('text-[12.5px] font-bold', status.text)}>{selecionado.manejoStatus}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2.5">
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-[21px] font-extrabold tracking-tight text-slate-900">{selecionado.areaHa} <span className="text-xs font-bold text-slate-400">ha</span></span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Área</span>
                                </span>
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-[21px] font-extrabold tracking-tight text-slate-900">{selecionado.canteiros}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canteiros</span>
                                </span>
                                <span className="flex flex-col gap-0.5">
                                    <span className="text-[21px] font-extrabold tracking-tight text-slate-900">{selecionado.ndvi}</span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">NDVI médio</span>
                                </span>
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-[20px] p-4">
                            <div className="flex items-center justify-between mb-3.5">
                                <span className="text-[15px] font-extrabold text-slate-900">Conformidade PMO</span>
                                <span className="flex items-center gap-1 text-xs font-bold text-emerald-600">Ver plano <ArrowUpRight size={13} strokeWidth={2.6} /></span>
                            </div>
                            <div className="flex items-baseline gap-2 mb-3">
                                <span className="text-[30px] font-extrabold tracking-tighter text-slate-900">{selecionado.conformidade}</span>
                                <span className="text-[13px] font-bold text-slate-400">dos itens em dia</span>
                            </div>
                            <div className="flex gap-1 mb-3.5">
                                <span className="flex-[6] h-2.5 rounded-full bg-green-700" />
                                <span className="flex-[3] h-2.5 rounded-full bg-green-400" />
                                <span className="flex-[2] h-2.5 rounded-full bg-amber-400" />
                                <span className="flex-1 h-2.5 rounded-full bg-red-400" />
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { n: '12', l: 'Insumos', c: 'bg-green-700' },
                                    { n: '6', l: 'Sementes', c: 'bg-green-400' },
                                    { n: '3', l: 'Registros', c: 'bg-amber-400' },
                                    { n: '1', l: 'Pendente', c: 'bg-red-400' },
                                ].map((item) => (
                                    <span key={item.l} className="flex flex-col gap-0.5">
                                        <span className="text-sm font-extrabold text-slate-900">{item.n}</span>
                                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                                            <span className={cn('w-1.5 h-1.5 rounded-full', item.c)} />{item.l}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="grid grid-cols-3 gap-2.5 mb-3">
                            {[
                                { v: selecionado.ph, l: 'pH', suf: '' },
                                { v: selecionado.v, l: 'Sat. bases', suf: '%' },
                                { v: selecionado.mo, l: 'M.O.', suf: '%' },
                            ].map((item) => (
                                <span key={item.l} className="border border-slate-200 rounded-[18px] p-3.5 flex flex-col gap-0.5">
                                    <span className="text-[22px] font-extrabold tracking-tight text-slate-900">{item.v}<span className="text-xs text-slate-400">{item.suf}</span></span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.l}</span>
                                </span>
                            ))}
                        </div>
                        <div className="border border-slate-200 rounded-[20px] p-4 mb-3">
                            <div className="flex items-center justify-between mb-3.5">
                                <span className="text-[15px] font-extrabold text-slate-900">Textura do solo</span>
                                <span className="text-[11.5px] font-bold text-slate-400">Análise de {selecionado.analise}</span>
                            </div>
                            <div className="flex gap-1 mb-3">
                                <span className="flex-[42] h-2.5 rounded-full bg-emerald-600" />
                                <span className="flex-[26] h-2.5 rounded-full bg-amber-400" />
                                <span className="flex-[32] h-2.5 rounded-full bg-sky-400" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { n: '42%', l: 'Argila', c: 'bg-emerald-600' },
                                    { n: '26%', l: 'Silte', c: 'bg-amber-400' },
                                    { n: '32%', l: 'Areia', c: 'bg-sky-400' },
                                ].map((item) => (
                                    <span key={item.l} className="flex flex-col gap-0.5">
                                        <span className="text-[15px] font-extrabold text-slate-900">{item.n}</span>
                                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                                            <span className={cn('w-1.5 h-1.5 rounded-full', item.c)} />{item.l}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5 bg-emerald-50 rounded-[18px] px-4 py-3.5">
                            <FlaskConical size={18} className="text-emerald-600 shrink-0" />
                            <span className="text-[12.5px] font-bold text-emerald-700 leading-snug">Dados fictícios — página de teste de layout</span>
                        </div>
                    </div>
                )}
            </div>

            {/* BUSCA + AVISO DE PROVEDOR */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-10 flex items-center gap-3">
                <div className="flex items-center gap-2.5 w-[320px] bg-white/95 backdrop-blur-md rounded-full px-4 py-3 shadow-[0_10px_26px_-12px_rgba(15,23,42,0.5)]">
                    <Search size={17} className="text-slate-400" />
                    <span className="text-[13px] font-medium text-slate-300">Buscar talhão, cultura ou canteiro</span>
                </div>
                <div className="bg-slate-900/70 backdrop-blur-md text-white rounded-full px-4 py-3 text-[10px] font-black uppercase tracking-widest">
                    {usingFallback ? 'Satélite Esri' : 'Satélite Google'}
                </div>
            </div>
        </div>
    );
};

export default TesteMapa;
