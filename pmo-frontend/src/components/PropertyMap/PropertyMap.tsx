// src/components/PropertyMap/PropertyMap.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    Map as MapIcon,
    Plus,
    Sprout,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Droplets,
    Tractor,
    LayoutGrid,
    FlaskConical,
    Layers,
    TreePine,
    Trash2,
    MapPin,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

// Componentes Internos
import FarmMap from '../Map/FarmMap';
import TalhaoDetailsDrawer from './TalhaoDetailsDrawer';
import { locationService } from '../../services/locationService';
import { Talhao } from '../../domain/geo/geoTypes';

// --- Helpers ---
const formatArea = (m2: number): string => {
    if (!m2) return '0 m²';
    if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
    return `${Math.round(m2)} m²`;
};

const getStrIcon = (nome: string): React.ReactElement => {
    const lower = nome.toLowerCase();
    if (lower.includes('tanque') || lower.includes('água'))
        return <Droplets className="text-blue-500" size={16} />;
    if (lower.includes('linha') || lower.includes('saf'))
        return <TreePine className="text-amber-600" size={16} />;
    return <Sprout className="text-emerald-500" size={16} />;
};

const hasValidGeometry = (geometry?: string | any): boolean => {
    if (!geometry) return false;
    try {
        const geo = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
        return !!(geo && Array.isArray(geo.coordinates) && geo.coordinates.length > 0 && geo.coordinates[0]?.length > 0);
    } catch {
        return false;
    }
};

// --- Types ---
interface PropertyMapProps {
    propriedadeId?: number | null;
    nomePropriedade?: string;
}

