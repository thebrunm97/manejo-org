import React, { useMemo, useEffect, useState } from 'react';
import Map, { Source, Layer, Marker, useMap, NavigationControl } from 'react-map-gl/maplibre';
import centerOfMass from '@turf/center-of-mass';
import { polygon } from '@turf/helpers';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
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
    onTalhaoClick?: (talhao: Talhao) => void;
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

// Hook Interno para Controle de Zoom/Bounds (Equivalente ao MapController)
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

const FarmMap: React.FC<FarmMapProps> = ({
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
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [drawInstance, setDrawInstance] = useState<MapboxDraw | null>(null);

    // Efeito para ativar modo de desenho programaticamente
    useEffect(() => {
        if (isDrawingMode && drawInstance) {
            drawInstance.changeMode('draw_polygon');
            setCursor('crosshair');
        } else if (!isDrawingMode && drawInstance) {
            drawInstance.changeMode('simple_select');
            setCursor(undefined);
        }
    }, [isDrawingMode, drawInstance]);

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

    // --- WebGL Deep Sync: coordinate-drift protection ---
    const { current: mapInstance } = useMap();
    useEffect(() => {
        if (!mapInstance) return;

        // Use requestAnimationFrame (double) to ensure sync with browser's render cycle
        let frame1: number;
        let frame2: number;

        const performResize = () => {
            frame1 = requestAnimationFrame(() => {
                mapInstance.resize();
                frame2 = requestAnimationFrame(() => {
                    mapInstance.resize();
                });
            });
        };

        // 1. Immediate trigger on state change
        performResize();

        // 2. Native Event Listeners (Plan D: Raw DOM Capture)
        // MapboxDraw is known to swallow `click` and map-level touch events on mobile.
        // We bypass this by attaching listeners directly to the WebGL canvas with `capture: true`.
        const canvas = mapInstance?.getCanvas();
        if (!canvas || !mapInstance) return;

        let touchStartPos: { x: number, y: number } | null = null;
        let touchStartTime = 0;

        const handleInteraction = (point: { x: number, y: number }, type: string) => {
            if (isDrawingMode) return;
            
            console.log(`🔥 [FarmMap] RAW ${type} Interaction at:`, point);
            
            const tolerance = 20; // 20px tolerance for mobile/fat-finger
            const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
                [point.x - tolerance, point.y - tolerance],
                [point.x + tolerance, point.y + tolerance]
            ];
            
            const features = mapInstance.queryRenderedFeatures(bbox, {
                layers: ['talhoes-fill']
            });
            
            if (features && features.length > 0 && onTalhaoClick) {
                const feature = features[0];
                const talhaoId = feature.properties?.id;
                console.log('✅ [FarmMap] Plot Detected via RAW:', talhaoId);
                const talhao = talhoes.find(t => String(t.id) === String(talhaoId));
                if (talhao) {
                    onTalhaoClick(talhao);
                }
            } else {
                console.log('❌ [FarmMap] No plot detected via RAW at:', point);
            }
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches && e.touches.length > 0) {
                const touch = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                touchStartPos = {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top
                };
                touchStartTime = Date.now();
                console.log('👉 [FarmMap] RAW Canvas touchstart registered');
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!touchStartPos || !e.touches || e.touches.length === 0) return;
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const currentX = touch.clientX - rect.left;
            const currentY = touch.clientY - rect.top;
            
            const dx = currentX - touchStartPos.x;
            const dy = currentY - touchStartPos.y;
            
            // Cancel tap if movement exceeds 10 pixels (drag/pan)
            if (Math.sqrt(dx * dx + dy * dy) > 10) {
                touchStartPos = null;
            }
        };

        const onTouchEnd = () => {
            if (!touchStartPos) return;
            
            const duration = Date.now() - touchStartTime;
            if (duration < 500) {
                handleInteraction(touchStartPos, 'tap');
            }
            touchStartPos = null;
        };

        const onMouseClick = (e: MouseEvent) => {
            // Desktop fallback
            const rect = canvas.getBoundingClientRect();
            const point = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            handleInteraction(point, 'click');
        };

        // Attach with capture: true to ensure we run BEFORE Draw or other plugins
        canvas.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { capture: true, passive: true });
        canvas.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
        canvas.addEventListener('click', onMouseClick, { capture: true });

        // 3. Window-level listeners for absolute sync
        const onWindowResize = () => performResize();
        window.addEventListener('resize', onWindowResize);
        window.addEventListener('load', onWindowResize);

        return () => {
            cancelAnimationFrame(frame1);
            cancelAnimationFrame(frame2);
            canvas.removeEventListener('touchstart', onTouchStart, { capture: true });
            canvas.removeEventListener('touchmove', onTouchMove, { capture: true });
            canvas.removeEventListener('touchend', onTouchEnd, { capture: true });
            canvas.removeEventListener('click', onMouseClick, { capture: true });
            window.removeEventListener('resize', onWindowResize);
            window.removeEventListener('load', onWindowResize);
        };
    }, [isDrawerOpen, isDrawingMode, mapInstance, talhoes, onTalhaoClick]);

    // NOTA: Auto-sync do Draw removido intencionalmente.
    // O Draw agora é usado APENAS para criação de novos polígonos (draw_polygon) e exclusão (trash).
    // A seleção visual é controlada por Data-Driven Styling nas camadas base do MapLibre.

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
                
                // Garantir que o polígono está fechado para o Turf (primeiro ponto == último ponto)
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

    return (
        <div className="relative w-full h-full z-0" style={{ touchAction: 'none', userSelect: 'none' }}>
            <Map
                cursor={cursor}
                initialViewState={{
                    longitude: -48.2772,
                    latitude: -18.9186,
                    zoom: 15
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle={ESRI_SATELLITE_STYLE as any}
                // LOCK INTERACTION ON DRAWING MODE (Mobile-First Fix)
                dragPan={!isDrawingMode}
                touchZoomRotate={!isDrawingMode}
                scrollZoom={!isDrawingMode}
                boxZoom={!isDrawingMode}
                dragRotate={!isDrawingMode}
                doubleClickZoom={!isDrawingMode}
                interactiveLayerIds={['talhoes-fill']}
            >
            <MapDrawControl
                position="top-left"
                displayControlsDefault={false}
                controls={{
                    polygon: false, // Hidden native controls per USER request
                    trash: false
                }}
                defaultMode="simple_select"
                getDrawInstance={setDrawInstance}
                onCreate={onDrawCreate}
                onUpdate={onDrawUpdate}
                onDelete={onDrawDelete}
                onModeChange={handleModeChange}
            />
            <Source id="talhoes-source" type="geojson" data={geojsonData}>
                {/* Layer de Preenchimento — Data-Driven Styling (sem filtro excludente) */}
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
                
                {/* Layer de Borda — Highlight dinâmico para seleção */}
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

            {/* Pílula HTML — Visível APENAS para o talhão selecionado */}
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
    </div>
    );
};

export default FarmMap;
