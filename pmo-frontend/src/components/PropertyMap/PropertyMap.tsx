// src/components/PropertyMap/PropertyMap.tsx

import React, { useState } from 'react';
import {
    LayoutGrid,
    Edit2,
    Navigation,
    Plus,
    Sprout,
    X,
    AlertCircle,
    Loader2,
    Droplets,
    Undo2,
    Check
} from 'lucide-react';
import area from '@turf/area';
import { toast } from 'react-toastify';
// Componentes Internos
import FarmMap from '../Map/FarmMap';
import { locationService } from '../../services/locationService';
import { Talhao } from '../../domain/geo/geoTypes';
import { podeCriarTalhao } from '../../utils/limitesCultivo';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

const formatArea = (m2: number) => {
    if (!m2) return '0 m²';
    if (m2 >= 10000) {
        return `${(m2 / 10000).toFixed(2)} ha`;
    }
    return `${Math.round(m2)} m²`;
};

interface PropertyMapProps {
    propriedadeId?: number | null;
    talhoes: Talhao[];
    viewMode: 'croqui' | 'mapa';
    setViewMode: (mode: 'croqui' | 'mapa') => void;
    selectedTalhao: Talhao | null;
    setSelectedTalhao: (talhao: Talhao | null) => void;
    onOpenDrawer: (talhao: Talhao) => void;
    onDeleteTalhao?: (id: string | number) => void;
    loadTalhoes: () => Promise<void>;
    loading?: boolean;
    isDrawerOpen?: boolean;
    pmoId?: string | number | null;
}

