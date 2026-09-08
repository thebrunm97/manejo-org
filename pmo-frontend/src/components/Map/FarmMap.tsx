import React, {
    useMemo,
    useEffect,
    useState,
    useRef,
    useCallback,
} from 'react';
import { Sprout, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { getSatelliteTiles, SatelliteTileResponse, getZonalNDVI, ZonalTalhaoResult } from '../../services/mapService';
import Map, {
    Source,
    Layer,
    Marker,
    useMap,
    NavigationControl,
    MapProvider,
    Popup,
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
import 'maplibre-gl/dist/maplibre-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Talhao, GeoJSONGeometry } from '../../domain/geo/geoTypes';
import { useSatelliteMapStyle, maxZoomForProvider } from './useSatelliteMapStyle';
import MapDrawControl from './MapDrawControl';
import MapLayersPanel from './MapLayersPanel';
import { cn } from '../../utils/cn';

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
    isEditingMode?: boolean;
    finishDrawingTrigger?: number;
    trashDrawingTrigger?: number;
    centerCoords?: { latitude: number; longitude: number } | null;
    /** Entrega o NDVI médio por talhão a quem estiver acima (o painel usa). */
    onZonalNDVI?: (resultados: Record<string, ZonalTalhaoResult>) => void;
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
    centerCoords?: { latitude: number; longitude: number } | null;
}> = ({ talhoes, focusTarget, isDrawerOpen, centerCoords }) => {
    const { current: map } = useMap();

    useEffect(() => {
        if (!map) return;
        const wideDrawer = isDrawerOpen && window.innerWidth > 768;

        const safeFit = (minLng: number, minLat: number, maxLng: number, maxLat: number, padBase: number, duration: number, maxZoom = 18) => {
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
            
            if (minLng === maxLng) {
                minLng -= 0.0001;
                maxLng += 0.0001;
            }
            if (minLat === maxLat) {
                minLat -= 0.0001;
                maxLat += 0.0001;
            }

            try {
                map.fitBounds([minLng, minLat, maxLng, maxLat], { padding, duration, maxZoom });
            } catch (e) {
                console.warn("MapLibre fitBounds abortado graciosamente para evitar crash:", e);
            }
        };

        const safeFlyTo = (lng: number, lat: number, zoom = 16, duration = 1000) => {
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
            const container = map.getContainer();
            const mapWidth = container.clientWidth;
            const mapHeight = container.clientHeight;

            if (mapWidth < 10 || mapHeight < 10) {
                map.once('resize', () => safeFlyTo(lng, lat, zoom, duration));
                return;
            }

            try {
                map.flyTo({
                    center: [lng, lat],
                    zoom,
                    duration,
                    essential: true
                });
            } catch (e) {
                console.warn("MapLibre flyTo abortado graciosamente:", e);
            }
        };

        // Helper rigoroso para rejeitar nulos, undefined e NaN
        const isValidCoord = (c: any) => typeof c === 'number' && Number.isFinite(c);

        if (focusTarget?.geometry) {
            try {
                const geo: GeoJSONGeometry = typeof focusTarget.geometry === 'string' ? JSON.parse(focusTarget.geometry) : focusTarget.geometry;
                let coords = geo.coordinates?.[0];
                if (Array.isArray(coords) && coords.length > 0) {
                    const first = coords[0];
                    const last = coords[coords.length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        coords = [...coords, first];
                    }
                    const center = centerOfMass(polygon([coords]));
                    const [lng, lat] = center.geometry.coordinates;
                    if (Number.isFinite(lng) && Number.isFinite(lat)) {
                        safeFlyTo(lng, lat, 18, 1200);
                        return;
                    }
                }
            } catch (e) { console.error('Invalid geometry for focus:', e); }
        }

        let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
        let valid = false;
        if (talhoes && talhoes.length > 0) {
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
        }

        if (valid && minLng !== Infinity) {
            safeFit(minLng, minLat, maxLng, maxLat, 50, 1000, 18);
        } else if (centerCoords && Number.isFinite(centerCoords.latitude) && Number.isFinite(centerCoords.longitude)) {
            safeFlyTo(centerCoords.longitude, centerCoords.latitude, 16, 1000);
        }
    }, [talhoes, focusTarget, map, isDrawerOpen, centerCoords]);

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
        isEditingMode = false,
        finishDrawingTrigger = 0,
        trashDrawingTrigger = 0,
        centerCoords,
    onZonalNDVI,
    } = props;

    const isMobile = useIsMobile();
    const mapRef = useRef<MapRef | null>(null);
    const [mapReady, setMapReady] = useState(false);
    const [drawInstance, setDrawInstance] = useState<MapboxDraw | null>(null);
    const { style: satelliteStyle, provider: satelliteProvider, usingFallback: satelliteFallback } = useSatelliteMapStyle();

    useEffect(() => {
        const googleKeyConfigured = Boolean(import.meta.env.VITE_GOOGLE_MAPS_TILES_KEY);
        if (googleKeyConfigured && satelliteFallback) {
            toast.warn('Não foi possível carregar o satélite do Google. Usando mapa-base alternativo.');
        }
    }, [satelliteFallback]);

    // GEE Layers State
    const [layerType, setLayerType] = useState<'base' | 'sentinel_rgb' | 'sentinel_ndvi'>('base');
    const [layersPanelOpen, setLayersPanelOpen] = useState(false);
    // NDVI medio por talhao, calculado sob demanda quando a camada NDVI e escolhida.
    const [zonalNDVI, setZonalNDVI] = useState<Record<string, ZonalTalhaoResult>>({});
    const [zonalLoading, setZonalLoading] = useState(false);
    const [zonalError, setZonalError] = useState<string | null>(null);
    const [period, setPeriod] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [layerOpacity, setLayerOpacity] = useState<number>(0.75);
    const [tileData, setTileData] = useState<SatelliteTileResponse | null>(null);
    const [tileLoading, setTileLoading] = useState(false);
    const [tileError, setTileError] = useState<string | null>(null);

    // Fetch GEE tiles when layerType or period changes
    useEffect(() => {
        if (layerType === 'base') {
            setTileData(null);
            setTileError(null);
            return;
        }

        let isMounted = true;
        setTileLoading(true);
        setTileError(null);
        setTileData(null); // Clear previous to force new Source ID/refresh

        // Default Opacity suggested by user
        setLayerOpacity(layerType === 'sentinel_ndvi' ? 0.70 : 0.75);

        // Usando 'farm-mock' no MVP/Fase 1
        getSatelliteTiles('farm-mock', layerType.replace('sentinel_', '') as 'rgb' | 'ndvi', period)
            .then((data) => {
                if (isMounted) {
                    setTileData(data);
                    setTileLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    setTileError(err.message || 'Erro ao carregar imagens.');
                    setTileLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [layerType, period]);

    const [cursor, setCursor] = useState('');
    const [hoverInfo, setHoverInfo] = useState<{ lng: number; lat: number; talhao: Talhao } | null>(null);
    const setCursorSafe = useCallback((next: string) => {
        setCursor((prev) => (prev === next ? prev : next));
    }, []);

    const liveRef = useRef({
        talhoes,
        onTalhaoClick,
        onBackgroundClick,
        isDrawingMode,
        isEditingMode,
        isMobile,
        satelliteProvider,
    });
    useEffect(() => {
        liveRef.current = {
            talhoes,
            onTalhaoClick,
            onBackgroundClick,
            isDrawingMode,
            isEditingMode,
            isMobile,
            satelliteProvider,
        };
    }, [isDrawingMode, isEditingMode, talhoes, onTalhaoClick, onBackgroundClick, isMobile, satelliteProvider]);

    // MapDrawControl fica sempre montado (evita recriar sources/layers do draw a
    // cada início/fim de desenho). Como o controle só assina os handlers uma vez
    // no mount, mantemos as callbacks mais recentes num ref para não usar closures
    // desatualizadas de onDrawCreate/onDrawUpdate/onDrawDelete.
    const drawHandlersRef = useRef({ onDrawCreate, onDrawUpdate, onDrawDelete });
    useEffect(() => {
        drawHandlersRef.current = { onDrawCreate, onDrawUpdate, onDrawDelete };
    }, [onDrawCreate, onDrawUpdate, onDrawDelete]);

    const stableOnDrawCreate = useCallback((e: any) => drawHandlersRef.current.onDrawCreate?.(e), []);
    const stableOnDrawUpdate = useCallback((e: any) => drawHandlersRef.current.onDrawUpdate?.(e), []);
    const stableOnDrawDelete = useCallback((e: any) => drawHandlersRef.current.onDrawDelete?.(e), []);

    const hoveredIdRef = useRef<number | null>(null);
    const selectedIdRef = useRef<number | null>(
        selectedTalhaoId != null ? Number(selectedTalhaoId) : null,
    );

    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
    const lastTouchTsRef = useRef(0);

    // Busca o NDVI medio por talhao apenas quando a camada NDVI esta ativa.
    // Cada talhao e uma consulta ao Earth Engine, entao isso nunca roda no
    // carregamento do mapa nem para as outras camadas.
    // Entradas do calculo zonal, memoizadas: o pai recria o array de talhoes a
    // cada render, e sem isso o efeito refazia a chamada varias vezes seguidas
    // — cada uma custando uma consulta ao Earth Engine POR TALHAO.
    const entradasZonais = useMemo(() => {
        return talhoes
            .map((t) => {
                if (!t.geometry) return null;
                try {
                    const geometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                    if (!geometry?.coordinates?.length) return null;
                    return { id: String(t.id), geometry };
                } catch {
                    return null;
                }
            })
            .filter((e): e is { id: string; geometry: any } => e !== null);
    }, [talhoes]);

    // Assinatura do conjunto: muda quando entra, sai ou se redesenha um talhao,
    // e nao quando o pai simplesmente rerenderiza.
    const assinaturaZonal = useMemo(
        () => entradasZonais.map((e) => `${e.id}:${JSON.stringify(e.geometry.coordinates)}`).join('|'),
        [entradasZonais],
    );

    useEffect(() => {
        if (layerType !== 'sentinel_ndvi') {
            setZonalError(null);
            return;
        }

        const entradas = entradasZonais;

        if (entradas.length === 0) return;

        let cancelado = false;
        setZonalLoading(true);
        setZonalError(null);

        getZonalNDVI(entradas, period)
            .then((resposta) => {
                if (cancelado) return;
                const porId: Record<string, ZonalTalhaoResult> = {};
                resposta.results.forEach((r) => { porId[r.id] = r; });
                setZonalNDVI(porId);
                onZonalNDVI?.(porId);
            })
            .catch((err) => {
                if (cancelado) return;
                setZonalError(err instanceof Error ? err.message : 'Falha ao calcular NDVI por talhao.');
            })
            .finally(() => {
                if (!cancelado) setZonalLoading(false);
            });

        return () => { cancelado = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layerType, period, assinaturaZonal]);

    const geojsonData = useMemo<GeoJSONData>(() => {
        const features = talhoes
            .map((t) => {
                if (!t.geometry) return null;
                // Esconder da camada MapLibre caso esteja sendo editado no MapboxDraw
                if (isEditingMode && t.id === selectedTalhaoId) return null;

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
                            // -2 e um sentinela fora da faixa real do NDVI (-1 a 1):
                            // marca "sem valor" sem se confundir com solo exposto.
                            ndvi: zonalNDVI[String(t.id)]?.ndvi ?? -2,
                        },
                        geometry,
                    };
                } catch {
                    return null;
                }
            })
            .filter((f): f is any => f !== null);
        return { type: 'FeatureCollection', features };
    }, [talhoes, isEditingMode, selectedTalhaoId, zonalNDVI]);

    // Na camada NDVI o talhao e pintado pelo proprio vigor medido, e nao pela
    // cor da cultura. Quem nao tem medida (nuvem, erro, talhao novo) fica cinza
    // em vez de assumir a ponta baixa da escala.
    const ndviFillColor = useMemo(
        () =>
            ([
                'case',
                ['<', ['get', 'ndvi'], -1], '#94a3b8',
                [
                    'interpolate', ['linear'], ['get', 'ndvi'],
                    0.0, '#b45309',
                    0.3, '#f59e0b',
                    0.5, '#facc15',
                    0.7, '#4ade80',
                    0.9, '#15803d',
                ],
            ]) as any,
        [],
    );

    const fillPaint = useMemo(
        () =>
            ({
                'fill-color': layerType === 'sentinel_ndvi'
                    ? ndviFillColor
                    : ['coalesce', ['get', 'fillColor'], ['get', 'color'], '#3bb444'],
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], FILL_OPACITY.selected,
                    ['boolean', ['feature-state', 'hover'], false], FILL_OPACITY.hover,
                    FILL_OPACITY.base,
                ],
            }) as any,
        [layerType, ndviFillColor],
    );
    const linePaint = useMemo(
        () =>
            ({
                // Selecionado ganha contorno BRANCO: sobre imagem de satélite o
                // branco é a única cor que se destaca de qualquer cultura e de
                // qualquer solo. A cor própria do talhão segue no preenchimento.
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false], '#ffffff',
                    ['coalesce', ['get', 'borderColor'], ['get', 'color'], '#228b22'],
                ],
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
            const { isDrawingMode, isEditingMode, talhoes, onTalhaoClick, onBackgroundClick, isMobile } =
                liveRef.current;

            if (isDrawingMode || isEditingMode) return;

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
                    const maxAllowedZoom = maxZoomForProvider(liveRef.current.satelliteProvider);
                    const targetZoom = Math.min(currentZoom + 1.6, maxAllowedZoom);
                    map.flyTo({ center: center as any, zoom: targetZoom, duration: 600, essential: true });
                } catch {
                    /* flyTo pode falhar se o mapa não estiver pronto; ignora silenciosamente */
                }
            }
        };

        let hoverRafId: number | null = null;
        const handleMove = (e: MapMouseEvent) => {
            if (liveRef.current.isDrawingMode) {
                setCursorSafe('crosshair');
                return;
            }
            if (hoverRafId != null) return;
            const point = e.point;
            hoverRafId = requestAnimationFrame(() => {
                hoverRafId = null;
                const picked = pickTalhao(map, point, liveRef.current.talhoes, 0);
                if (picked) {
                    setHover(map, picked.featureId);
                    setCursorSafe('pointer');
                    setHoverInfo({ lng: e.lngLat.lng, lat: e.lngLat.lat, talhao: picked.talhao });
                } else {
                    setHover(map, null);
                    setCursorSafe('');
                    setHoverInfo(null);
                }
            });
        };

        const handleMouseOut = () => {
            setHover(map, null);
            setCursorSafe('');
            setHoverInfo(null);
        };
        const handleDragStart = () => {
            setHover(map, null);
            setCursorSafe('');
            setHoverInfo(null);
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
            if (hoverRafId != null) cancelAnimationFrame(hoverRafId);
            map.off('mousedown', onPointerDown);
            map.off('touchstart', onPointerDown);
            map.off('touchstart', markTouch);
            map.off('click', handleClick);
            map.off('mousemove', handleMove);
            map.off('mouseout', handleMouseOut);
            map.off('dragstart', handleDragStart);
        };
    }, [mapReady, setHover, commitSelection, setCursorSafe]);

    // Avisa (uma vez por sessão de tiles) quando a imagem de satélite falha ao
    // carregar de verdade (rede/CORS/403) — não cobre o caso do Esri devolver
    // um tile "sem dados" com HTTP 200 (indistinguível de uma imagem válida).
    useEffect(() => {
        if (!mapReady) return;
        const map = mapRef.current?.getMap();
        if (!map) return;
        let warned = false;
        const handleTileError = (e: any) => {
            if (warned) return;
            if (e.sourceId !== 'esri-satellite' && e.sourceId !== 'google-satellite') return;
            warned = true;
            toast.warn('Alguns tiles de satélite não carregaram. Verifique sua conexão.');
        };
        map.on('error', handleTileError);
        return () => {
            map.off('error', handleTileError);
        };
    }, [mapReady, satelliteProvider]);

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
        setHoverInfo(null);
        if (map) setHover(map, null);
    }, [isDrawerOpen, setHover, setCursorSafe]);

    useEffect(() => {
        if (!drawInstance) return;
        try {
            const mode = drawInstance.getMode();
            if (isDrawingMode && mode !== 'draw_polygon') {
                drawInstance.deleteAll();
                drawInstance.changeMode('draw_polygon');
                setCursorSafe('crosshair');
            } else if (isEditingMode && selectedTalhaoId != null) {
                if (mode !== 'direct_select') {
                    drawInstance.deleteAll();
                    const talhao = talhoes.find(t => t.id === selectedTalhaoId);
                    if (talhao && talhao.geometry) {
                        const geo = typeof talhao.geometry === 'string' ? JSON.parse(talhao.geometry) : talhao.geometry;
                        const addedIds = drawInstance.add({
                            id: String(talhao.id),
                            type: 'Feature',
                            properties: {},
                            geometry: geo
                        });
                        if (addedIds && addedIds.length > 0) {
                            setTimeout(() => {
                                try {
                                    drawInstance.changeMode('direct_select', { featureId: addedIds[0] });
                                } catch (e) {
                                    console.error('Failed to change mode to direct_select', e);
                                }
                            }, 50);
                        }
                        setCursorSafe('');
                    }
                }
            } else if (!isDrawingMode && !isEditingMode && mode !== 'simple_select') {
                drawInstance.deleteAll();
                drawInstance.changeMode('simple_select');
                setCursorSafe('');
            }
        } catch (err) {
            console.error('Mapbox Draw mode change failed:', err);
        }
    }, [isDrawingMode, isEditingMode, selectedTalhaoId, drawInstance, setCursorSafe, talhoes]);

    useEffect(() => {
        if (trashDrawingTrigger && drawInstance) drawInstance.trash();
    }, [trashDrawingTrigger, drawInstance]);

    useEffect(() => {
        if (finishDrawingTrigger > 0 && drawInstance && (isDrawingMode || isEditingMode)) {
            drawInstance.changeMode('simple_select');
        }
    }, [finishDrawingTrigger, drawInstance, isDrawingMode, isEditingMode]);

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

    // Só monta o mapa com o provedor de satélite já resolvido. Montando antes,
    // o estilo troca de ESRI para Google no meio do carregamento e o MapLibre
    // avisa "Style is not done loading. Rebuilding the style from scratch" —
    // ele joga fora o estilo e reconstrói, desperdiçando o primeiro carregamento.
    if (satelliteProvider === 'loading') {
        return (
            <div className="w-full h-full flex items-center justify-center bg-slate-200">
                <Loader2 className="animate-spin text-emerald-600" size={28} />
            </div>
        );
    }

    return (
        <Map
            ref={mapRef}
            onLoad={() => setMapReady(true)}
            cursor={cursor}
            clickTolerance={isMobile ? 6 : 3}
            maxZoom={18}
            minZoom={12}
            initialViewState={{
                longitude: centerCoords?.longitude ?? -48.2772,
                latitude: centerCoords?.latitude ?? -18.9186,
                zoom: 16
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={satelliteStyle as any}
        >
            <MapController
                talhoes={talhoes}
                focusTarget={focusTarget}
                isDrawerOpen={isDrawerOpen}
                centerCoords={centerCoords}
            />

            {/* GEE Sentinel Raster Layer */}
            {layerType !== 'base' && tileData?.tiles?.[0] && !tileLoading && (
                <Source
                    id={`gee-sentinel-${layerType}-${period}`}
                    type="raster"
                    tiles={tileData.tiles}
                    tileSize={tileData.tileSize ?? 256}
                    bounds={tileData.bounds}
                >
                    <Layer
                        id={`gee-sentinel-raster-${layerType}`}
                        type="raster"
                        paint={{ 'raster-opacity': layerOpacity }}
                    />
                </Source>
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

            <MapDrawControl
                position="top-left"
                displayControlsDefault={false}
                controls={{ polygon: false, trash: false }}
                defaultMode="simple_select"
                getDrawInstance={setDrawInstance}
                onCreate={stableOnDrawCreate}
                onUpdate={stableOnDrawUpdate}
                onDelete={stableOnDrawDelete}
                onModeChange={handleModeChange}
            />

            {hoverInfo && !isDrawingMode && !isEditingMode && (
                <Popup
                    longitude={hoverInfo.lng}
                    latitude={hoverInfo.lat}
                    closeButton={false}
                    closeOnClick={false}
                    anchor="bottom"
                    offset={[0, -10]}
                    className="pointer-events-none"
                    style={{ zIndex: 50 }}
                >
                    <div style={{ fontFamily: 'sans-serif', fontSize: '13px', padding: '4px 6px', color: '#1E293B', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontWeight: 'bold' }}>{hoverInfo.talhao.nome || 'Talhão'}</div>
                        <div style={{ color: '#64748B', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <div style={{ width: 8, height: 8, background: hoverInfo.talhao.fillColor || hoverInfo.talhao.cor || getCropColor(hoverInfo.talhao.cultura), borderRadius: '50%' }} />
                            <span>{hoverInfo.talhao.cultura || 'Área Livre'}</span>
                        </div>
                    </div>
                </Popup>
            )}

            {/* Pinos por talhão: o selecionado vira uma etiqueta com nome e área,
                os demais ficam como marca discreta. Some no modo de desenho,
                onde o que importa são os vértices. */}
            {!isDrawingMode && !isEditingMode && centroids.map((c: any) => {
                const selecionado = String(c.id) === String(selectedTalhaoId);
                const cor = c.talhao.fillColor || c.talhao.cor || getCropColor(c.talhao.cultura);
                const area = c.talhao.area_total_m2 || c.talhao.area_m2 || 0;

                return (
                    <Marker
                        key={`pino-${c.id}`}
                        longitude={c.lng}
                        latitude={c.lat}
                        anchor="center"
                        onClick={() => onTalhaoClick?.(c.talhao)}
                    >
                        {selecionado ? (
                            <div className="flex items-center gap-2.5 bg-white rounded-full pl-1.5 pr-4 py-1.5 shadow-[0_12px_28px_-8px_rgba(15,23,42,0.55)] whitespace-nowrap cursor-pointer select-none animate-in fade-in zoom-in-95 duration-200">
                                <span
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: cor }}
                                >
                                    <Sprout size={16} className="text-white" />
                                </span>
                                <span className="flex flex-col leading-tight">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                        {area >= 10000 ? `${(area / 10000).toFixed(2)} ha` : `${Math.round(area)} m²`}
                                    </span>
                                    <span className="text-[13px] font-extrabold text-slate-900">
                                        {c.talhao.nome || 'Talhão'}
                                    </span>
                                </span>
                            </div>
                        ) : (
                            <span className="w-8 h-8 rounded-full bg-white/25 border border-white/50 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                                <span
                                    className="w-5 h-5 rounded-full border-2 border-white/70"
                                    style={{ backgroundColor: cor }}
                                />
                            </span>
                        )}
                    </Marker>
                );
            })}

            {centerCoords && Number.isFinite(centerCoords.latitude) && Number.isFinite(centerCoords.longitude) && centroids.length === 0 && (
                <Marker longitude={centerCoords.longitude} latitude={centerCoords.latitude} anchor="bottom">
                    <div className="flex flex-col items-center select-none animate-in fade-in zoom-in duration-300">
                        <div className="bg-emerald-700 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow-xl border border-white/50 mb-1 flex items-center gap-1.5 backdrop-blur-md">
                            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                            Sede / Ponto Central
                        </div>
                        <div className="w-8 h-8 rounded-full bg-emerald-600 border-2 border-white shadow-2xl flex items-center justify-center text-white ring-4 ring-emerald-500/20">
                            <Sprout size={16} />
                        </div>
                    </div>
                </Marker>
            )}

            <NavigationControl position="bottom-left" />

            {/* Painel de camadas (rail a esquerda: a direita e do painel do talhao) */}
            {!isDrawingMode && (
                <div className={cn(
                    "absolute top-4 left-4 z-10 pointer-events-none",
                    // O painel do talhão agora é um card centralizado com teto de
                    // altura, então sobra faixa livre no topo e este botão continua
                    // alcançável mesmo com ele aberto.
                    "block",
                )}>
                    <div className="relative flex flex-col gap-2 p-2 rounded-full bg-slate-900/30 backdrop-blur-md pointer-events-auto">
                        <MapLayersPanel
                            open={layersPanelOpen}
                            onToggle={() => setLayersPanelOpen((v) => !v)}
                            layerType={layerType}
                            onLayerTypeChange={setLayerType}
                            period={period}
                            onPeriodChange={setPeriod}
                            opacity={layerOpacity}
                            onOpacityChange={setLayerOpacity}
                            tileLoading={tileLoading}
                            tileError={tileError}
                            tileData={tileData}
                            zonalLoading={zonalLoading}
                            zonalError={zonalError}
                            zonalSemImagem={Object.values(zonalNDVI).filter((r) => r.status === 'sem_imagem').length}
                        />
                    </div>
                </div>
            )}

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
