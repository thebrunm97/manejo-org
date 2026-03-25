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
    onCreated?: (e: any) => void;
    onEdited?: (e: any) => void;
    onDeleted?: (e: any) => void;
    onMapCreated?: (event: MapCreatedEvent) => void;
    onSaveTalhao?: (talhao: Talhao) => void;
    onTalhaoClick?: (talhao: Talhao) => void;
}

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
            <ZoomControl position="bottomleft" />
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

                    return (
                        <React.Fragment key={t.id}>
                            <Polygon
                                positions={positions}
                                pathOptions={{ 
                                    color: '#10b981', 
                                    fillColor: 'transparent', 
                                    fillOpacity: 0,
                                    weight: 2,
                                    fill: false,
                                    lineJoin: 'round',
                                    lineCap: 'round'
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
                                        // Reset ALL Leaflet default styles (white box, border, shadow)
                                        className: '!bg-transparent !border-none !shadow-none !p-0 !m-0',
                                        html: `
                                            <div style="transform: translate(-50%, -50%); pointer-events: none; background: transparent;">
                                                <div style="display: flex; align-items: center; background: rgba(24,24,27,0.92); color: white; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; box-shadow: 0 2px 10px rgba(0,0,0,0.4); border: 1px solid rgba(63,63,70,0.6); pointer-events: auto; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer;">
                                                    ${t.nome}
                                                </div>
                                            </div>
                                        `,
                                        iconSize: undefined as any,
                                        iconAnchor: undefined as any,
                                        popupAnchor: undefined as any
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