const PropertyMap: React.FC<PropertyMapProps> = ({ 
    propriedadeId,
    talhoes,
    viewMode,
    setViewMode,
    selectedTalhao,
    setSelectedTalhao,
    onOpenDrawer,
    onDeleteTalhao,
    loadTalhoes,
    loading = false,
    isDrawerOpen,
    pmoId
}) => {
    const { user, profile } = useAuth();

    // Estado para Novo Talhão
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [finishDrawingTrigger, setFinishDrawingTrigger] = useState(0);
    const [trashDrawingTrigger, setTrashDrawingTrigger] = useState(0);
    const [pendingTalhao, setPendingTalhao] = useState<{ layer: any, geometry: string, areaM2: number } | null>(null);
    const [newTalhaoData, setNewTalhaoData] = useState({ 
        nome: '', 
        cultura: '',
        fillColor: '#3bb444',
        borderColor: '#228b22'
    });
    const [savingNew, setSavingNew] = useState(false);

    // Estado para Deleção
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [canteiroToDelete, setCanteiroToDelete] = useState<string | null>(null);


    // Handlers
    const confirmDeleteCanteiro = async () => {
        if (!canteiroToDelete) return;

        try {
            await locationService.deleteCanteiro(canteiroToDelete);
            await loadTalhoes();

            if (selectedTalhao && selectedTalhao.canteiros) {
                const updatedCanteiros = selectedTalhao.canteiros.filter(c => String(c.id) !== String(canteiroToDelete));
                setSelectedTalhao({ ...selectedTalhao, canteiros: updatedCanteiros });
            }
            toast.success('Canteiro removido com sucesso!');
        } catch (error) {
            console.error("Erro ao deletar canteiro", error);
            toast.error('Erro ao remover canteiro.');
        } finally {
            setDeleteConfirmOpen(false);
            setCanteiroToDelete(null);
        }
    };

    const handleViewOnMap = (talhao: Talhao) => {
        setSelectedTalhao(talhao);
        setViewMode('mapa');
    };


    // --- CRIAÇÃO DE TALHÃO ---
    const handleStartDrawing = () => {
        const { can, message } = podeCriarTalhao(profile, talhoes.length);
        if (!can) {
            toast.warn(message || 'Limite de talhões atingido.');
            return;
        }
        setIsDrawingMode(true);
    };

    const handleDrawCreate = (e: any) => {
        const feature = e.features[0];
        if (!feature) return;

        // Calcula área usando turf (mapbox draw output is GeoJSON)
        const areaM2 = area(feature);

        setPendingTalhao({
            layer: null, // No longer used in MapLibre version
            geometry: JSON.stringify(feature.geometry),
            areaM2
        });
        setNewTalhaoData({ 
            nome: `Talhão ${talhoes.length + 1}`, 
            cultura: '',
            fillColor: '#3bb444',
            borderColor: '#228b22'
        });
        setIsDrawingMode(false);
        setCreateModalOpen(true);
    };

    const handleCancelNewTalhao = () => {
        setCreateModalOpen(false);
        setPendingTalhao(null);
        setIsDrawingMode(false);
    };

    const handleSaveNewTalhao = async () => {
        if (!pendingTalhao) return;

        if (!propriedadeId) {
            toast.error('Erro: Propriedade não identificada.');
            return;
        }

        if (!user?.id) {
            toast.error('Erro: Usuário não identificado.');
            return;
        }

        setSavingNew(true);
        try {
            const areaHa = pendingTalhao.areaM2 / 10000;
            const payload = {
                nome: newTalhaoData.nome,
                cultura: newTalhaoData.cultura,
                tipo: 'produtivo',
                geometry: pendingTalhao.geometry,
                area_total_m2: parseFloat(pendingTalhao.areaM2.toFixed(2)),
                area_ha: parseFloat(areaHa.toFixed(2)),
                fill_color: newTalhaoData.fillColor,
                border_color: newTalhaoData.borderColor,
                cor: newTalhaoData.fillColor, // Backward compatibility
                propriedade_id: propriedadeId,
                pmo_id: pmoId ? parseInt(String(pmoId)) : null,
                // user_id: user.id // SEC-01 Fix: Never send user_id from frontend. RLS/Trigger should handle it.
            };

            if (locationService.createTalhao) {
                await locationService.createTalhao(payload);
                await loadTalhoes();
            }

            setCreateModalOpen(false);
            setPendingTalhao(null);
            toast.success('Talhão salvo com sucesso!');

        } catch (error: any) {
            console.error("Erro ao salvar novo talhão", error);
            const msg = error.message?.includes('violates row-level security')
                ? 'Permissão negada (RLS).'
                : 'Erro ao salvar talhão.';
            toast.error(msg);
        } finally {
            setSavingNew(false);
        }
    };

    const handleDrawUpdate = async (e: any) => {
        const feature = e.features[0];
        if (!feature || !selectedTalhao) return;

        // Otimização: Evitar recálculos e re-renders excessivos se a geometria for idêntica (raro no update, mas preventivo)
        const newGeometry = feature.geometry;
        
        try {
            const newAreaM2 = area(feature);
            const areaHa = newAreaM2 / 10000;

            // 1. ATUALIZAÇÃO OTIMISTA (Feedback Instantâneo no Drawer)
            // Usamos um Check para evitar loops de estados se os valores forem os mesmos
            if (setSelectedTalhao) {
                setSelectedTalhao({
                    ...selectedTalhao,
                    geometry: newGeometry,
                    area_total_m2: parseFloat(newAreaM2.toFixed(2)),
                    area_ha: parseFloat(areaHa.toFixed(2))
                });
            }

            // 2. PERSISTÊNCIA NO BANCO
            // A chamada ao locationService já é assíncrona, não bloqueia o main thread, 
            // mas o excesso de chamadas pode ser ruim. Mapbox Draw 'draw.update' 
            // costuma disparar apenas no DROP do vértice ou fim da manipulação.
            await locationService.updateTalhao(Number(selectedTalhao.id), {
                geometry: newGeometry as any,
                area_total_m2: parseFloat(newAreaM2.toFixed(2)),
                area_ha: parseFloat(areaHa.toFixed(2))
            });

            // 3. SINCRONIA FINAL (Recarrega a lista global sem bloquear)
            loadTalhoes?.().catch(console.error);
            
            toast.success('Geometria e métricas atualizadas!');
        } catch (error) {
            console.error("Erro ao atualizar geometria:", error);
            toast.error('Falha ao salvar mudanças.');
        }
    };

    const handleDrawDelete = (e: any) => {
        const deletedFeatures = e.features;
        if (deletedFeatures && deletedFeatures.length > 0 && onDeleteTalhao) {
            // Pegamos o ID do primeiro talhão excluído via ferramenta de lixo do mapa
            const featureId = deletedFeatures[0].id;
            if (featureId) {
                onDeleteTalhao(featureId);
            }
        }
    };

    return (
        <div className="flex-1 relative w-full h-full bg-slate-100 overflow-hidden">
            {/* CONTEÚDO PRINCIPAL */}
            <div className="w-full h-full">

                {/* MODO CROQUI (grid com scroll) */}
                {viewMode === 'croqui' && (
                    <div className="h-full overflow-y-auto p-4 md:p-8 pt-28 pb-24">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Botão de Adicionar */}
                            <button
                                onClick={handleStartDrawing}
                                className="group relative min-h-[220px] rounded-3xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-4 transition-all hover:border-emerald-500 hover:bg-emerald-50/30 overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/5 transition-colors opacity-0 group-hover:opacity-100" />
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 group-hover:text-emerald-500 group-hover:bg-emerald-100 transition-all">
                                    <Plus size={32} />
                                </div>
                                <div className="text-center z-10">
                                    <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">Novo Talhão</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Desenhar no Mapa</p>
                                </div>
                            </button>

                            {/* Cards dos Talhões Existentes */}
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="min-h-[220px] rounded-3xl bg-slate-200/50 animate-pulse" />
                                ))
                            ) : (
                                talhoes.map((talhao) => (
                                    <div
                                        key={talhao.id}
                                        className="group relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-200 transition-all duration-300 flex flex-col overflow-hidden"
                                    >
                                        <div 
                                            className="h-1.5 w-full"
                                            style={{ backgroundColor: talhao.fill_color || talhao.fillColor || talhao.cor || (talhao.tipo === 'agua' ? '#3B82F6' : '#10B981') }}
                                        />

                                        <div className="p-6 flex-1">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{talhao.nome}</h3>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{formatArea(talhao.area_total_m2 || 0)}</p>
                                                </div>
                                                <div className={cn(
                                                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border",
                                                    talhao.tipo === 'agua'
                                                        ? "bg-blue-50 text-blue-600 border-blue-100"
                                                        : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                )}>
                                                    {talhao.tipo === 'agua' ? 'Recurso Hídrico' : 'Produtivo'}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 mb-4 group-hover:bg-white transition-colors">
                                                <div 
                                                    className="p-2 bg-white rounded-xl shadow-sm border border-slate-100"
                                                    style={{ color: talhao.fill_color || talhao.fillColor || talhao.cor || (talhao.tipo === 'agua' ? '#3B82F6' : '#10B981') }}
                                                >
                                                    {talhao.tipo === 'agua' ? <Droplets size={16} /> : <Sprout size={16} />}
                                                </div>
                                                <span className="text-sm font-bold text-slate-600 truncate">{talhao.cultura || "Sem cultura definida"}</span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <LayoutGrid size={12} />
                                                {talhao.canteiros?.length || 0} Estruturas
                                            </div>
                                        </div>

                                        <div className="p-4 pt-0 mt-auto flex gap-2">
                                            <button
                                                onClick={() => handleViewOnMap(talhao)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                                            >
                                                <Navigation size={14} />
                                                No Mapa
                                            </button>
                                            <button
                                                onClick={() => onOpenDrawer(talhao)}
                                                className="flex-[1.5] flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                <Edit2 size={14} />
                                                Gerenciar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* MODO MAPA (SATÉLITE) */}
                {viewMode === 'mapa' && (
                    <div className="h-full w-full relative animate-in zoom-in-95 duration-700">
                        {/* Wrapper Imersivo (Full Bleed) */}
                        <div className="absolute inset-0 overflow-hidden bg-slate-200">
                                <FarmMap
                                    talhoes={talhoes}
                                    focusTarget={selectedTalhao}
                                    selectedTalhaoId={selectedTalhao?.id}
                                    isDrawingMode={isDrawingMode}
                                    finishDrawingTrigger={finishDrawingTrigger}
                                    trashDrawingTrigger={trashDrawingTrigger}
                                    onDrawCreate={handleDrawCreate}
                                    onDrawUpdate={handleDrawUpdate}
                                    onDrawDelete={handleDrawDelete}
                                    onTalhaoClick={(t) => !isDrawingMode && viewMode === 'mapa' && onOpenDrawer(t)}
                                    isDrawerOpen={isDrawerOpen}
                                />
                        </div>

                        {/* --- MAP FLOATING INTERFACE (Pointer Events Container) --- */}
                        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                            {/* Minimalist FAB: Circular & Elegant */}
                            {!isDrawingMode && !createModalOpen && !selectedTalhao && (
                                <div className="absolute bottom-24 right-6">
                                    <button
                                        onClick={handleStartDrawing}
                                        className="w-14 h-14 bg-emerald-600 text-white rounded-full shadow-[0_8px_30px_rgb(16,185,129,0.3)] border border-emerald-400/40 flex items-center justify-center hover:bg-emerald-500 hover:scale-110 active:scale-90 transition-all outline-none pointer-events-auto"
                                        title="Novo Talhão"
                                    >
                                        <Plus size={28} strokeWidth={3} />
                                    </button>
                                </div>
                            )}


                            {/* UI MODO DESENHO (Barra de Controle Profissional & Minimalista) */}
                            {isDrawingMode && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center">
                                    {/* Toolbar Flutuante Inferior (Thumb Zone) */}
                                    <div className="mt-auto mb-10 px-6 animate-in slide-in-from-bottom-12 duration-700 ease-out pointer-events-auto">
                                        <div className="flex flex-col items-center gap-4">
                                            {/* Hint Card */}
                                            <div className="px-4 py-2 bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl animate-bounce">
                                                <p className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                                                    Toque no mapa para definir {talhoes.length === 0 ? 'os vértices' : 'a área'}
                                                </p>
                                            </div>

                                            {/* Action Toolbar */}
                                            <div className="p-2 bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-white/50 shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-2">
                                                <button
                                                    onClick={handleCancelNewTalhao}
                                                    className="w-12 h-12 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all active:scale-90"
                                                    title="Cancelar Desenho"
                                                >
                                                    <X size={20} strokeWidth={2.5} />
                                                </button>

                                                <button
                                                    onClick={() => setTrashDrawingTrigger(prev => prev + 1)}
                                                    className="w-12 h-12 flex items-center justify-center bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-full transition-all active:scale-95 border border-amber-200/50"
                                                    title="Desfazer Último Ponto"
                                                >
                                                    <Undo2 size={20} strokeWidth={2.5} />
                                                </button>

                                                <div className="w-[1px] h-8 bg-slate-200/50 mx-1" />

                                                <button
                                                    onClick={() => setFinishDrawingTrigger(prev => prev + 1)}
                                                    className="pl-4 pr-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/30 group"
                                                >
                                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform">
                                                        <Check size={18} strokeWidth={3} />
                                                    </div>
                                                    <span className="text-xs font-black uppercase tracking-widest pr-1">Finalizar</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: NOVO TALHÃO (Responsivo: Bottom sheet no mobile, Side panel no desktop) */}
            <div className={cn(
                "fixed inset-0 z-[130] flex md:items-stretch items-end md:justify-end justify-center p-0 transition-all duration-300 pointer-events-none",
                createModalOpen ? "opacity-100 visible" : "opacity-0 invisible"
            )}>
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] md:hidden pointer-events-auto" onClick={handleCancelNewTalhao} />
                <div className={cn(
                    "relative bg-white w-full md:w-96 md:h-full md:rounded-none rounded-t-[2.5rem] shadow-2xl overflow-hidden flex flex-col transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) transform pointer-events-auto",
                    createModalOpen ? "translate-x-0 translate-y-0" : "md:translate-x-full translate-y-full"
                )}>
                    {/* Header Slim */}
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-white">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                                <Plus size={20} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Novo Talhão</h3>
                        </div>
                        <button onClick={handleCancelNewTalhao} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                        <div className="p-4 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Área Estimada</p>
                                <p className="text-xl font-black text-emerald-700">{pendingTalhao ? formatArea(pendingTalhao.areaM2) : '0 m²'}</p>
                            </div>
                            <div className="px-3 py-1 bg-white rounded-lg border border-emerald-100 text-[10px] font-bold text-emerald-600 uppercase">
                                GeoJSON OK
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome do Talhão</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Ex: Talhão 01"
                                    value={newTalhaoData.nome}
                                    onChange={(e) => setNewTalhaoData({ ...newTalhaoData, nome: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all placeholder:text-slate-300"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cultura Atual (Opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Café"
                                    value={newTalhaoData.cultura}
                                    onChange={(e) => setNewTalhaoData({ ...newTalhaoData, cultura: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all placeholder:text-slate-300"
                                />
                            </div>

                            {/* Preview em Tempo Real (WYSIWYG) */}
                            <div className="space-y-1.5 pt-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Pré-visualização em Tempo Real</label>
                                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all">
                                    <div 
                                        className="w-full h-24 rounded-2xl border-4 shadow-lg transition-all duration-300 flex items-center justify-center relative overflow-hidden"
                                        style={{ 
                                            backgroundColor: newTalhaoData.fillColor, 
                                            borderColor: newTalhaoData.borderColor,
                                        }}
                                    >
                                        {/* Efeito de Vidro Interno */}
                                        <div className="absolute inset-0 bg-white/10 opacity-50" />
                                        <span className="relative z-10 text-[10px] font-black uppercase tracking-tighter text-white drop-shadow-md select-none bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">
                                            {newTalhaoData.nome || "Novo Talhão"}
                                        </span>
                                    </div>
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Aparência final no Mapa Satélite</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor do Talhão</label>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 hover:bg-white transition-colors cursor-pointer group">
                                        <input
                                            type="color"
                                            value={newTalhaoData.fillColor}
                                            onChange={(e) => setNewTalhaoData({ ...newTalhaoData, fillColor: e.target.value })}
                                            className="w-10 h-10 p-1 rounded-xl cursor-pointer bg-white border border-slate-200 hover:scale-110 transition-transform"
                                        />
                                        <span className="text-xs font-mono font-bold text-slate-500 uppercase group-hover:text-slate-900">{newTalhaoData.fillColor}</span>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cor do Limite</label>
                                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 hover:bg-white transition-colors cursor-pointer group">
                                        <input
                                            type="color"
                                            value={newTalhaoData.borderColor}
                                            onChange={(e) => setNewTalhaoData({ ...newTalhaoData, borderColor: e.target.value })}
                                            className="w-10 h-10 p-1 rounded-xl cursor-pointer bg-white border border-slate-200 hover:scale-110 transition-transform"
                                        />
                                        <span className="text-xs font-mono font-bold text-slate-500 uppercase group-hover:text-slate-900">{newTalhaoData.borderColor}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex gap-3">
                        <button
                            onClick={handleCancelNewTalhao}
                            className="flex-1 py-3.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-2xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveNewTalhao}
                            disabled={savingNew}
                            className="flex-[2] py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl shadow-xl shadow-green-900/10 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {savingNew && <Loader2 size={16} className="animate-spin" />}
                            {savingNew ? 'Salvando...' : 'Salvar Talhão'}
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL: CONFIRMAR EXCLUSÃO */}
            <div className={cn(
                "fixed inset-0 z-[130] flex items-center justify-center p-4 transition-all duration-200",
                deleteConfirmOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
            )}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)} />
                <div className={cn(
                    "relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center transition-all duration-300 transform",
                    deleteConfirmOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}>
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Excluir Canteiro?</h3>
                    <p className="text-sm text-slate-500 mb-8 font-medium">Tem certeza que deseja excluir esta estrutura? Esta ação não pode ser desfeita.</p>

                    <div className="w-full flex flex-col gap-2">
                        <button
                            onClick={confirmDeleteCanteiro}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            Sim, Excluir
                        </button>
                        <button
                            onClick={() => setDeleteConfirmOpen(false)}
                            className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>


        </div>
    );
};

export default PropertyMap;
