import React, { useEffect } from 'react';
import L from 'leaflet';

// Injeção Global Prioritária
if (typeof window !== 'undefined') {
    (window as any).L = L;
}

import '../../leaflet-draw-shim';
import { MapContainer, TileLayer, Polygon, FeatureGroup, useMap, ZoomControl, Marker } from 'react-leaflet';
import { SafeEditControl } from './SafeEditControl';

import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Talhao, GeoJSONGeometry } from '../../domain/geo/geoTypes';

interface MapCreatedEvent {
    layer: L.Layer;
    geometry: string;
    areaM2: number;
}

interface MapControllerProps {
    talhoes: Talhao[];
    focusTarget?: Talhao | null;
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
    if (n.includes('milho'))                            return '#FBBF24'; // Amber-400 (Brilhante)
    if (n.includes('soja'))                             return '#F97316'; // Orange-500 (Vibrante)
    if (n.includes('feijão') || n.includes('feijao'))   return '#EC4899'; // Pink-500 (Neon)
    if (n.includes('pastagem') || n.includes('pasto'))  return '#10B981'; // Emerald-500 (Luminoso)
    if (n.includes('café') || n.includes('cafe'))       return '#8B5CF6'; // Violet-500 (Profundo)
    return '#38BDF8'; // Sky-400 (Default)
};


// Component to handle auto-zoom based on focusTarget or initial bounds
const MapController: React.FC<MapControllerProps> = ({ talhoes, focusTarget }) => {
    const map = useMap();

    useEffect(() => {
        if (focusTarget && focusTarget.geometry) {
            try {
                const geo: GeoJSONGeometry = typeof focusTarget.geometry === 'string' ? JSON.parse(focusTarget.geometry) : focusTarget.geometry;
                if (geo.coordinates && geo.coordinates[0]) {
                    const coords: L.LatLngTuple[] = geo.coordinates[0].map(c => [c[1], c[0]] as L.LatLngTuple);
                    const bounds = L.latLngBounds(coords);
                    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16, animate: true, duration: 1.2 });
                }
            } catch (e) {
                console.error("Invalid geometry for focus:", e);
            }
        } else if (talhoes.length > 0 && !focusTarget) {
            const bounds = L.latLngBounds([]);
            let hasValidBounds = false;
            talhoes.forEach(t => {
                if (t.geometry) {
                    try {
                        const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;
                        if (geo.coordinates && geo.coordinates[0]) {
                            const coords: L.LatLngTuple[] = geo.coordinates[0].map(c => [c[1], c[0]] as L.LatLngTuple);
                            bounds.extend(coords);
                            hasValidBounds = true;
                        }
                    } catch (e) { }
                }
            });
            if (hasValidBounds && bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [talhoes, focusTarget, map]);

    return null;
};

const FarmMap: React.FC<FarmMapProps> = ({
    talhoes = [],
    focusTarget,
    selectedTalhaoId,
    onEdited,
    onDeleted,
    onMapCreated,
    onTalhaoClick
}) => {
    const handleCreated = async (e: any) => {
        const layer = e.layer;

        // Calculate area immediately to pass to parent
        const geoJSON = layer.toGeoJSON();
        const areaM2 = (L as any).GeometryUtil?.geodesicArea(layer.getLatLngs()[0]) || 0;

        if (onMapCreated) {
            onMapCreated({
                layer,
                geometry: JSON.stringify(geoJSON.geometry),
                areaM2: areaM2
            });
        }
    };

    return (
        <MapContainer center={[-18.9186, -48.2772] as any} zoom={15} zoomControl={false} style={{ height: '100%', width: '100%' }}>
            <ZoomControl position="bottomright" />
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="Google Satélite" />

            <FeatureGroup>
                <SafeEditControl
                    position="topright"
                    onCreated={handleCreated}
                    onEdited={onEdited}
                    onDeleted={onDeleted}
                    draw={{
                        rectangle: false,
                        circle: false,
                        circlemarker: false,
                        marker: false,
                        polyline: false,
                        polygon: { allowIntersection: true, showArea: true, shapeOptions: { color: '#059669' } }
                    }}
                />

                {talhoes.map(t => {
                    if (!t.geometry) return null;
                    const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;

                    if (!geo.coordinates || !geo.coordinates[0]) return null;
                    const positions: L.LatLngTuple[] = geo.coordinates[0].map(c => [c[1], c[0]] as L.LatLngTuple);

                    const talhaoColor = getCropColor(t.cultura);
                    const isSelected = selectedTalhaoId === t.id;

                    return (
                        <React.Fragment key={t.id}>
                            <Polygon
                                positions={positions}
                                pathOptions={{
                                    color: talhaoColor,
                                    fillColor: talhaoColor,
                                    weight: isSelected ? 4 : 3,
                                    opacity: 1,
                                    fillOpacity: isSelected ? 0.3 : 0.1,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                    className: 'polygon-glow-effect'
                                }}
                                eventHandlers={{
                                    click: (e) => {
                                        L.DomEvent.stopPropagation(e);
                                        if (onTalhaoClick) onTalhaoClick(t);
                                    }
                                }}
                            />
                            
                            {/* Centroid Label (Pill Flutuante no Mapa - Dark Discrete) */}
                            {positions.length > 0 && (
                                <Marker 
                                    position={L.polygon(positions).getBounds().getCenter()}
                                     icon={L.divIcon({ 
                                        className: '',
                                        iconSize: [0, 0],
                                        html: `
                                            <div style="background: white; border: 1px solid #e4e4e7; border-radius: 12px; padding: 6px 12px; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); width: max-content; min-width: fit-content; transform: translate(-50%, -50%);">
                                                <div style="width: 8px; height: 8px; min-width: 8px; background: ${talhaoColor}; border-radius: 50%;"></div>
                                                <div style="display: flex; flex-direction: column; line-height: 1.3;">
                                                    <span style="font-weight: 700; font-size: 11px; color: #18181b; white-space: nowrap;">${t.nome}</span>
                                                    <span style="font-weight: 500; font-size: 10px; color: #71717a; white-space: nowrap;">${t.cultura || 'Área Livre'}</span>
                                                </div>
                                            </div>
                                        `
                                    })}
                                    eventHandlers={{
                                        click: (_e) => {
                                            if (onTalhaoClick) onTalhaoClick(t);
                                        }
                                    }}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </FeatureGroup>
            <MapController talhoes={talhoes} focusTarget={focusTarget} />
        </MapContainer>
    );
};

export default FarmMap;
