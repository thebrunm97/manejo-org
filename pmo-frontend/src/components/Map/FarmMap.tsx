import React, { useMemo, useEffect } from 'react';
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

interface MapCreatedEvent {
    feature?: any;
    geometry: any;
    areaM2: number;
}

interface FarmMapProps {
    talhoes: Talhao[];
    focusTarget?: Talhao | null;
    selectedTalhaoId?: number | string;
    onDrawCreate?: (e: any) => void;
    onDrawUpdate?: (e: any) => void;
    onDrawDelete?: (e: any) => void;
    onTalhaoClick?: (talhao: Talhao) => void;
    isDrawerOpen?: boolean;
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
    isDrawerOpen
}) => {
    const [cursor, setCursor] = React.useState<string | undefined>(undefined);
    const [drawInstance, setDrawInstance] = React.useState<MapboxDraw | null>(null);

    // Sincronizar Talhão Selecionado com o Draw (Modo de Edição)
    useEffect(() => {
        if (!drawInstance) return;

        if (selectedTalhaoId) {
            const talhao = talhoes.find(t => t.id === selectedTalhaoId);
            if (talhao && talhao.geometry) {
                try {
                    const geometry = typeof talhao.geometry === 'string' ? JSON.parse(talhao.geometry) : talhao.geometry;
                    const feature = {
                        type: 'Feature',
                        id: talhao.id,
                        properties: { id: talhao.id },
                        geometry
                    } as any;

                    drawInstance.deleteAll();
                    drawInstance.add(feature);
                    drawInstance.changeMode('direct_select', { featureId: talhao.id as string });
                } catch (e) {
                    console.error("Error syncing to draw:", e);
                }
            }
        } else {
            drawInstance.deleteAll();
            // Retorna ao modo padrão caso nada esteja selecionado
            if (drawInstance.getMode() !== 'simple_select') {
                drawInstance.changeMode('simple_select');
            }
        }
    }, [selectedTalhaoId, drawInstance, talhoes]);

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
                            fill_color: t.fill_color || t.fillColor || t.cor || getCropColor(t.cultura),
                            border_color: t.border_color || t.borderColor || t.fill_color || t.fillColor || t.cor || getCropColor(t.cultura),
                            isSelected: selectedTalhaoId === t.id
                        },
                        geometry
                    };
                } catch (e) {
                    return null;
                }
            })
            .filter(Boolean);

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
        <Map
            cursor={cursor}
            initialViewState={{
                longitude: -48.2772,
                latitude: -18.9186,
                zoom: 15
            }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={ESRI_SATELLITE_STYLE as any}
            onClick={(e) => {
                const feature = e.features?.[0];
                if (feature && onTalhaoClick) {
                    const talhao = talhoes.find(t => t.id === feature.properties.id);
                    if (talhao) onTalhaoClick(talhao);
                }
            }}
            interactiveLayerIds={['talhoes-fill', 'talhoes-line']}
        >
            <MapDrawControl
                position="top-left"
                displayControlsDefault={false}
                controls={{
                    polygon: true,
                    trash: true
                }}
                defaultMode="simple_select"
                getDrawInstance={setDrawInstance}
                onCreate={onDrawCreate}
                onUpdate={onDrawUpdate}
                onDelete={onDrawDelete}
                onModeChange={handleModeChange}
            />
            <Source id="talhoes-source" type="geojson" data={geojsonData}>
                {/* Layer de Preenchimento (Enterprise Vitreous Effect) */}
                <Layer
                    id="talhoes-fill"
                    type="fill"
                    filter={['!=', ['get', 'id'], selectedTalhaoId || '']}
                    paint={{
                        'fill-color': ['get', 'fill_color'],
                        'fill-opacity': [
                            'case',
                            ['boolean', ['feature-state', 'hover'], false],
                            0.6,
                            selectedTalhaoId ? ['case', ['==', ['id'], selectedTalhaoId], 0.4, 0.1] : 0.2
                        ]
                    }}
                />
                
                {/* Layer de Borda (Solid Detail) */}
                <Layer
                    id="talhoes-line"
                    type="line"
                    filter={['!=', ['get', 'id'], selectedTalhaoId || '']}
                    paint={{
                        'line-color': ['get', 'border_color'],
                        'line-width': ['case', ['==', ['id'], (selectedTalhaoId || -1)], 4, 2],
                        'line-opacity': 1
                    }}
                />
            </Source>

            {/* Pílulas HTML (Markers) - Ghost Labels (pointer-events-none) */}
            {centroids.map(c => c && (
                <Marker 
                    key={c.id} 
                    longitude={c.lng} 
                    latitude={c.lat}
                    anchor="center"
                    style={{ pointerEvents: 'none' }}
                >
                    <div className="map-marker-pill pointer-events-none select-none" style={{ 
                        background: 'white', 
                        border: '1px solid #e4e4e7', 
                        borderRadius: '12px', 
                        padding: '6px 12px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                        width: 'max-content'
                    }}>
                        <div style={{ 
                            width: '8px', 
                            height: '8px', 
                            background: c.talhao.fill_color || c.talhao.fillColor || c.talhao.cor || getCropColor(c.talhao.cultura), 
                            borderRadius: '50%' 
                        }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                            <span style={{ fontWeight: 700, fontSize: 11, color: '#18181b', whiteSpace: 'nowrap' }}>{c.talhao.nome}</span>
                            <span style={{ fontWeight: 500, fontSize: 10, color: '#71717a', whiteSpace: 'nowrap' }}>{c.talhao.cultura || 'Área Livre'}</span>
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
