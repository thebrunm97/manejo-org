import React, { useState, useEffect, useRef } from 'react';
import { Box, Paper, Typography, IconButton, Button, Stack } from '@mui/material';
import { MapContainer, TileLayer, FeatureGroup, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';
import GrassIcon from '@mui/icons-material/Grass';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import LayersIcon from '@mui/icons-material/Layers';
import SquareFootIcon from '@mui/icons-material/SquareFoot'; // Ruler
import EditIcon from '@mui/icons-material/Edit'; // Pencil
import { useTalhaoManager } from '../../hooks/map/useTalhaoManager';
import { useAuth } from '../../context/AuthContext';
import TalhaoDetails from '../Map/TalhaoDetails';

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
            font-family: 'Roboto', sans-serif !important;
        }
        .map-label-transparent {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
        }
        .map-label-transparent::before {
            display: none !important;
        }
        .leaflet-top { top: 10px; }
        .leaflet-left { left: 10px; }
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
                        color: t.cor || '#39ff14',
                        weight: isSelected ? 6 : 4,
                        opacity: 1,
                        fillOpacity: isSelected ? 0.7 : 0.5,
                        fillColor: t.cor || '#39ff14',
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
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <span style="font-weight: 900; text-transform: uppercase; font-size: 14px; text-shadow: 0px 0px 4px rgba(0,0,0,1); color: white;">${t.nome}</span>
                                <span style="font-size: 12px; background: rgba(0,0,0,0.6); color: #fff; padding: 2px 6px; border-radius: 4px; margin-top: 2px;">
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
        // Convert Leaflet LatLng[] to Domain GeoPoint[]
        // Leaflet polygon getLatLngs() returns an array of rings. First ring is the outer boundary.
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
            // Success! The hook updates the state, and the TalhoesRenderer will draw it.
            // We remove the drawn layer because the renderer will add the "persisted" one.
            featureGroupRef.current.removeLayer(layer);
        }
    };

    const handleSelectTalhao = (id) => {
        setSelectedTalhaoId(id);
    };

    const handleDelete = async (id) => {
        if (!confirm("Deletar talhão?")) return;
        const success = await removeTalhao(id);
        if (success) {
            setSelectedTalhaoId(null);
        } else {
            alert("Erro ao excluir talhão.");
        }
    };

    // Loading priority: Map location first, then data
    const isLoading = !mapReady || (talhoesLoading && talhoes.length === 0);

    return (
        <Box sx={{ display: 'flex', height: '600px', flexDirection: { xs: 'column', md: 'row' } }}>
            <GlobalMapStyles />

            <Paper sx={{ flexGrow: 1, position: 'relative', zIndex: 1 }}>
                {!isLoading && (
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
            </Paper>

            {selectedTalhaoId && (
                <Paper sx={{ width: { xs: '100%', md: 300 }, borderLeft: '1px solid #ddd', zIndex: 2 }}>
                    <TalhaoDetails
                        talhao={talhoes.find(t => t.id === selectedTalhaoId)}
                        onBack={() => setSelectedTalhaoId(null)}
                    />
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteIcon fontSize="small" />}
                            onClick={() => handleDelete(selectedTalhaoId)}
                        >
                            Excluir Talhão
                        </Button>
                    </Box>
                </Paper>
            )}
        </Box>
    );
};

export default SatelliteView;
