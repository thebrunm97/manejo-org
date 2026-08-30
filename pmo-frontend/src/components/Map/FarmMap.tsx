import React, {
    useMemo,
    useEffect,
    useState,
    useRef,
    useCallback,
} from 'react';
import Map, {
    Source,
    Layer,
    Marker,
    useMap,
    NavigationControl,
    MapProvider,
    type MapRef,
} from 'react-map-gl/maplibre';
import type {
    Map as MlMap,
    MapMouseEvent,
    MapTouchEvent,
    PointLike,
    MapGeoJSONFeature,
} from 'maplibre-gl';
import centerOfMass from '@turf/center-of-mass';
import { polygon } from '@turf/helpers';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Talhao, GeoJSONGeometry } from '../../domain/geo/geoTypes';
import { ESRI_SATELLITE_STYLE } from './mapStyles';
import MapDrawControl from './MapDrawControl';

interface GeoJSONData {
    type: 'FeatureCollection';
    features: any[];
}

interface FarmMapProps {
    talhoes: Talhao[];
    focusTarget?: Talhao | null;
    selectedTalhaoId?: number | string;
    onDrawCreate?: (e: any) => void;
    onDrawUpdate?: (e: any) => void;
    onDrawDelete?: (e: any) => void;
    onTalhaoClick?: (talhao: Talhao) => void;
    onBackgroundClick?: () => void;
    isDrawerOpen?: boolean;
    isDrawingMode?: boolean;
    finishDrawingTrigger?: number;
    trashDrawingTrigger?: number;
}

const SOURCE_ID = 'talhoes-source';
const FILL_LAYER_ID = 'talhoes-fill';

const FILL_OPACITY = { selected: 0.5, hover: 0.32, base: 0.18 };
const LINE_WIDTH = { selected: 4, hover: 3, base: 2 };

const getCropColor = (cultura?: string): string => {
    const n = cultura?.toLowerCase().trim() || '';
    if (n.includes('milho')) return '#FBBF24';
    if (n.includes('soja')) return '#F97316';
    if (n.includes('feijão') || n.includes('feijao')) return '#EC4899';
    if (n.includes('pastagem') || n.includes('pasto')) return '#10B981';
    if (n.includes('café') || n.includes('cafe')) return '#8B5CF6';
    return '#38BDF8';
};

function pickTalhao(
    map: MlMap,
    point: { x: number; y: number },
    talhoes: Talhao[],
    tolerance: number,
): { talhao: Talhao; featureId: number } | null {
    const queryAt = (geom: PointLike | [PointLike, PointLike]) =>
        map.queryRenderedFeatures(geom as any, { layers: [FILL_LAYER_ID] });

    let hits: MapGeoJSONFeature[] = queryAt([point.x, point.y]);

    if (hits.length === 0 && tolerance > 0) {
        hits = queryAt([
            [point.x - tolerance, point.y - tolerance],
            [point.x + tolerance, point.y + tolerance],
        ]);
    }
    if (hits.length === 0) return null;

    const seen = new Set<number | string>();
    for (const f of hits) {
        const rawId = f.id ?? f.properties?.id;
        if (rawId == null || seen.has(rawId)) continue;
        seen.add(rawId);

        const talhao = talhoes.find((t) => String(t.id) === String(rawId));
        if (talhao) return { talhao, featureId: Number(talhao.id) };
    }
    return null;
}

