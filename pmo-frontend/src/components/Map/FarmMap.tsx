import React, { useMemo, useEffect } from 'react';
import Map, { Source, Layer, Marker, useMap } from 'react-map-gl/maplibre';
import { Talhao, GeoJSONGeometry } from '../../domain/geo/geoTypes';
import { ESRI_SATELLITE_STYLE } from './mapStyles';

// Tipagem para GeoJSON FeatureCollection
interface GeoJSONData {
    type: 'FeatureCollection';
    features: any[];
}

interface MapCreatedEvent {
    layer?: any;
    geometry: string;
    areaM2: number;
}

interface FarmMapProps {
    talhoes: Talhao[];
    focusTarget?: Talhao | null;
    selectedTalhaoId?: number;
    onCreated?: (e: any) => void;
    onEdited?: (e: any) => void;
    onDeleted?: (e: any) => void;
    onMapCreated?: (event: MapCreatedEvent) => void;
    onSaveTalhao?: (talhao: Talhao) => void;
    onTalhaoClick?: (talhao: Talhao) => void;
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
const MapController: React.FC<{ talhoes: Talhao[], focusTarget?: Talhao | null }> = ({ talhoes, focusTarget }) => {
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

                    map.fitBounds(
                        [minLng, minLat, maxLng, maxLat],
                        { padding: 80, maxZoom: 16, duration: 1200 }
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
                map.fitBounds(
                    [minLng, minLat, maxLng, maxLat],
                    { padding: 50, duration: 1000 }
                );
            }
        }
    }, [talhoes, focusTarget, map]);

    return null;
};

const FarmMap: React.FC<FarmMapProps> = ({
    talhoes = [],
    focusTarget,
    selectedTalhaoId,
    onTalhaoClick
}) => {
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
                            color: getCropColor(t.cultura),
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

    // Calcular Centróides para os Markers (Pílulas)
    const centroids = useMemo(() => {
        return talhoes.map(t => {
            if (!t.geometry) return null;
            try {
                const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                if (!geo.coordinates || !geo.coordinates[0]) return null;
                
                const coords = geo.coordinates[0];
                let sumLng = 0, sumLat = 0;
                coords.forEach(([lng, lat]) => {
                    sumLng += lng;
                    sumLat += lat;
                });
                return {
                    id: t.id,
                    lng: sumLng / coords.length,
                    lat: sumLat / coords.length,
                    talhao: t
                };
            } catch (e) { return null; }
        }).filter(Boolean);
    }, [talhoes]);

    return (
        <Map
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
            interactiveLayerIds={['talhoes-fill']}
        >
            <Source id="talhoes-source" type="geojson" data={geojsonData}>
                {/* Layer de Preenchimento (Enterprise Vitreous Effect) */}
                <Layer
                    id="talhoes-fill"
                    type="fill"
                    paint={{
                        'fill-color': ['get', 'color'],
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
                    paint={{
                        'line-color': ['get', 'color'],
                        'line-width': ['case', ['==', ['id'], (selectedTalhaoId || -1)], 4, 2],
                        'line-opacity': 1
                    }}
                />
            </Source>

            {/* Pílulas HTML (Markers) */}
            {centroids.map(c => c && (
                <Marker 
                    key={c.id} 
                    longitude={c.lng} 
                    latitude={c.lat}
                    anchor="center"
                    onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        if (onTalhaoClick) onTalhaoClick(c.talhao);
                    }}
                >
                    <div className="map-marker-pill" style={{ 
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
                        <div style={{ width: '8px', height: '8px', background: getCropColor(c.talhao.cultura), borderRadius: '50%' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.3' }}>
                            <span style={{ fontWeight: 700, fontSize: 11, color: '#18181b', whiteSpace: 'nowrap' }}>{c.talhao.nome}</span>
                            <span style={{ fontWeight: 500, fontSize: 10, color: '#71717a', whiteSpace: 'nowrap' }}>{c.talhao.cultura || 'Área Livre'}</span>
                        </div>
                    </div>
                </Marker>
            ))}

            <MapController talhoes={talhoes} focusTarget={focusTarget} />
        </Map>
    );
};

export default FarmMap;
