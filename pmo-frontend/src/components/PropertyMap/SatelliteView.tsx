// src/components/PropertyMap/SatelliteView.tsx
import React, { useState, useMemo } from 'react';
import {
    Trash2,
} from 'lucide-react';
import Map, { Source, Layer, Marker } from 'react-map-gl/maplibre';
import { useTalhaoManager } from '../../hooks/map/useTalhaoManager';
import TalhaoDetails from '../Map/TalhaoDetails';
import { ESRI_SATELLITE_STYLE } from '../Map/mapStyles';

const getCropColor = (cultura?: string): string => {
    const n = cultura?.toLowerCase().trim() || '';
    if (n.includes('milho')) return '#FBBF24';
    if (n.includes('soja')) return '#F97316';
    if (n.includes('feijão') || n.includes('feijao')) return '#EC4899';
    if (n.includes('pastagem') || n.includes('pasto')) return '#10B981';
    if (n.includes('café') || n.includes('cafe')) return '#8B5CF6';
    return '#38BDF8';
};

interface SatelliteViewProps {
    pmoId: string;
}

const SatelliteView: React.FC<SatelliteViewProps> = ({ pmoId }) => {
    const {
        talhoes,
        removeTalhao
    } = useTalhaoManager(pmoId);

    const [selectedTalhaoId, setSelectedTalhaoId] = useState<number | null>(null);

    const geojsonData = useMemo(() => {
        return {
            type: 'FeatureCollection' as const,
            features: talhoes.map(t => ({
                type: 'Feature' as const,
                id: t.id,
                properties: {
                    id: t.id,
                    color: getCropColor(t.cultura)
                },
                geometry: typeof t.geometry === 'string' ? JSON.parse(t.geometry) : t.geometry
            })).filter(f => f.geometry)
        };
    }, [talhoes]);

    const handleDelete = async (id: number) => {
        if (!confirm("Deletar talhão? Isso excluirá permanentemente todos os dados associados.")) return;
        const success = await removeTalhao(String(id));
        if (success) {
            setSelectedTalhaoId(null);
        } else {
            alert("Erro ao excluir talhão.");
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-[700px] w-full bg-slate-100 rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="flex-1 relative z-10">
                <Map
                    initialViewState={{
                        longitude: -48.250880,
                        latitude: -18.900582,
                        zoom: 16
                    }}
                    style={{ width: '100%', height: '100%' }}
                    mapStyle={ESRI_SATELLITE_STYLE as any}
                    onClick={(e) => {
                        const feature = e.features?.[0];
                        if (feature) setSelectedTalhaoId(feature.properties.id);
                    }}
                    interactiveLayerIds={['talhoes-fill']}
                >
                    <Source id="talhoes-source" type="geojson" data={geojsonData}>
                        <Layer
                            id="talhoes-fill"
                            type="fill"
                            paint={{
                                'fill-color': ['get', 'color'],
                                'fill-opacity': 0.4
                            }}
                        />
                        <Layer
                            id="talhoes-line"
                            type="line"
                            paint={{
                                'line-color': ['get', 'color'],
                                'line-width': 3
                            }}
                        />
                    </Source>

                    {/* Simple Markers for labels if needed, omitting for brevity in this view unless critical */}
                </Map>
            </div>

            {selectedTalhaoId && (
                <div className="w-full md:w-[350px] bg-white border-l border-slate-200 z-20 flex flex-col shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] animate-in slide-in-from-right duration-300">
                    <div className="flex-1 overflow-hidden">
                        <TalhaoDetails
                            talhao={talhoes.find(t => String(t.id) === String(selectedTalhaoId)) as any || null}
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