const MapController: React.FC<{
    talhoes: Talhao[];
    focusTarget?: Talhao | null;
    isDrawerOpen?: boolean;
}> = ({ talhoes, focusTarget, isDrawerOpen }) => {
    const { current: map } = useMap();

    useEffect(() => {
        if (!map) return;
        const wideDrawer = isDrawerOpen && window.innerWidth > 768;

        const safeFit = (minLng: number, minLat: number, maxLng: number, maxLat: number, padBase: number, duration: number, maxZoom?: number) => {
            // Bloqueio final: se qualquer valor for Infinity ou NaN, aborta.
            if (!Number.isFinite(minLng) || !Number.isFinite(minLat) || !Number.isFinite(maxLng) || !Number.isFinite(maxLat)) return;
            
            const container = map.getContainer();
            const mapWidth = container.clientWidth;
            const mapHeight = container.clientHeight;
            
            if (mapWidth < 10 || mapHeight < 10) {
                map.once('resize', () => safeFit(minLng, minLat, maxLng, maxLat, padBase, duration, maxZoom));
                return;
            }

            const maxHorizontalPad = Math.max(0, mapWidth - 50);
            const maxVerticalPad = Math.max(0, mapHeight - 50);

            let padding: any;
            if (wideDrawer) {
                const targetRightPad = padBase + 400;
                padding = {
                    top: Math.min(padBase, maxVerticalPad / 2),
                    right: Math.min(targetRightPad, maxHorizontalPad / 2),
                    bottom: Math.min(padBase, maxVerticalPad / 2),
                    left: Math.min(padBase, maxHorizontalPad / 2)
                };
            } else {
                const actualPadX = Math.min(padBase, maxHorizontalPad / 2);
                const actualPadY = Math.min(padBase, maxVerticalPad / 2);
                padding = { top: actualPadY, right: actualPadX, bottom: actualPadY, left: actualPadX };
            }
            
            try {
                map.fitBounds([minLng, minLat, maxLng, maxLat], { padding, duration, maxZoom });
            } catch (e) {
                console.warn("MapLibre fitBounds abortado graciosamente para evitar crash:", e);
            }
        };

        // Helper rigoroso para rejeitar nulos, undefined e NaN
        const isValidCoord = (c: any) => typeof c === 'number' && Number.isFinite(c);

        if (focusTarget?.geometry) {
            try {
                const geo: GeoJSONGeometry = typeof focusTarget.geometry === 'string' ? JSON.parse(focusTarget.geometry) : focusTarget.geometry;
                const ring = geo.coordinates?.[0];
                if (Array.isArray(ring)) {
                    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
                    let valid = false;
                    ring.forEach((coord) => {
                        if (Array.isArray(coord) && isValidCoord(coord[0]) && isValidCoord(coord[1])) {
                            minLng = Math.min(minLng, coord[0]); maxLng = Math.max(maxLng, coord[0]);
                            minLat = Math.min(minLat, coord[1]); maxLat = Math.max(maxLat, coord[1]);
                            valid = true;
                        }
                    });
                    if (valid && minLng !== Infinity) safeFit(minLng, minLat, maxLng, maxLat, 80, 1200, 16);
                }
            } catch (e) { console.error('Invalid geometry for focus:', e); }
        } else if (talhoes && talhoes.length > 0) {
            let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
            let valid = false;
            talhoes.forEach((t) => {
                if (!t?.geometry) return;
                try {
                    const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                    geo.coordinates?.[0]?.forEach((coord: any) => {
                        if (Array.isArray(coord) && isValidCoord(coord[0]) && isValidCoord(coord[1])) {
                            minLng = Math.min(minLng, coord[0]); maxLng = Math.max(maxLng, coord[0]); 
                            minLat = Math.min(minLat, coord[1]); maxLat = Math.max(maxLat, coord[1]); 
                            valid = true;
                        }
                    });
                } catch { /* ignore */ }
            });
            if (valid && minLng !== Infinity) safeFit(minLng, minLat, maxLng, maxLat, 50, 1000);
        }
    }, [talhoes, focusTarget, map, isDrawerOpen]);

    return null;
};

