// src/pages/MapaPropriedade.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, LayoutGrid, Map as MapIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PropertyMap from '../components/PropertyMap/PropertyMap';
import TalhaoDetailsDrawer from '../components/PropertyMap/TalhaoDetailsDrawer';
import { locationService } from '../services/locationService';
import { Talhao } from '../domain/geo/geoTypes';
import { useIsMobile } from '../hooks/useIsMobile';
import { cn } from '../utils/cn';

const MapaPropriedade: React.FC = () => {
    const { currentPropriedade, profile } = useAuth();
    const [viewMode, setViewMode] = useState<'croqui' | 'mapa'>('croqui');
    const [talhoes, setTalhoes] = useState<Talhao[]>([]);
    const [selectedTalhao, setSelectedTalhao] = useState<Talhao | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const isMobile = useIsMobile();

    const loadTalhoes = useCallback(async () => {
        if (!currentPropriedade?.id) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const data = await locationService.getTalhoes(currentPropriedade.id);
            setTalhoes((data || []) as unknown as Talhao[]);
        } catch (error) {
            console.error("Erro ao buscar talhões", error);
        } finally {
            setLoading(false);
        }
    }, [currentPropriedade?.id]);

    useEffect(() => {
        loadTalhoes();
    }, [loadTalhoes]);

    // Sincroniza o SelectedTalhao com a lista atualizada para refletir mudanças (ex: edição de geometria)
    useEffect(() => {
        if (selectedTalhao && talhoes.length > 0) {
            const refreshed = talhoes.find(t => String(t.id) === String(selectedTalhao.id));
            if (refreshed) {
                // Só atualiza se houver mudança real para evitar loops
                if (JSON.stringify(refreshed.geometry) !== JSON.stringify(selectedTalhao.geometry)) {
                    setSelectedTalhao(refreshed);
                }
            }
        }
    }, [talhoes, selectedTalhao]);

    const handleOpenDrawer = (talhao: Talhao) => {
        setSelectedTalhao(talhao);
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedTalhao(null);
    };

    const handleDeleteTalhao = async (id: number | string) => {
        try {
            await locationService.deleteTalhao(id);
            setIsDrawerOpen(false);
            setSelectedTalhao(null);
            await loadTalhoes();
        } catch (error) {
            console.error("Erro ao deletar talhão:", error);
        }
    };

    const handleUpdateTalhao = async (id: string | number, data: any) => {
        try {
            await locationService.updateTalhao(Number(id), data);
            await loadTalhoes();
        } catch (error) {
            console.error("Erro ao atualizar talhão:", error);
            throw error;
        }
    };

    const handleDeleteCanteiro = async (id: string | number) => {
        try {
            await locationService.deleteCanteiro(id);
            await loadTalhoes();
        } catch (error) {
            console.error("Erro ao deletar canteiro:", error);
            throw error;
        }
    };

    const handleUpdateCanteiro = async (id: string | number, data: any) => {
        try {
            await locationService.updateCanteiro(id, data);
            await loadTalhoes();
        } catch (error) {
            console.error("Erro ao atualizar canteiro:", error);
            throw error;
        }
    };

    const handleCreateCanteiros = async (data: any[]) => {
        try {
            await locationService.createCanteirosBatch(data);
            await loadTalhoes();
        } catch (error) {
            console.error("Erro ao criar canteiros:", error);
            throw error;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[100vh]">
                <Loader2 className="animate-spin text-green-600 mb-2" size={40} />
                <span className="text-sm font-medium text-slate-500">Carregando mapa...</span>
            </div>
        );
    }

    if (!currentPropriedade) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center">
                <AlertTriangle className="text-red-500 mb-4" size={48} />
                <h6 className="text-xl font-bold text-red-600 mb-2">
                    Nenhuma Propriedade Ativa encontrada.
                </h6>
                <p className="text-slate-500">
                    Por favor, selecione uma propriedade no Hub.
                </p>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full overflow-hidden bg-slate-50">
            {/* TOGGLE CROQUI/SATÉLITE CENTRALIZADO (Hard Removal on Mobile for Immersive Map) */}
            {(!isMobile || viewMode !== 'mapa') && (
                <div className={cn(
                    "absolute md:top-6 top-auto bottom-8 left-1/2 -translate-x-1/2 z-[1000] w-max transition-all duration-300",
                    viewMode === 'mapa' ? "md:opacity-100 opacity-0 pointer-events-none md:pointer-events-auto" : "opacity-100"
                )}>
                    <div className="flex bg-white/95 backdrop-blur-md p-1.5 rounded-full shadow-2xl border border-white/20 ring-1 ring-black/5 select-none">
                        <button
                            onClick={() => setViewMode('croqui')}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === 'croqui'
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/20"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                            )}
                        >
                            <LayoutGrid size={14} />
                            Croqui
                        </button>
                        <button
                            onClick={() => setViewMode('mapa')}
                            className={cn(
                                "flex items-center gap-2 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                                viewMode === 'mapa'
                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/20"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
                            )}
                        >
                            <MapIcon size={14} />
                            Satélite
                        </button>
                    </div>
                </div>
            )}

            {/* JAULA DO MAPA (FULL-BLEED) */}
            <div className="absolute inset-0 overflow-hidden z-0 bg-white">
                <PropertyMap 
                    propriedadeId={currentPropriedade?.id} 
                    talhoes={talhoes}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    selectedTalhao={selectedTalhao}
                    setSelectedTalhao={setSelectedTalhao}
                    onOpenDrawer={handleOpenDrawer}
                    onDeleteTalhao={handleDeleteTalhao}
                    loadTalhoes={loadTalhoes}
                    loading={loading}
                    isDrawerOpen={isDrawerOpen}
                    pmoId={profile?.pmo_ativo_id}
                />
            </div>

            {/* DRAWER FLUTUANTE SOLTO (Renderizado apenas se houver talhão para evitar pílula fantasma) */}
            {viewMode === 'mapa' && selectedTalhao && (
                <TalhaoDetailsDrawer
                    open={isDrawerOpen}
                    onClose={handleCloseDrawer}
                    talhao={selectedTalhao}
                    onDeleteCanteiro={handleDeleteCanteiro}
                    onUpdateCanteiro={handleUpdateCanteiro}
                    onCreateCanteiros={handleCreateCanteiros}
                    onDeleteTalhao={handleDeleteTalhao}
                    onUpdateTalhao={handleUpdateTalhao}
                />
            )}
        </div>
    );
};

export default MapaPropriedade;