// --- Component ---
const PropertyMap: React.FC<PropertyMapProps> = ({ propriedadeId, nomePropriedade }) => {
    const { user } = useAuth();

    // Data State
    const [talhoes, setTalhoes] = useState<Talhao[]>([]);
    const [selectedTalhao, setSelectedTalhao] = useState<Talhao | null>(null);
    const [loading, setLoading] = useState(true);

    // Panel Tab State
    const [panelTab, setPanelTab] = useState<'detalhes' | 'lista'>('detalhes');

    // Mobile Drawer State (lg:hidden)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Criar Talhão State
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [pendingTalhao, setPendingTalhao] = useState<{ layer: any; geometry: string; areaM2: number } | null>(null);
    const [newTalhaoData, setNewTalhaoData] = useState({ nome: '', cultura: '' });
    const [savingNew, setSavingNew] = useState(false);

    // Vincular Geometria a Talhão Existente (WhatsApp/Bot)
    const [drawingForTalhaoId, setDrawingForTalhaoId] = useState<number | null>(null);

    // Deletar Canteiro State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [canteiroToDelete, setCanteiroToDelete] = useState<string | null>(null);

    // Snackbar
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'alert' | 'error' }>({
        open: false, message: '', severity: 'success',
    });

    useEffect(() => {
        if (snackbar.open) {
            const timer = setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
            return () => clearTimeout(timer);
        }
    }, [snackbar.open]);

    // --- Data Loading ---
    const loadTalhoes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await locationService.getTalhoes();
            setTalhoes((data || []) as unknown as Talhao[]);
        } catch (error) {
            console.error("Erro ao buscar talhões", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTalhoes(); }, [loadTalhoes]);

    // --- Handlers ---
    const handleTalhaoClick = useCallback((talhao: Talhao) => {
        setSelectedTalhao(talhao);
        setPanelTab('detalhes');
        // On mobile, also open the drawer overlay
        setIsDrawerOpen(true);
    }, []);

    const handleCloseDrawer = useCallback(() => {
        setIsDrawerOpen(false);
    }, []);

    const handleDeleteCanteiro = useCallback(async (canteiroId: string) => {
        setCanteiroToDelete(String(canteiroId));
        setDeleteConfirmOpen(true);
    }, []);

    const confirmDeleteCanteiro = useCallback(async () => {
        if (!canteiroToDelete) return;
        try {
            await locationService.deleteCanteiro(canteiroToDelete);
            await loadTalhoes();
            if (selectedTalhao?.canteiros) {
                const updatedCanteiros = selectedTalhao.canteiros.filter(c => String(c.id) !== String(canteiroToDelete));
                setSelectedTalhao({ ...selectedTalhao, canteiros: updatedCanteiros });
            }
            setSnackbar({ open: true, message: 'Canteiro removido com sucesso!', severity: 'success' });
        } catch (error) {
            console.error("Erro ao deletar canteiro", error);
            setSnackbar({ open: true, message: 'Erro ao remover canteiro.', severity: 'error' });
        } finally {
            setDeleteConfirmOpen(false);
            setCanteiroToDelete(null);
        }
    }, [canteiroToDelete, selectedTalhao, loadTalhoes]);

    // --- Vincular Geometria a Talhão Existente ---
    const handleLinkGeometry = useCallback(async (
        talhaoId: number,
        data: { layer: any; geometry: string; areaM2: number }
    ) => {
        try {
            const geometryObj = JSON.parse(data.geometry);
            await locationService.updateTalhao(talhaoId, {
                geometry: geometryObj,
                area_total_m2: parseFloat(data.areaM2.toFixed(2)),
                area_ha: parseFloat((data.areaM2 / 10000).toFixed(2)),
            });
            if (data.layer?.remove) data.layer.remove();
            setDrawingForTalhaoId(null);
            await loadTalhoes();
            setSnackbar({ open: true, message: 'Geometria vinculada com sucesso!', severity: 'success' });
        } catch (error) {
            console.error('Erro ao vincular geometria:', error);
            setSnackbar({ open: true, message: 'Erro ao vincular geometria.', severity: 'error' });
        }
    }, [loadTalhoes]);

    // --- Criar Talhão Handlers ---
    const handleMapCreated = useCallback((data: { layer: any; geometry: string; areaM2: number }) => {
        if (drawingForTalhaoId) {
            // Fluxo de vinculação: UPDATE no talhão existente
            handleLinkGeometry(drawingForTalhaoId, data);
        } else {
            // Fluxo normal: criar novo talhão
            setPendingTalhao(data);
            setNewTalhaoData({ nome: `Talhão ${talhoes.length + 1}`, cultura: '' });
            setCreateModalOpen(true);
        }
    }, [talhoes.length, drawingForTalhaoId, handleLinkGeometry]);

    const handleCancelNewTalhao = useCallback(() => {
        if (pendingTalhao?.layer?.remove) pendingTalhao.layer.remove();
        setCreateModalOpen(false);
        setPendingTalhao(null);
    }, [pendingTalhao]);

    const handleSaveNewTalhao = useCallback(async () => {
        if (!pendingTalhao) return;
        if (!propriedadeId) {
            setSnackbar({ open: true, message: 'Erro: Propriedade não identificada.', severity: 'error' });
            return;
        }
        if (!user?.id) {
            setSnackbar({ open: true, message: 'Erro: Usuário não identificado.', severity: 'error' });
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
                cor: '#16a34a',
                propriedade_id: propriedadeId,
                user_id: user.id,
            };
            if (locationService.createTalhao) {
                await locationService.createTalhao(payload);
                await loadTalhoes();
            }
            if (pendingTalhao.layer?.remove) pendingTalhao.layer.remove();
            setCreateModalOpen(false);
            setPendingTalhao(null);
            setSnackbar({ open: true, message: 'Talhão salvo com sucesso!', severity: 'success' });
        } catch (error: any) {
            console.error("Erro ao salvar novo talhão", error);
            const msg = error.message?.includes('violates row-level security')
                ? 'Permissão negada (RLS).'
                : 'Erro ao salvar talhão.';
            setSnackbar({ open: true, message: msg, severity: 'error' });
        } finally {
            setSavingNew(false);
        }
    }, [pendingTalhao, propriedadeId, user?.id, newTalhaoData, loadTalhoes]);

    // --- RENDER ---
    return (
        <div className="flex h-full w-full overflow-hidden">

            {/* =========================================
                PAINEL ESQUERDO (Desktop Inline Sidebar)
                Oculto em mobile — o drawer cobre isso
                ========================================= */}
            <aside className="hidden lg:flex w-96 flex-shrink-0 bg-white border-r border-slate-100 shadow-xl z-10 flex-col overflow-hidden">

                {/* --- Header --- */}
                <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-lg flex-shrink-0">
                            <Tractor size={18} className="text-green-600" />
                        </div>
                        <div className="overflow-hidden">
                            <h1 className="text-sm font-semibold text-gray-800 leading-tight">Gestão Agrícola</h1>
                            {nomePropriedade && (
                                <p className="text-xs text-gray-400 truncate mt-0.5">{nomePropriedade}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- Tabs --- */}
                <div className="flex border-b border-slate-100 flex-shrink-0">
                    <button
                        onClick={() => setPanelTab('detalhes')}
                        className={cn(
                            "flex-1 py-3 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-2",
                            panelTab === 'detalhes'
                                ? "text-green-600 border-green-600"
                                : "text-gray-400 border-transparent hover:text-gray-500"
                        )}
                    >
                        <FlaskConical size={14} />
                        Detalhes do Talhão
                    </button>
                    <button
                        onClick={() => setPanelTab('lista')}
                        className={cn(
                            "flex-1 py-3 text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-2",
                            panelTab === 'lista'
                                ? "text-green-600 border-green-600"
                                : "text-gray-400 border-transparent hover:text-gray-500"
                        )}
                    >
                        <Layers size={14} />
                        Todos os Talhões
                    </button>
                </div>

                {/* --- Corpo do Painel (scroll) --- */}
                <div className="flex-1 overflow-y-auto">

                    {/* Tab: Detalhes */}
                    {panelTab === 'detalhes' && (
                        <div className="h-full">
                            {!selectedTalhao ? (
                                /* Estado Vazio */
                                <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                        <MapIcon size={28} className="text-slate-200" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-500">Nenhum talhão selecionado</p>
                                        <p className="text-xs text-slate-400 mt-1">Clique num polígono no mapa para ver os detalhes.</p>
                                    </div>
                                </div>
                            ) : (
                                /* Data Grid do Talhão */
                                <div className="animate-in fade-in duration-200">
                                    {/* Talhão Identity Header */}
                                    <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h2 className="text-base font-bold text-gray-900 leading-tight">{selectedTalhao.nome}</h2>
                                                <p className="text-xs text-gray-400 mt-0.5 capitalize">{selectedTalhao.tipo || 'produtivo'}</p>
                                            </div>
                                            <span className={cn(
                                                "px-2 py-0.5 text-[10px] font-bold rounded-md flex-shrink-0",
                                                selectedTalhao.tipo === 'agua'
                                                    ? "bg-blue-50 text-blue-600"
                                                    : "bg-green-50 text-green-700"
                                            )}>
                                                {formatArea(selectedTalhao.area_total_m2 || 0)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Key-Value Data Grid */}
                                    <div className="px-4 pt-2 pb-4">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest py-2">Informações Gerais</p>

                                        <div className="flex justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-sm text-gray-400">Cultura</span>
                                            <span className="text-sm font-medium text-gray-900">{selectedTalhao.cultura || '—'}</span>
                                        </div>
                                        <div className="flex justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-sm text-gray-400">Área</span>
                                            <span className="text-sm font-medium text-gray-900">{formatArea(selectedTalhao.area_total_m2 || 0)}</span>
                                        </div>
                                        <div className="flex justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-sm text-gray-400">Tipo</span>
                                            <span className="text-sm font-medium text-gray-900 capitalize">{selectedTalhao.tipo || '—'}</span>
                                        </div>

                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-4 pb-2">Análise de Solo</p>

                                        <div className="flex justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-sm text-gray-400">pH Solo</span>
                                            <span className="text-sm font-medium text-gray-900">{selectedTalhao.ph_solo ?? '—'}</span>
                                        </div>
                                        <div className="flex justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-sm text-gray-400">V%</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {selectedTalhao.v_percent != null ? `${selectedTalhao.v_percent}%` : '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-sm text-gray-400">M.O.</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {selectedTalhao.materia_organica != null ? `${selectedTalhao.materia_organica}%` : '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-2.5 border-b border-slate-50">
                                            <span className="text-sm text-gray-400">Argila</span>
                                            <span className="text-sm font-medium text-gray-900">
                                                {selectedTalhao.teor_argila != null ? `${selectedTalhao.teor_argila}%` : '—'}
                                            </span>
                                        </div>

                                        {/* Call to Action para Talhões sem Geometria */}
                                        {!hasValidGeometry(selectedTalhao.geometry) && (
                                            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg text-center">
                                                <p className="text-sm font-medium text-blue-800 mb-3">Este talhão ainda não possui área demarcada.</p>
                                                <button
                                                    onClick={() => {
                                                        setDrawingForTalhaoId(selectedTalhao.id);
                                                        setSnackbar({
                                                            open: true,
                                                            message: `Desenhe a geometria de "${selectedTalhao.nome}" no mapa agora.`,
                                                            severity: 'alert'
                                                        });
                                                    }}
                                                    className="w-full justify-center py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-sm transition-colors flex items-center gap-2"
                                                >
                                                    <MapPin size={16} />
                                                    Iniciar Desenho
                                                </button>
                                            </div>
                                        )}

                                        {/* Structures Section */}
                                        {selectedTalhao.canteiros && selectedTalhao.canteiros.length > 0 && (
                                            <>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pt-4 pb-2">
                                                    Estruturas ({selectedTalhao.canteiros.length})
                                                </p>
                                                <div className="space-y-1">
                                                    {selectedTalhao.canteiros.map((canteiro: any) => (
                                                        <div
                                                            key={canteiro.id}
                                                            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 group transition-colors"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100">
                                                                    {getStrIcon(canteiro.nome)}
                                                                </div>
                                                                <span className="text-sm font-medium text-gray-700">{canteiro.nome}</span>
                                                            </div>
                                                            <button
                                                                onClick={() => handleDeleteCanteiro(canteiro.id)}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                title="Excluir canteiro"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab: Todos os Talhões */}
                    {panelTab === 'lista' && (
                        <div className="animate-in fade-in duration-200">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="animate-spin text-green-600" size={28} />
                                </div>
                            ) : talhoes.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center px-6 gap-3">
                                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center">
                                        <LayoutGrid size={24} className="text-slate-200" />
                                    </div>
                                    <p className="text-sm text-slate-400 font-medium">Nenhum talhão cadastrado.</p>
                                    <p className="text-xs text-slate-300">Use a ferramenta de desenho no mapa para criar o primeiro.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {talhoes.map((talhao) => (
                                        <button
                                            key={talhao.id}
                                            onClick={() => {
                                                setSelectedTalhao(talhao);
                                                setPanelTab('detalhes');
                                            }}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left",
                                                selectedTalhao?.id === talhao.id && "bg-green-50/50"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-2.5 h-2.5 rounded-full flex-shrink-0",
                                                talhao.tipo === 'agua' ? "bg-blue-500" : !hasValidGeometry(talhao.geometry) ? "bg-amber-400" : "bg-emerald-500"
                                            )} />
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{talhao.nome}</p>
                                                <p className="text-xs text-gray-400">
                                                    {formatArea(talhao.area_total_m2 || 0)}
                                                    {talhao.cultura && ` · ${talhao.cultura}`}
                                                </p>
                                            </div>
                                            {!hasValidGeometry(talhao.geometry) ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDrawingForTalhaoId(talhao.id);
                                                        setSnackbar({
                                                            open: true,
                                                            message: `Desenhe a geometria de "${talhao.nome}" no mapa agora.`,
                                                            severity: 'alert'
                                                        });
                                                    }}
                                                    className="mt-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1 flex-shrink-0"
                                                >
                                                    <MapPin size={12} />
                                                    Desenhar no Mapa
                                                </button>
                                            ) : (
                                                <span className="text-xs text-gray-300 flex-shrink-0">
                                                    {talhao.canteiros?.length ?? 0} est.
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* --- Footer CTA --- */}
                <div className="p-4 border-t border-slate-100 flex-shrink-0 bg-white">
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-md shadow-sm transition-colors"
                    >
                        <Plus size={16} />
                        Adicionar Talhão
                    </button>
                </div>
            </aside>

            {/* =========================================
                PAINEL DIREITO — MAPA LEAFLET (flex-1)
                ========================================= */}
            <main className="flex-1 relative z-0 overflow-hidden">
                {/* Banner: Modo de vinculação ativo */}
                {drawingForTalhaoId && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="flex items-center gap-3 px-5 py-3 bg-amber-500 text-white rounded-2xl shadow-2xl shadow-amber-900/20 border border-amber-400/50">
                            <MapPin size={18} className="animate-pulse" />
                            <div>
                                <p className="text-xs font-black tracking-tight">
                                    Desenhando para: {talhoes.find(t => t.id === drawingForTalhaoId)?.nome || 'Talhão'}
                                </p>
                                <p className="text-[10px] text-amber-100">Desenhe um polígono ou retângulo no mapa.</p>
                            </div>
                            <button
                                onClick={() => setDrawingForTalhaoId(null)}
                                className="p-1.5 hover:bg-amber-600 rounded-lg transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
                <FarmMap
                    talhoes={talhoes}
                    focusTarget={selectedTalhao}
                    // @ts-ignore
                    onMapCreated={handleMapCreated}
                    onCreated={() => { }}
                    onEdited={() => { }}
                    onDeleted={() => { }}
                    onSaveTalhao={undefined}
                    onTalhaoClick={handleTalhaoClick}
                />
            </main>

            {/* =========================================
                DRAWER LATERAL — Mobile only (lg:hidden)
                ========================================= */}
            <div className="lg:hidden">
                <TalhaoDetailsDrawer
                    open={isDrawerOpen}
                    onClose={handleCloseDrawer}
                    talhao={selectedTalhao}
                    onDeleteCanteiro={handleDeleteCanteiro as any}
                    onUpdateStart={loadTalhoes}
                />
            </div>

            {/* =========================================
                MODAL: NOVO TALHÃO
                ========================================= */}
            <div className={cn(
                "fixed inset-0 z-[130] flex items-center justify-center p-4 transition-all duration-200",
                createModalOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
            )}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCancelNewTalhao} />
                <div className={cn(
                    "relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform",
                    createModalOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}>
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 text-green-600 rounded-xl">
                                <Plus size={20} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">
                                {pendingTalhao ? 'Novo Talhão Detectado' : 'Novo Talhão'}
                            </h3>
                        </div>
                        <button onClick={handleCancelNewTalhao} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-8 space-y-6">
                        {pendingTalhao && (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center">
                                <div className="text-center">
                                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Área Estimada</p>
                                    <p className="text-2xl font-black text-emerald-700">{formatArea(pendingTalhao.areaM2)}</p>
                                </div>
                            </div>
                        )}
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
                        </div>
                    </div>

                    <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex gap-3">
                        <button onClick={handleCancelNewTalhao} className="flex-1 py-3.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-2xl transition-all">
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

            {/* =========================================
                MODAL: CONFIRMAR EXCLUSÃO DE CANTEIRO
                ========================================= */}
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
                    <p className="text-sm text-slate-500 mb-8 font-medium">Esta ação não pode ser desfeita.</p>
                    <div className="w-full flex flex-col gap-2">
                        <button onClick={confirmDeleteCanteiro} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            Sim, Excluir
                        </button>
                        <button onClick={() => setDeleteConfirmOpen(false)} className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all">
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>

            {/* =========================================
                SNACKBAR
                ========================================= */}
            {snackbar.open && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300 px-4 w-full max-w-md">
                    <div className={cn(
                        "flex items-center gap-4 px-6 py-4 rounded-3xl shadow-2xl border backdrop-blur-md",
                        snackbar.severity === 'success'
                            ? "bg-emerald-600/90 text-white border-emerald-400/50"
                            : snackbar.severity === 'alert'
                                ? "bg-amber-500/90 text-white border-amber-400/50"
                                : "bg-red-600/90 text-white border-red-500/50"
                    )}>
                        {snackbar.severity === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-black tracking-tight">{snackbar.message}</p>
                        </div>
                        <button onClick={() => setSnackbar(prev => ({ ...prev, open: false }))} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PropertyMap;