const FarmMapInner: React.FC<FarmMapProps> = (props) => {
    const {
        talhoes = [],
        focusTarget,
        selectedTalhaoId,
        onTalhaoClick,
        onBackgroundClick,
        onDrawCreate,
        onDrawUpdate,
        onDrawDelete,
        isDrawerOpen,
        isDrawingMode = false,
        finishDrawingTrigger = 0,
        trashDrawingTrigger = 0,
    } = props;

    const isMobile = useIsMobile();
    const mapRef = useRef<MapRef | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [drawInstance, setDrawInstance] = useState<MapboxDraw | null>(null);

    const [cursor, setCursor] = useState('');
    const setCursorSafe = useCallback((next: string) => {
        setCursor((prev) => (prev === next ? prev : next));
    }, []);

    const liveRef = useRef({ isDrawingMode, talhoes, onTalhaoClick, onBackgroundClick, isMobile });
    useEffect(() => {
        liveRef.current = { isDrawingMode, talhoes, onTalhaoClick, onBackgroundClick, isMobile };
    }, [isDrawingMode, talhoes, onTalhaoClick, onBackgroundClick, isMobile]);

    const hoveredIdRef = useRef<number | null>(null);
    const selectedIdRef = useRef<number | null>(
        selectedTalhaoId != null ? Number(selectedTalhaoId) : null,
    );

    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
    const lastTouchTsRef = useRef(0);

    const geojsonData = useMemo<GeoJSONData>(() => {
        const features = talhoes
            .map((t) => {
                if (!t.geometry) return null;
                try {
                    const geometry =
                        typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
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
                        },
                        geometry,
                    };
                } catch {
                    return null;
                }
            })
            .filter((f): f is any => f !== null);
        return { type: 'FeatureCollection', features };
    }, [talhoes]);

    const fillPaint = useMemo(
        () =>
            ({
                'fill-color': ['coalesce', ['get', 'fillColor'], ['get', 'color'], '#3bb444'],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], FILL_OPACITY.selected,
                    ['boolean', ['feature-state', 'hover'], false], FILL_OPACITY.hover,
                    FILL_OPACITY.base,
                ],
            }) as any,
        [],
    );
    const linePaint = useMemo(
        () =>
            ({
                'line-color': ['coalesce', ['get', 'borderColor'], ['get', 'color'], '#228b22'],
                'line-width': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], LINE_WIDTH.selected,
                    ['boolean', ['feature-state', 'hover'], false], LINE_WIDTH.hover,
                    LINE_WIDTH.base,
                ],
                'line-opacity': 1,
            }) as any,
        [],
    );

    const setHover = useCallback((map: MlMap, id: number | null) => {
        if (hoveredIdRef.current === id) return;
        if (hoveredIdRef.current != null) {
            map.setFeatureState({ source: SOURCE_ID, id: hoveredIdRef.current }, { hover: false });
        }
        hoveredIdRef.current = id;
        if (id != null) {
            map.setFeatureState({ source: SOURCE_ID, id }, { hover: true });
        }
    }, []);

    const commitSelection = useCallback((map: MlMap, id: number | null) => {
        if (selectedIdRef.current != null && selectedIdRef.current !== id) {
            map.setFeatureState({ source: SOURCE_ID, id: selectedIdRef.current }, { selected: false });
        }
        selectedIdRef.current = id;
        if (id != null) {
            map.setFeatureState({ source: SOURCE_ID, id }, { selected: true });
        }
    }, []);

    useEffect(() => {
        if (!mapReady) return;
        const map = mapRef.current?.getMap();
        if (!map) return;

        const markTouch = () => {
            lastTouchTsRef.current = Date.now();
        };
        const isSyntheticMouseAfterTouch = (e: MapMouseEvent | MapTouchEvent) => {
            const pt = (e.originalEvent as PointerEvent)?.pointerType;
            const fromMouse = pt ? pt === 'mouse' : (e.originalEvent as any)?.type?.startsWith('mouse');
            return fromMouse && Date.now() - lastTouchTsRef.current < 700;
        };

        const onPointerDown = (e: MapMouseEvent | MapTouchEvent) => {
            pointerDownRef.current = { x: e.point.x, y: e.point.y };
        };

        const handleClick = (e: MapMouseEvent) => {
            const { isDrawingMode, talhoes, onTalhaoClick, onBackgroundClick, isMobile } =
                liveRef.current;

            if (isDrawingMode) return;

            if (isSyntheticMouseAfterTouch(e)) return;

            const down = pointerDownRef.current;
            pointerDownRef.current = null;
            const moveThreshold = isMobile ? 10 : 5;
            if (down) {
                const dx = e.point.x - down.x;
                const dy = e.point.y - down.y;
                if (Math.hypot(dx, dy) > moveThreshold) return;
            }

            const picked = pickTalhao(map, e.point, talhoes, isMobile ? 22 : 6);
            if (picked) {
                commitSelection(map, picked.featureId);
                onTalhaoClick?.(picked.talhao);
            } else {
                commitSelection(map, null);
                onBackgroundClick?.();

                // ZOOM AO CLIQUE VAZIO:
                // Quando o toque/clique não acerta nenhum talhão (ex.: talhões
                // pequenos demais), aproximamos o mapa para o ponto tocado para
                // facilitar a seleção em uma segunda tentativa.
                try {
                    const center = [e.lngLat.lng, e.lngLat.lat];
                    const currentZoom = map.getZoom();
                    const maxAllowedZoom = 24;
                    const targetZoom = Math.min(currentZoom + 1.6, maxAllowedZoom);
                    map.flyTo({ center: center as any, zoom: targetZoom, duration: 600, essential: true });
                } catch {
                    /* flyTo pode falhar se o mapa não estiver pronto; ignora silenciosamente */
                }
            }
        };

        const handleMove = (e: MapMouseEvent) => {
            if (liveRef.current.isDrawingMode) {
                setCursorSafe('crosshair');
                return;
            }
            const picked = pickTalhao(map, e.point, liveRef.current.talhoes, 0);
            setHover(map, picked ? picked.featureId : null);
            setCursorSafe(picked ? 'pointer' : '');
        };

        const handleMouseOut = () => {
            setHover(map, null);
            setCursorSafe('');
        };
        const handleDragStart = () => {
            setHover(map, null);
            setCursorSafe('');
            pointerDownRef.current = null;
        };

        map.on('mousedown', onPointerDown);
        map.on('touchstart', onPointerDown);
        map.on('touchstart', markTouch);
        map.on('click', handleClick);
        map.on('mousemove', handleMove);
        map.on('mouseout', handleMouseOut);
        map.on('dragstart', handleDragStart);

        const applyInitial = () => commitSelection(map, selectedIdRef.current);
        if (map.isSourceLoaded(SOURCE_ID)) applyInitial();
        else map.once('idle', applyInitial);

        return () => {
            map.off('mousedown', onPointerDown);
            map.off('touchstart', onPointerDown);
            map.off('touchstart', markTouch);
            map.off('click', handleClick);
            map.off('mousemove', handleMove);
            map.off('mouseout', handleMouseOut);
            map.off('dragstart', handleDragStart);
        };
    }, [mapReady, setHover, commitSelection, setCursorSafe]);

    useEffect(() => {
        if (!mapReady) return;
        const map = mapRef.current?.getMap();
        if (!map) return;
        const id = selectedTalhaoId != null ? Number(selectedTalhaoId) : null;
        if (id === selectedIdRef.current) return;
        if (map.isSourceLoaded(SOURCE_ID)) commitSelection(map, id);
        else map.once('idle', () => commitSelection(map, id));
    }, [selectedTalhaoId, mapReady, commitSelection]);

    useEffect(() => {
        if (!mapReady) return;
        const map = mapRef.current?.getMap();
        if (!map) return;
        const reassert = () => {
            const id = selectedIdRef.current;
            if (id != null) map.setFeatureState({ source: SOURCE_ID, id }, { selected: true });
        };
        if (map.isSourceLoaded(SOURCE_ID)) reassert();
        else map.once('idle', reassert);
    }, [geojsonData, mapReady]);

    useEffect(() => {
        if (!isDrawerOpen) return;
        const map = mapRef.current?.getMap();
        setCursorSafe('');
        if (map) setHover(map, null);
    }, [isDrawerOpen, setHover, setCursorSafe]);

    useEffect(() => {
        if (!drawInstance) return;
        try {
            const mode = drawInstance.getMode();
            if (isDrawingMode && mode !== 'draw_polygon') {
                drawInstance.changeMode('draw_polygon');
                setCursorSafe('crosshair');
            } else if (!isDrawingMode && mode !== 'simple_select') {
                drawInstance.changeMode('simple_select');
                setCursorSafe('');
            }
        } catch (err) {
            console.error('Mapbox Draw mode change failed:', err);
        }
    }, [isDrawingMode, drawInstance, setCursorSafe]);

    useEffect(() => {
        if (trashDrawingTrigger && drawInstance) drawInstance.trash();
    }, [trashDrawingTrigger, drawInstance]);

    useEffect(() => {
        if (finishDrawingTrigger > 0 && drawInstance && isDrawingMode) {
            drawInstance.changeMode('simple_select');
        }
    }, [finishDrawingTrigger, drawInstance, isDrawingMode]);

    const centroids = useMemo(() => {
        return talhoes
            .map((t) => {
                if (!t.geometry) return null;
                try {
                    const geo: GeoJSONGeometry =
                        typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                    let coords = geo.coordinates?.[0];
                    if (!coords) return null;
                    const first = coords[0];
                    const last = coords[coords.length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) coords = [...coords, first];
                    const center = centerOfMass(polygon([coords]));
                    const [lng, lat] = center.geometry.coordinates;
                    return { id: t.id, lng, lat, talhao: t };
                } catch {
                    return null;
                }
            })
            .filter(Boolean);
    }, [talhoes]);

    const handleModeChange = useCallback(
        (e: any) => {
            setCursorSafe(
                ['draw_polygon', 'draw_line', 'draw_point'].includes(e.mode) ? 'crosshair' : '',
            );
        },
        [setCursorSafe],
    );

    return (
        <Map
            ref={mapRef}
            onLoad={() => setMapReady(true)}
            cursor={cursor}
            clickTolerance={isMobile ? 6 : 3}
            initialViewState={{ longitude: -48.2772, latitude: -18.9186, zoom: 15 }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={ESRI_SATELLITE_STYLE as any}
            dragPan={!isDrawingMode}
            touchZoomRotate={!isDrawingMode}
            scrollZoom={!isDrawingMode}
            boxZoom={!isDrawingMode}
            dragRotate={!isDrawingMode}
            doubleClickZoom={!isDrawingMode}
        >
            {isDrawingMode && (
                <MapDrawControl
                    position="top-left"
                    displayControlsDefault={false}
                    controls={{ polygon: false, trash: false }}
                    defaultMode="draw_polygon"
                    getDrawInstance={setDrawInstance}
                    onCreate={onDrawCreate}
                    onUpdate={onDrawUpdate}
                    onDelete={onDrawDelete}
                    onModeChange={handleModeChange}
                />
            )}

            <Source id={SOURCE_ID} type="geojson" data={geojsonData} promoteId="id">
                <Layer id={FILL_LAYER_ID} type="fill" paint={fillPaint} />
                <Layer id="talhoes-line" type="line" paint={linePaint} />
            </Source>

            <Source id="dashed-line-source" type="geojson" data={{ type: 'FeatureCollection', features: [] }}>
                <Layer
                    id="dashed-line-layer"
                    type="line"
                    filter={['==', '$type', 'LineString']}
                    paint={{ 'line-color': '#10b981', 'line-width': 4, 'line-dasharray': [2, 2], 'line-opacity': 0.8 }}
                />
                <Layer
                    id="dashed-line-point-layer"
                    type="circle"
                    filter={['==', '$type', 'Point']}
                    paint={{ 'circle-radius': 6, 'circle-color': '#FFFFFF', 'circle-stroke-color': '#10b981', 'circle-stroke-width': 3, 'circle-opacity': 1 }}
                />
            </Source>

            {centroids
                .filter((c) => c && selectedTalhaoId != null && String(c.id) === String(selectedTalhaoId))
                .map((c) => c && (
                    <Marker key={c.id} longitude={c.lng} latitude={c.lat} anchor="center" style={{ pointerEvents: 'none' }}>
                        <div
                            className="map-marker-pill pointer-events-none select-none animate-in fade-in zoom-in-95 duration-300"
                            style={{
                                background: 'white', border: '1px solid #e4e4e7', borderRadius: 12,
                                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', width: 'max-content',
                            }}
                        >
                            <div style={{ width: 8, height: 8, background: c.talhao.fillColor || c.talhao.cor || getCropColor(c.talhao.cultura), borderRadius: '50%' }} />
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

const FarmMap: React.FC<FarmMapProps> = (props) => {
    return (
        <div className="relative w-full h-full z-0" style={{ touchAction: 'none', userSelect: 'none' }}>
            <MapProvider>
                <FarmMapInner {...props} />
            </MapProvider>
        </div>
    );
};

export default FarmMap;
