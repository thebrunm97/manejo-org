// src/components/PropertyMap/SatelliteView.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
    Trash2,
    Save,
    Layers,
    Square,
    Edit2,
    Loader2,
    X,
    Map as MapIcon,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { MapContainer, TileLayer, FeatureGroup, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import { useTalhaoManager } from '../../hooks/map/useTalhaoManager';
import { useAuth } from '../../context/AuthContext';
import TalhaoDetails from '../Map/TalhaoDetails';
import { cn } from '../../utils/cn';

// --- ÍCONES LEAFLET FIX ---
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const GlobalMapStyles = () => (
    <style>{`
        .leaflet-container {
            font-family: 'Inter', sans-serif !important;
        }
        .map-label-transparent {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        .map-label-transparent::before {
            display: none !important;
        }
        .leaflet-top { top: 16px; }
        .leaflet-left { left: 16px; }
        .leaflet-bar {
            border: none !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
            border-radius: 12px !important;
            overflow: hidden;
        }
        .leaflet-bar a {
            background-color: white !important;
            color: #64748b !important;
            border-bottom: 1px solid #f1f5f9 !important;
            width: 40px !important;
            height: 40px !important;
            line-height: 40px !important;
        }
        .leaflet-bar a:hover {
            background-color: #f8fafc !important;
            color: #1e293b !important;
        }
    `}</style>
);

// --- COMPONENTE DE DESENHO ---
const DrawControl = ({ featureGroupRef, onCreated, onDeleted }) => {
    const map = useMap();
    const drawControlRef = useRef(null);

    useEffect(() => {
        if (!map || !featureGroupRef.current) return;

        if (drawControlRef.current) {
            map.removeControl(drawControlRef.current);
        }

        const drawControl = new L.Control.Draw({
            edit: {
                featureGroup: featureGroupRef.current,
                remove: true,
                edit: false,
            },
            draw: {
                polygon: {
                    allowIntersection: false,
                    showArea: false,
                    drawError: {
                        color: '#ef4444',
                        message: '<strong>Erro:</strong> não pode cruzar linhas!'
                    },
                    shapeOptions: {
                        color: '#16a34a',
                        weight: 4,
                        opacity: 1,
                        fillOpacity: 0.35,
                        fillColor: '#16a34a'
                    }
                },
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
            },
        });

        map.addControl(drawControl);
        drawControlRef.current = drawControl;

        const handleDrawCreated = (e) => {
            const layer = e.layer;
            featureGroupRef.current.addLayer(layer);
            const geoJSON = layer.toGeoJSON();
            onCreated(geoJSON, layer);
        };

        const handleDrawDeleted = (e) => {
            const layers = e.layers;
            layers.eachLayer((layer) => {
                if (onDeleted) onDeleted(layer);
            });
        };

        map.on(L.Draw.Event.CREATED, handleDrawCreated);
        map.on(L.Draw.Event.DELETED, handleDrawDeleted);

        return () => {
            map.removeControl(drawControl);
            map.off(L.Draw.Event.CREATED, handleDrawCreated);
            map.off(L.Draw.Event.DELETED, handleDrawDeleted);
        };
    }, [map, featureGroupRef, onCreated, onDeleted]);

    return null;
};

// --- RENDERIZADOR IMPERATIVO ---
const TalhoesRenderer = ({ talhoes, onTalhaoClick, selectedTalhaoId }) => {
    const map = useMap();
    const layerGroupRef = useRef(null);

    // Efeito para focar no talhão selecionado
    useEffect(() => {
        if (!map || !selectedTalhaoId || !talhoes || talhoes.length === 0) return;

        const selected = talhoes.find(t => t.id === selectedTalhaoId);
        if (selected && selected.geometry) {
            try {
                const geoJsonLayer = L.geoJSON(selected.geometry);
                const bounds = geoJsonLayer.getBounds();
                if (bounds.isValid()) {
                    map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 17, animate: true, duration: 1.5 });
                }
            } catch (e) {
                console.error("Erro ao focar no talhão:", e);
            }
        }
    }, [map, selectedTalhaoId, talhoes]);

    useEffect(() => {
        if (!map) return;

        if (!layerGroupRef.current) {
            layerGroupRef.current = new L.FeatureGroup();
        }

        if (!map.hasLayer(layerGroupRef.current)) {
            map.addLayer(layerGroupRef.current);
        }

        const group = layerGroupRef.current;
        group.clearLayers();

        const safeTalhoes = Array.isArray(talhoes) ? talhoes : [];

        safeTalhoes.forEach((t) => {
            try {
                if (!t || !t.geometry) return;

                const enrichedGeometry = {
                    ...t.geometry,
                    properties: { ...t.geometry.properties, id: t.id }
                };

                const isSelected = t.id === selectedTalhaoId;

                const geoJsonLayer = L.geoJSON(enrichedGeometry, {
                    style: {
                        color: t.cor || '#16a34a',
                        weight: isSelected ? 6 : 4,
                        opacity: 1,
                        fillOpacity: isSelected ? 0.7 : 0.4,
                        fillColor: t.cor || '#16a34a',
                    },
                    onEachFeature: (feature, layer) => {
                        layer.on({
                            click: (e) => {
                                L.DomEvent.stopPropagation(e);
                                if (onTalhaoClick) onTalhaoClick(t.id);
                            }
                        });
                    }
                });

                geoJsonLayer.eachLayer(l => {
                    if (l.bindTooltip && t.nome) {
                        l.bindTooltip(`
                            <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none;">
                                <span style="font-weight: 900; text-transform: uppercase; font-size: 13px; text-shadow: 0px 1px 4px rgba(0,0,0,0.8); color: white; letter-spacing: 0.5px;">${t.nome}</span>
                                <span style="font-size: 11px; font-weight: 700; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); color: #fff; padding: 1px 8px; border-radius: 99px; margin-top: 2px; border: 1px solid rgba(255,255,255,0.2);">
                                    ${t.area_ha ? Number(t.area_ha).toFixed(2) + ' ha' : ''}
                                </span>
                            </div>
                        `, {
                            permanent: true,
                            direction: "center",
                            className: "map-label-transparent"
                        });
                    }
                });

                group.addLayer(geoJsonLayer);
            } catch (err) {
                console.error("Erro ao renderizar talhão:", t, err);
            }
        });

        return () => { };
    }, [map, talhoes, onTalhaoClick, selectedTalhaoId]);

    useEffect(() => {
        return () => {
            if (map && layerGroupRef.current) {
                if (map.hasLayer(layerGroupRef.current)) {
                    map.removeLayer(layerGroupRef.current);
                }
            }
        };
    }, [map]);

    return null;
};

