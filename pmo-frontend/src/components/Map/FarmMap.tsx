import React, { useEffect, MouseEvent } from 'react';
import L from 'leaflet';

// Injeção Global Prioritária
if (typeof window !== 'undefined') {
    (window as any).L = L;
}

import '../../leaflet-draw-shim';
import { MapContainer, TileLayer, Polygon, Popup, FeatureGroup, useMap } from 'react-leaflet';
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
    editingCanteiroId?: string | null;
    onCreated?: (e: any) => void;
    onEdited?: (event: { layer: any; geometry: string }) => void;
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

const FarmMap: React.FC<FarmMapProps> = ({
    talhoes = [],
    focusTarget,
    editingCanteiroId,
    onEdited,
    onDeleted,
    onMapCreated,
    onTalhaoClick
}) => {
    const handleEdited = (e: any) => {
        if (!e || !e.layers) return;
        e.layers.eachLayer((layer: any) => {
            if (onEdited) {
                const geoJSON = layer.toGeoJSON();
                onEdited({ layer, geometry: JSON.stringify(geoJSON.geometry) });
            }
        });
    };

    const handleCreated = async (e: any) => {
        if (!e || !e.layer) return;
        const { layerType, layer } = e;

        if (layerType === 'polygon' || layerType === 'rectangle') {
            const geoJSON = layer.toGeoJSON();

            // Usa as coordenadas do próprio GeoJSON para calcular a área de forma segura
            let areaM2 = 0;
            try {
                if (geoJSON.geometry && geoJSON.geometry.coordinates && geoJSON.geometry.coordinates[0]) {
                    const coords = geoJSON.geometry.coordinates[0];
                    const latLngs = coords.map((c: any) => L.latLng(c[1], c[0]));
                    areaM2 = (L as any).GeometryUtil?.geodesicArea(latLngs) || 0;
                }
            } catch (err) {
                console.error("Erro ao calcular area:", err);
            }

            if (onMapCreated) {
                onMapCreated({
                    layer,
                    geometry: JSON.stringify(geoJSON.geometry),
                    areaM2: Math.round(areaM2)
                });
            }
        }
    };

    return (
        <MapContainer center={[-18.9186, -48.2772] as any} zoom={15} style={{ height: '100%', width: '100%', minHeight: '500px' }}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="Google Satélite" />

            <FeatureGroup>
                <SafeEditControl
                    position="topright"
                    onCreated={handleCreated}
                    onEdited={handleEdited}
                    onDeleted={onDeleted}
                    draw={{
                        rectangle: true,
                        circle: false,
                        circlemarker: false,
                        marker: true,
                        polyline: false,
                        polygon: { allowIntersection: true, showArea: true, shapeOptions: { color: '#97009c' } }
                    }}
                />

                {talhoes.map(t => {
                    if (!t.geometry) return null;
                    const geo: GeoJSONGeometry = typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry;

                    if (!geo.coordinates || !geo.coordinates[0]) return null;
                    const positions: L.LatLngTuple[] = geo.coordinates[0].map(c => [c[1], c[0]] as L.LatLngTuple);

                    // Se estivermos em modo de edição de um canteiro específico dentro deste talhão, não habilitamos clique do talhão
                    // Porém, vamos manter renderizado apenas com baixa opacidade para referencial
                    const isFaded = editingCanteiroId && focusTarget?.id !== t.id;

                    return (
                        <Polygon
                            key={`talhao-${t.id}`}
                            positions={positions}
                            pathOptions={{ color: t.cor || '#FFF', fillColor: t.cor, fillOpacity: isFaded ? 0.2 : 0.5 }}
                            eventHandlers={{
                                click: (e) => {
                                    L.DomEvent.stopPropagation(e);
                                    if (onTalhaoClick && !editingCanteiroId) onTalhaoClick(t);
                                }
                            }}
                        >
                            <Popup>
                                <strong>{t.nome}</strong><br />
                                <small style={{ color: '#666' }}>{t.tipo ? t.tipo.toUpperCase() : 'TALHÃO'}</small><br />
                                Área: {t.area_total_m2 || t.area_m2 || 0} m²<br />
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

                {/* Renderizar Canteiros do Focus Target se tiver geometry */}
                {focusTarget?.canteiros?.map((canteiro: any) => {
                    if (!canteiro.geometry) return null;
                    try {
                        const geo: GeoJSONGeometry = typeof canteiro.geometry === 'string' ? JSON.parse(canteiro.geometry) : canteiro.geometry;
                        if (!geo.coordinates || !geo.coordinates[0]) return null;
                        
                        // Polygon required format
                        let positions: L.LatLngTuple[] | L.LatLngTuple[][] = [];
                        if (geo.type === 'Polygon') {
                            positions = geo.coordinates[0].map((c: any) => [c[1], c[0]] as L.LatLngTuple);
                        } else {
                            return null;
                        }

                        // Destacar se for o canteiro em edição
                        const isEditingThis = String(canteiro.id) === String(editingCanteiroId);

                        return (
                            <Polygon
                                key={`canteiro-${canteiro.id}`}
                                positions={positions}
                                pathOptions={{ 
                                    color: isEditingThis ? '#f59e0b' : '#3b82f6', 
                                    fillColor: isEditingThis ? '#fcd34d' : '#93c5fd', 
                                    fillOpacity: isEditingThis ? 0.8 : 0.6,
                                    weight: isEditingThis ? 3 : 2,
                                    dashArray: isEditingThis ? '4, 4' : undefined
                                }}
                            >
                                <Popup>
                                    <strong>{canteiro.nome}</strong><br />
                                    <small style={{ color: '#666' }}>ESTRUTURA / CANTEIRO</small><br />
                                    {isEditingThis && <span style={{color: '#f59e0b', fontWeight: 'bold'}}>Modo de Edição Ativo</span>}
                                </Popup>
                            </Polygon>
                        );
                    } catch(e) {
                         return null;
                    }
                })}
            </FeatureGroup>
            <MapController talhoes={talhoes} focusTarget={focusTarget} />
        </MapContainer>
    );
};

export default FarmMap;
