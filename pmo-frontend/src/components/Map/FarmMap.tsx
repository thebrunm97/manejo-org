import React, { useMemo, useEffect, useState, useCallback } from 'react';
import Map, { Source, Layer, Marker, useMap, NavigationControl, MapProvider, MapLayerMouseEvent } from 'react-map-gl/maplibre';
import centerOfMass from '@turf/center-of-mass';
import { polygon } from '@turf/helpers';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Talhao, GeoJSONGeometry } from '../../domain/geo/geoTypes';
import { ESRI_SATELLITE_STYLE } from './mapStyles';

// Tipagem para GeoJSON FeatureCollection
interface GeoJSONData {
    type: 'FeatureCollection';
    features: any[];
}

import MapDrawControl from './MapDrawControl';

interface FarmMapProps {
    talhoes: Talhao[];
    focusTarget?: Talhao | null;
    selectedTalhaoId?: number | string;
    onDrawCreate?: (e: any) => void;
    onDrawUpdate?: (e: any) => void;
    onDrawDelete?: (e: any) => void;
    onTalhaoClick?: (talhao: Talhao | null) => void;
    isDrawerOpen?: boolean;
    isDrawingMode?: boolean;
    finishDrawingTrigger?: number;
    trashDrawingTrigger?: number;
}

const getCropColor = (cultura?: string): string => {
    const n = cultura?.toLowerCase().trim() || '';
    if (n.includes('milho')) return '#FBBF24';
    if (n.includes('soja')) return '#F97316';
    if (n.includes('feijão') || n.includes('feijao')) return '#EC4899';
    if (n.includes('pastagem') || n.includes('pasto')) return '#10B981';
    if (n.includes('café') || n.includes('cafe')) return '#8B5CF6';
    return '#38BDF8';
};

/**
 * COMPONENTE: MapController
 * Sincroniza zoom e enquadramento (bounds) com base nos talhões ou alvo em foco.
 */
const MapController: React.FC<{ talhoes: Talhao[], focusTarget?: Talhao | null, isDrawerOpen?: boolean }> = ({ talhoes, focusTarget, isDrawerOpen }) => {
    const { current: map } = useMap();

    useEffect(() => {
        if (!map) return;

        if (focusTarget && focusTarget.geometry) {
            try {
                const geo: GeoJSONGeometry = typeof focusTarget.geometry === 'string' 
                    ? JSON.parse(focusTarget.geometry) 
                    : focusTarget.geometry;
                
                if (geo.coordinates && geo.coordinates[0]) {
                    const coords = geo.coordinates[0];
                    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                    coords.forEach(([lng, lat]) => {
                        minLng = Math.min(minLng, lng);
                        maxLng = Math.max(maxLng, lng);
                        minLat = Math.min(minLat, lat);
                        maxLat = Math.max(maxLat, lat);
                    });

                    const padding = isDrawerOpen && window.innerWidth > 768 
                        ? { top: 80, right: 480, bottom: 80, left: 80 } 
                        : 80;

                    map.fitBounds(
                        [minLng, minLat, maxLng, maxLat],
                        { padding, maxZoom: 16, duration: 1200 }
                    );
                }
            } catch (e) {
                console.error("Invalid geometry for focus:", e);
            }
        } else if (talhoes.length > 0 && !focusTarget) {
            let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
            let hasValid = false;

            talhoes.forEach(t => {
                if (t.geometry) {
                    try {
                        const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                        if (geo.coordinates && geo.coordinates[0]) {
                            geo.coordinates[0].forEach(([lng, lat]) => {
                                minLng = Math.min(minLng, lng);
                                maxLng = Math.max(maxLng, lng);
                                minLat = Math.min(minLat, lat);
                                maxLat = Math.max(maxLat, lat);
                            });
                            hasValid = true;
                        }
                    } catch (e) { }
                }
            });

            if (hasValid) {
                const padding = isDrawerOpen && window.innerWidth > 768 
                    ? { top: 50, right: 450, bottom: 50, left: 50 } 
                    : 50;

                map.fitBounds(
                    [minLng, minLat, maxLng, maxLat],
                    { padding, duration: 1000 }
                );
            }
        }
    }, [talhoes, focusTarget, map, isDrawerOpen]);

    return null;
};