const SatelliteView = ({ pmoId }) => {
    const { user } = useAuth();
    const {
        talhoes,
        loading: talhoesLoading,
        addTalhao,
        removeTalhao
    } = useTalhaoManager(pmoId);

    const [activeCenter, setActiveCenter] = useState([-18.900582, -48.250880]);
    const [mapReady, setMapReady] = useState(false);
    const featureGroupRef = useRef(null);
    const [selectedTalhaoId, setSelectedTalhaoId] = useState(null);

    // Initial Geolocation
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    setActiveCenter([pos.coords.latitude, pos.coords.longitude]);
                    setMapReady(true);
                },
                () => setMapReady(true)
            );
        } else {
            setMapReady(true);
        }
    }, []);

    const handleCreated = async (geoJSON, layer) => {
        const latLngs = layer.getLatLngs()[0];
        const coords = latLngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));

        const nome = prompt("Nome do novo talhão:", `Talhão ${talhoes.length + 1}`);
        if (!nome) {
            featureGroupRef.current.removeLayer(layer);
            return;
        }

        const newTalhao = await addTalhao(coords, nome);

        if (!newTalhao) {
            alert('Erro ao salvar talhão.');
            featureGroupRef.current.removeLayer(layer);
        } else {
            featureGroupRef.current.removeLayer(layer);
        }
    };

    const handleSelectTalhao = (id) => {
        setSelectedTalhaoId(id);
    };

    const handleDelete = async (id) => {
        if (!confirm("Deletar talhão? Isso excluirá permanentemente todos os dados associados.")) return;
        const success = await removeTalhao(id);
        if (success) {
            setSelectedTalhaoId(null);
        } else {
            alert("Erro ao excluir talhão.");
        }
    };

    const isLoading = !mapReady || (talhoesLoading && talhoes.length === 0);

    return (
        <div className="flex flex-col md:flex-row h-[700px] w-full bg-slate-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <GlobalMapStyles />

            <div className="flex-1 relative z-10">
                {isLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/10 backdrop-blur-sm z-50">
                        <Loader2 size={48} className="animate-spin text-green-600 mb-4" />
                        <span className="text-slate-600 font-bold uppercase tracking-widest text-xs">Carregando Mapa...</span>
                    </div>
                ) : (
                    <MapContainer
                        center={activeCenter}
                        zoom={16}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                    >
                        <ZoomControl position="topleft" />
                        <TileLayer
                            attribution='Tiles &copy; Esri'
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                        />
                        <TileLayer
                            attribution='Stadia Maps'
                            url="https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png"
                            opacity={0.6}
                        />

                        <FeatureGroup ref={featureGroupRef} />

                        <DrawControl
                            featureGroupRef={featureGroupRef}
                            onCreated={handleCreated}
                        />

                        <TalhoesRenderer
                            talhoes={talhoes}
                            onTalhaoClick={handleSelectTalhao}
                            selectedTalhaoId={selectedTalhaoId}
                        />
                    </MapContainer>
                )}
            </div>

            {selectedTalhaoId && (
                <div className="w-full md:w-[350px] bg-white border-l border-slate-200 z-20 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-300">
                    <div className="flex-1 overflow-hidden">
                        <TalhaoDetails
                            talhao={talhoes.find(t => t.id === selectedTalhaoId)}
                            onBack={() => setSelectedTalhaoId(null)}
                        />
                    </div>

                    <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                        <button
                            onClick={() => handleDelete(selectedTalhaoId)}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-100 text-red-600 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
                        >
                            <Trash2 size={16} />
                            Excluir Talhão
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SatelliteView;
