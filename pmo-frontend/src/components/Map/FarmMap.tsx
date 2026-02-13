// src/components/Map/FarmMap.tsx

import React, { useEffect, MouseEvent } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, FeatureGroup, useMap } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L, { LatLngExpression } from 'leaflet';

// Types
interface GeoJSONGeometry {
    type: string;
    coordinates: number[][][];
}

interface Talhao {
    id: string;
    nome: string;
    tipo?: string;
    geometry?: string | GeoJSONGeometry;
    cor?: string;
    area_total_m2?: number;
    area_m2?: number;
    cultura?: string;
    ph_solo?: number;
    v_percent?: number;
    teor_argila?: number;
}

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
                    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true, duration: 1.5 });
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
            if (hasValidBounds && bounds.isValid()) map.fitBounds(bounds);
        }
    }, [talhoes, focusTarget, map]);

    return null;
};

const FarmMap: React.FC<FarmMapProps> = ({ talhoes, focusTarget, onCreated, onEdited, onDeleted, onMapCreated, onSaveTalhao, onTalhaoClick }) => {

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
        // @ts-expect-error react-leaflet v5 types incompatibility
        <MapContainer center={[-18.9186, -48.2772] as LatLngExpression} zoom={15} style={{ height: '100%', width: '100%', minHeight: '500px' }}>
            {/* @ts-expect-error react-leaflet v5 types incompatibility */}
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="Google Satélite" />

            <FeatureGroup>
                <EditControl
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
                        polygon: { allowIntersection: true, showArea: true, shapeOptions: { color: '#97009c' } }
                    }}
                />

                {talhoes.map(t => {
                    if (!t.geometry) return null;
                    const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;

                    if (!geo.coordinates || !geo.coordinates[0]) return null;
                    const positions: L.LatLngTuple[] = geo.coordinates[0].map(c => [c[1], c[0]] as L.LatLngTuple);

                    return (
                        <Polygon
                            key={t.id}
                            positions={positions}
                            pathOptions={{ color: t.cor || '#FFF', fillColor: t.cor, fillOpacity: 0.5 }}
                            eventHandlers={{
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e);
                                    if (onTalhaoClick) onTalhaoClick(t);
                                }
                            }}
                        >
                            <Popup>
                                <strong>{t.nome}</strong><br />
                                <small style={{ color: '#666' }}>{t.tipo ? t.tipo.toUpperCase() : 'TALHÃO'}</small><br />
                                Área: {t.area_total_m2 || t.area_m2} m²<br />
                                {t.cultura && <span>🌱: {t.cultura}<br /></span>}
                                <hr style={{ margin: '4px 0' }} />
                                🧪 pH: {t.ph_solo || '-'}<br />
                                ⚡ V%: {t.v_percent || '-'}%<br />
                                🧱 Argila: {t.teor_argila || '-'}%
                                {onTalhaoClick && (
                                    <div style={{ marginTop: '8px', textAlign: 'center' }}>
                                        <button
                                            style={{ cursor: 'pointer', padding: '4px 8px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px' }}
                                            onClick={(e: MouseEvent) => {
                                                e.stopPropagation();
                                                onTalhaoClick(t);
                                            }}
                                        >
                                            Gerenciar
                                        </button>
                                    </div>
                                )}
                            </Popup>
                        </Polygon>
                    )
                })}
            </FeatureGroup>
            <MapController talhoes={talhoes} focusTarget={focusTarget} />
        </MapContainer>
    );
};

export default FarmMap;