/**
 * COMPONENTE: DrawModeController
 * Gerencia guidance line, modo de desenho e interações de draw DENTRO do contexto do Map.
 * Este componente fica como filho de <Map> para ter acesso ao useMap().
 */
const DrawModeController: React.FC<{
    isDrawingMode: boolean;
    drawInstance: MapboxDraw | null;
    finishDrawingTrigger: number;
    trashDrawingTrigger: number;
    setCursor: (c: string | undefined) => void;
}> = ({ isDrawingMode, drawInstance, finishDrawingTrigger, trashDrawingTrigger, setCursor }) => {
    const { current: mapInstance } = useMap();

    // Efeito para Gerenciar a Linha Guia (60fps) e Bloqueio de Pan
    useEffect(() => {
        if (!mapInstance) return;

        const map = mapInstance.getMap();
        
        const updateGuidanceLine = (e: any) => {
            if (!drawInstance) return;

            try {
                const mode = drawInstance.getMode();
                const source = map.getSource('dashed-line-source') as any;
                if (!source) return;

                // MODO DESENHO: Rubber Band (Último Vértice -> Cursor)
                if (mode === 'draw_polygon' && isDrawingMode) {
                    const features = drawInstance.getAll()?.features || [];
                    if (features.length === 0) {
                        source.setData({ type: 'FeatureCollection', features: [] });
                        return;
                    }

                    const activeFeature = features[features.length - 1];

                    if (activeFeature && activeFeature.geometry.type === 'Polygon') {
                        const coords = (activeFeature.geometry as any).coordinates[0];
                        if (coords && coords.length > 0) {
                            const lastVertex = coords[coords.length - 1];
                            const cursorCoord = [e.lngLat.lng, e.lngLat.lat];

                            source.setData({
                                type: 'FeatureCollection',
                                features: [{
                                    type: 'Feature',
                                    geometry: {
                                        type: 'LineString',
                                        coordinates: [lastVertex, cursorCoord]
                                    }
                                }]
                            });
                            return;
                        }
                    }
                }

                // MODO EDIÇÃO: Point Guidance (Cursor -> Feedback do Vértice Arrastado)
                if (mode === 'direct_select') {
                    source.setData({
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: {
                                type: 'Point',
                                coordinates: [e.lngLat.lng, e.lngLat.lat]
                            }
                        }]
                    });
                    return;
                }

                // Se não estiver em modo relevante, limpamos
                source.setData({ type: 'FeatureCollection', features: [] });
            } catch (err) {
                // Silently avoid move crashes
            }
        };

        const clearGuidanceLine = () => {
            const source = map.getSource('dashed-line-source') as any;
            if (source) {
                source.setData({ type: 'FeatureCollection', features: [] });
            }
        };

        if (isDrawingMode) {
            // Desativa Pan e Interações de Zoom que conflitam com o toque/arraste
            map.dragPan.disable();
            map.touchZoomRotate.disable();
            map.doubleClickZoom.disable();

            map.on('mousemove', updateGuidanceLine);
            map.on('touchmove', updateGuidanceLine);
        } else {
            map.dragPan.enable();
            map.touchZoomRotate.enable();
            map.doubleClickZoom.enable();
            clearGuidanceLine();
        }

        return () => {
            map.off('mousemove', updateGuidanceLine);
            map.off('touchmove', updateGuidanceLine);
            clearGuidanceLine();
        };
    }, [isDrawingMode, mapInstance, drawInstance]);

    // Efeito para ativar modo de desenho programaticamente
    useEffect(() => {
        if (!drawInstance) return;

        try {
            const currentMode = drawInstance.getMode();
            if (isDrawingMode && currentMode !== 'draw_polygon') {
                drawInstance.changeMode('draw_polygon');
                setCursor('crosshair');
            } else if (!isDrawingMode && currentMode !== 'simple_select') {
                drawInstance.changeMode('simple_select');
                setCursor(undefined);
            }
        } catch (err) {
            console.error("⚠️ Mapbox Draw mode change failed:", err);
        }
    }, [isDrawingMode, drawInstance, setCursor]);

    // Efeito para desfazer último ponto (trash)
    useEffect(() => {
        if (trashDrawingTrigger && drawInstance) {
            drawInstance.trash();
        }
    }, [trashDrawingTrigger, drawInstance]);

    // Efeito para finalizar desenho via trigger externo
    useEffect(() => {
        if (finishDrawingTrigger > 0 && drawInstance && isDrawingMode) {
            drawInstance.changeMode('simple_select');
        }
    }, [finishDrawingTrigger, drawInstance, isDrawingMode]);

    // Resize protection on mount
    useEffect(() => {
        if (!mapInstance) return;

        const performResize = () => {
            requestAnimationFrame(() => {
                mapInstance.resize();
                requestAnimationFrame(() => mapInstance.resize());
            });
        };
        performResize();

        const onWindowResize = () => performResize();
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('load', onWindowResize);

        return () => {
            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('load', onWindowResize);
        };
    }, [mapInstance]);

    return null;
};

const FarmMap: React.FC<FarmMapProps> = (props) => {
    return (
        <div className="relative w-full h-full z-0" style={{ touchAction: 'none', userSelect: 'none' }}>
            <MapProvider>
                <FarmMapInner {...props} />
            </MapProvider>
        </div>
    );
};

/**
 * COMPONENTE INTERNO: FarmMapInner
 * Renderizado DENTRO do MapProvider para que useMap() funcione corretamente.
 */
const FarmMapInner: React.FC<FarmMapProps> = ({
    talhoes = [],
    focusTarget,
    selectedTalhaoId,
    onTalhaoClick,
    onDrawCreate,
    onDrawUpdate,
    onDrawDelete,
    isDrawerOpen,
    isDrawingMode = false,
    finishDrawingTrigger = 0,
    trashDrawingTrigger = 0
}) => {
    const isMobile = useIsMobile();
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [drawInstance, setDrawInstance] = useState<MapboxDraw | null>(null);

    // 1. Converter talhões para GeoJSON FeatureCollection (WebGL Native)
    const geojsonData = useMemo<GeoJSONData>(() => {
        const features = talhoes
            .map(t => {
                if (!t.geometry) return null;
                try {
                    const geometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                    return {
                        type: 'Feature',
                        id: t.id,
                        properties: {
                            id: t.id,
                            nome: t.nome,
                            cultura: t.cultura,
                            fillColor: t.fillColor || undefined,
                            borderColor: t.borderColor || undefined,
                            color: t.cor || getCropColor(t.cultura),
                            isSelected: selectedTalhaoId === t.id
                        },
                        geometry
                    };
                } catch {
                    return null;
                }
            })
            .filter((f): f is any => f !== null);

        return {
            type: 'FeatureCollection',
            features
        };
    }, [talhoes, selectedTalhaoId]);

    // Calcular Centróides para os Markers (Pílulas) via Turf
    const centroids = useMemo(() => {
        return talhoes.map(t => {
            if (!t.geometry) return null;
            try {
                const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                if (!geo.coordinates || !geo.coordinates[0]) return null;
                
                let coords = geo.coordinates[0];
                
                const first = coords[0];
                const last = coords[coords.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    coords = [...coords, first];
                }

                const poly = polygon([coords]);
                const center = centerOfMass(poly);
                const [lng, lat] = center.geometry.coordinates;

                return {
                    id: t.id,
                    lng,
                    lat,
                    talhao: t
                };
            } catch (e) { 
                console.error("Turf Error:", e);
                return null; 
            }
        }).filter(Boolean);
    }, [talhoes]);

    const handleModeChange = (e: any) => {
        if (['draw_polygon', 'draw_line', 'draw_point'].includes(e.mode)) {
            setCursor('crosshair');
        } else {
            setCursor(undefined);
        }
    };

    // Handler de clique nativo do MapLibre — funciona tanto para mouse quanto touch,
    // já converte pixel→coordenada internamente, e não é afetado por overlays HTML.
    const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
        // Passo 1: Guard Clause - Bloqueio de Clique por Modo de Desenho
        // Se estivermos em modo de desenho, ignoramos cliques de seleção
        if (isDrawingMode || !onTalhaoClick) return;

        // queryRenderedFeatures na posição do clique com tolerância para touch
        const tolerance = isMobile ? 12 : 5;
        const bbox: [[number, number], [number, number]] = [
            [e.point.x - tolerance, e.point.y - tolerance],
            [e.point.x + tolerance, e.point.y + tolerance]
        ];

        const features = e.target.queryRenderedFeatures(bbox, {
            layers: ['talhoes-fill']
        });

        if (features && features.length > 0) {
            const feature = features[0];
            const talhaoId = feature.properties?.id;
            const talhao = talhoes.find(t => String(t.id) === String(talhaoId));
            if (talhao) {
                // Stop propagation — impede que o clique "vaze" para o mapa,
                // mas não bloqueia o comportamento de pan/zoom nativo do mapa.
                e.originalEvent.stopPropagation();
                onTalhaoClick(talhao);
            } else {
                onTalhaoClick(null);
            }
        } else {
            // Passo 2: Hit-Test de Precisão - Clicou num espaço vazio
            onTalhaoClick(null);
        }
    }, [isDrawingMode, onTalhaoClick, talhoes, isMobile]);

    // Cursor pointer ao passar sobre polígono (feedback visual de interatividade)
    const handleMouseEnter = useCallback((_e: MapLayerMouseEvent) => {
        if (!isDrawingMode) {
            setCursor('pointer');
        }
    }, [isDrawingMode]);

    const handleMouseLeave = useCallback((_e: MapLayerMouseEvent) => {
        if (!isDrawingMode) {
            setCursor(undefined);
        }
    }, [isDrawingMode]);

    // Passo 3: Restauração de Cursor Segura
    // Garante o reset robusto do cursor no canvas caso o mouse leave falhe
    const { current: mapInstance } = useMap();
    useEffect(() => {
        if (!mapInstance) return;
        const canvas = mapInstance.getCanvas();
        if (!canvas) return;

        if (isDrawingMode) {
            setCursor('crosshair');
            canvas.style.cursor = 'crosshair';
        } else if (isDrawerOpen) {
            // Quando abrimos o drawer, devemos limpar o cursor
            setCursor(undefined);
            canvas.style.cursor = '';
        } else {
            // Fallback seguro para estado normal
            canvas.style.cursor = cursor || '';
        }
    }, [isDrawingMode, isDrawerOpen, mapInstance, cursor]);

    return (
        <Map
            cursor={cursor}
            initialViewState={{
                longitude: -48.2772,
                latitude: -18.9186,
                zoom: 15
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={ESRI_SATELLITE_STYLE as any}
            dragPan={!isDrawingMode}
            touchZoomRotate={!isDrawingMode}
            scrollZoom={!isDrawingMode}
            boxZoom={!isDrawingMode}
            dragRotate={!isDrawingMode}
            doubleClickZoom={!isDrawingMode}
            onClick={handleMapClick}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            interactiveLayerIds={['talhoes-fill']}
        >
            {/* Draw Mode Controller — dentro do contexto do Map, acessa useMap() */}
            <DrawModeController
                isDrawingMode={isDrawingMode}
                drawInstance={drawInstance}
                finishDrawingTrigger={finishDrawingTrigger}
                trashDrawingTrigger={trashDrawingTrigger}
                setCursor={setCursor}
            />

            {/* Conditional rendering of Draw Control */}
            {isDrawingMode && (
                <MapDrawControl
                    position="top-left"
                    displayControlsDefault={false}
                    controls={{
                        polygon: false,
                        trash: false
                    }}
                    defaultMode="draw_polygon"
                    getDrawInstance={setDrawInstance}
                    onCreate={onDrawCreate}
                    onUpdate={onDrawUpdate}
                    onDelete={onDrawDelete}
                    onModeChange={handleModeChange}
                />
            )}

            <Source id="talhoes-source" type="geojson" data={geojsonData}>
                <Layer
                    id="talhoes-fill"
                    type="fill"
                    paint={{
                        'fill-color': [
                            'coalesce', 
                            ['get', 'fillColor'], 
                            ['get', 'color'], 
                            '#3bb444'
                        ],
                        'fill-opacity': [
                            'case',
                            selectedTalhaoId ? ['==', ['get', 'id'], selectedTalhaoId] : false,
                            0.45,
                            0.18
                        ]
                    }}
                />
                <Layer
                    id="talhoes-line"
                    type="line"
                    paint={{
                        'line-color': [
                            'coalesce', 
                            ['get', 'borderColor'], 
                            ['get', 'color'], 
                            '#228b22'
                        ],
                        'line-width': [
                            'case',
                            selectedTalhaoId ? ['==', ['get', 'id'], selectedTalhaoId] : false,
                            4,
                            2
                        ],
                        'line-opacity': 1
                    }}
                />
            </Source>

            {/* RUBBER BAND & DRAG GUIDANCE (Emerald Green 60fps) */}
            <Source id="dashed-line-source" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
                <Layer
                    id="dashed-line-layer"
                    type="line"
                    filter={['==', '$type', 'LineString']}
                    paint={{
                        'line-color': '#10b981',
                        'line-width': 4,
                        'line-dasharray': [2, 2],
                        'line-opacity': 0.8
                    }}
                />
                <Layer
                    id="dashed-line-point-layer"
                    type="circle"
                    filter={['==', '$type', 'Point']}
                    paint={{
                        'circle-radius': 6,
                        'circle-color': '#FFFFFF',
                        'circle-stroke-color': '#10b981',
                        'circle-stroke-width': 3,
                        'circle-opacity': 1
                    }}
                />
            </Source>

            {centroids
                .filter(c => c && selectedTalhaoId && String(c.id) === String(selectedTalhaoId))
                .map(c => c && (
                <Marker 
                    key={c.id} 
                    longitude={c.lng} 
                    latitude={c.lat}
                    anchor="center"
                    style={{ pointerEvents: 'none' }}
                >
                    <div 
                        className="map-marker-pill pointer-events-none select-none animate-in fade-in zoom-in-95 duration-300" 
                        style={{ 
                            background: 'white', 
                            border: '1px solid #e4e4e7', 
                            borderRadius: '12px', 
                            padding: '6px 12px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                            width: 'max-content'
                        }}
                    >
                        <div style={{ 
                            width: '8px', 
                            height: '8px', 
                            background: c.talhao.fillColor || c.talhao.cor || getCropColor(c.talhao.cultura), 
                            borderRadius: '50%' 
                        }} />
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                            <span style={{ fontWeight: 800, fontSize: 11, color: '#18181b', whiteSpace: 'nowrap' }}>{c.talhao.nome}</span>
                            <span style={{ fontWeight: 600, fontSize: 10, color: '#71717a', whiteSpace: 'nowrap' }}>{c.talhao.cultura || 'Área Livre'}</span>
                        </div>
                    </div>
                </Marker>
            ))}

            <MapController talhoes={talhoes} focusTarget={focusTarget} isDrawerOpen={isDrawerOpen} />
            <NavigationControl position="bottom-left" />
        </Map>
    );
};

export default FarmMap;
