// src/components/PropertyMap/PropertyMap.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus,
    Sprout,
    X,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Droplets,
    Tractor,
    LayoutGrid,
    TreePine,
    Trash2,
    MapPin,
    PenTool,
    ArrowLeft,
    Hexagon,
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

    // Manipular Geometria Canteiro
    const [drawingForCanteiroTalhaoId, setDrawingForCanteiroTalhaoId] = useState<number | null>(null);
    
    // Modal de Canteiro
    const [canteiroModalOpen, setCanteiroModalOpen] = useState(false);
    const [editingCanteiroData, setEditingCanteiroData] = useState<any>(null);
    const [canteiroFormData, setCanteiroFormData] = useState({ nome: '' });
    const [pendingCanteiroGeometry, setPendingCanteiroGeometry] = useState<any>(null);

    // Deletar Canteiro State
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [canteiroToDelete, setCanteiroToDelete] = useState<string | null>(null);

    // Deletar Talhão State
    const [deleteTalhaoConfirmOpen, setDeleteTalhaoConfirmOpen] = useState(false);
    const [talhaoToDelete, setTalhaoToDelete] = useState<number | null>(null);

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

    const handleDeleteTalhao = useCallback((talhaoId: number) => {
        setTalhaoToDelete(talhaoId);
        setDeleteTalhaoConfirmOpen(true);
    }, []);

    const confirmDeleteTalhao = useCallback(async () => {
        if (!talhaoToDelete) return;
        try {
            await locationService.deleteTalhao(talhaoToDelete);
            await loadTalhoes();
            if (selectedTalhao?.id === talhaoToDelete) {
                setSelectedTalhao(null);
                setPanelTab('lista');
            }
            setSnackbar({ open: true, message: 'Talhão removido com sucesso!', severity: 'success' });
        } catch (error) {
            console.error("Erro ao deletar talhão", error);
            setSnackbar({ open: true, message: 'Erro ao remover talhão.', severity: 'error' });
        } finally {
            setDeleteTalhaoConfirmOpen(false);
            setTalhaoToDelete(null);
        }
    }, [talhaoToDelete, selectedTalhao, loadTalhoes]);

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

    // --- Criar Talhão / Canteiro Handlers ---
    const handleMapCreated = useCallback((data: { layer: any; geometry: string; areaM2: number }) => {
        if (drawingForCanteiroTalhaoId) {
            // Fluxo Canteiro Novo - Após desenhar, abre o Modal para preencher metadados
            setPendingCanteiroGeometry(data);
            const canteiroCount = talhoes.find(t => t.id === drawingForCanteiroTalhaoId)?.canteiros?.length || 0;
            setCanteiroFormData({ nome: `Estrutura ${canteiroCount + 1}` });
            setEditingCanteiroData(null); // null indica que é criação
            setCanteiroModalOpen(true);
        } else if (drawingForTalhaoId) {
            // Fluxo de vinculação: UPDATE no talhão existente
            handleLinkGeometry(drawingForTalhaoId, data);
        } else {
            // Fluxo normal: criar novo talhão
            setPendingTalhao(data);
            setNewTalhaoData({ nome: `Talhão ${talhoes.length + 1}`, cultura: '' });
            setCreateModalOpen(true);
        }
    }, [talhoes, drawingForTalhaoId, drawingForCanteiroTalhaoId, handleLinkGeometry]);

    // --- Canteiro Helpers ---
    const handleAddCanteiroInit = useCallback(() => {
        if (!selectedTalhao) return;
        setDrawingForCanteiroTalhaoId(selectedTalhao.id);
        setSnackbar({ open: true, message: `Desenhe a estrutura para o talhão ${selectedTalhao.nome}`, severity: 'alert' });
    }, [selectedTalhao]);

    const handleEditCanteiroStart = useCallback((canteiro: any) => {
        setEditingCanteiroData(canteiro);
        setCanteiroFormData({ nome: canteiro.nome || '' });
        setCanteiroModalOpen(true);
    }, []);

    const handleSaveCanteiroMetadata = async () => {
        if (!canteiroFormData.nome.trim()) return;
        setSavingNew(true);
        try {
            if (editingCanteiroData) {
                // UPDATE
                await locationService.updateCanteiro(editingCanteiroData.id, { nome: canteiroFormData.nome.trim() });
                setSnackbar({ open: true, message: 'Estrutura atualizada com sucesso!', severity: 'success' });
            } else if (pendingCanteiroGeometry && drawingForCanteiroTalhaoId) {
                // INSERT
                await locationService.createCanteiro(drawingForCanteiroTalhaoId, canteiroFormData.nome.trim(), {
                    geometry: JSON.parse(pendingCanteiroGeometry.geometry)
                });
                if (pendingCanteiroGeometry.layer?.remove) pendingCanteiroGeometry.layer.remove();
                setDrawingForCanteiroTalhaoId(null);
                setPendingCanteiroGeometry(null);
                setSnackbar({ open: true, message: 'Estrutura criada com sucesso!', severity: 'success' });
            }
            
            await loadTalhoes();
            
            // Recarrega tbm o selectedTalhao
            if (selectedTalhao) {
               const updated = await locationService.getTalhoes();
               const novoSelecionado = updated.find(t => t.id === selectedTalhao.id);
               if (novoSelecionado) setSelectedTalhao(novoSelecionado as Talhao);
            }
            
            setCanteiroModalOpen(false);
        } catch (error) {
            console.error('Erro ao salvar estrutura:', error);
            setSnackbar({ open: true, message: 'Erro ao salvar estrutura.', severity: 'error' });
        } finally {
            setSavingNew(false);
        }
    };

    const handleCancelCanteiroModal = useCallback(() => {
        if (!editingCanteiroData && pendingCanteiroGeometry?.layer?.remove) {
            pendingCanteiroGeometry.layer.remove();
        }
        setCanteiroModalOpen(false);
        setPendingCanteiroGeometry(null);
        if (!editingCanteiroData) setDrawingForCanteiroTalhaoId(null);
    }, [editingCanteiroData, pendingCanteiroGeometry]);

    const handleMapEdited = useCallback(async (data: { layer: any; geometry: string }) => {
        // Nenhuma ação para geometria de canteiros ainda. Apenas metadados.
    }, []);

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
        <div className="relative h-full w-full overflow-hidden">
            {/* =========================================
                PAINEL DIREITO — MAPA LEAFLET (100% Full Screen)
                ========================================= */}
            <main className="absolute inset-0 z-0">
                {/* Banner: Modo de vinculação ativo ou Canteiro Edition */}
                {(drawingForTalhaoId || drawingForCanteiroTalhaoId) && !canteiroModalOpen && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-2 fade-in duration-300">
                        <div className="flex items-center gap-3 px-5 py-3 bg-amber-500 text-white rounded-2xl shadow-2xl shadow-amber-900/20 border border-amber-400/50">
                            <MapPin size={18} className="animate-pulse shrink-0" />
                            <div>
                                <p className="text-xs font-black tracking-tight">
                                    {drawingForCanteiroTalhaoId ? `Desenhando Canteiro para: ${selectedTalhao?.nome}` : `Desenhando para: ${talhoes.find(t => t.id === drawingForTalhaoId)?.nome || 'Talhão'}`}
                                </p>
                                <p className="text-[10px] text-amber-100">
                                    Desenhe um polígono no mapa.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setDrawingForTalhaoId(null);
                                    if (drawingForCanteiroTalhaoId) {
                                        setDrawingForCanteiroTalhaoId(null);
                                        setPendingCanteiroGeometry(null);
                                    }
                                }}
                                className="p-1.5 hover:bg-amber-600 rounded-lg transition-colors shrink-0"
                                title="Cancelar"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}
                <FarmMap
                    talhoes={talhoes}
                    focusTarget={selectedTalhao}
                    editingCanteiroId={null} // geometria isolada de canteiro desativada pra editar
                    // @ts-ignore
                    onMapCreated={handleMapCreated}
                    onCreated={() => { }}
                    onEdited={handleMapEdited}
                    onDeleted={() => { }}
                    onSaveTalhao={undefined}
                    onTalhaoClick={handleTalhaoClick}
                />
            </main>

            {/* =========================================
                PAINEL FLUTUANTE ESQUERDO (Floating over Map)
                Oculto em mobile — o drawer cobre isso
                ========================================= */}
            <aside className="hidden lg:flex absolute top-4 left-4 z-[1000] w-[380px] max-h-[calc(100vh-2rem)] flex-col bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl shadow-slate-900/10 border border-slate-100/50 overflow-hidden">

                {/* --- Header Fixo do Painel --- */}
                <div className="px-5 py-4 border-b border-slate-100/50 flex-shrink-0 bg-white/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-50 rounded-xl flex-shrink-0">
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

                {/* --- Corpo do Painel (Scroll Interno) --- */}
                <div className="flex-1 overflow-y-auto">

                    {/* View: Lista de Todos os Talhões */}
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
                                <div className="p-4 flex flex-col gap-3">
                                    {talhoes.map((talhao) => (
                                        <div
                                            key={talhao.id}
                                            onClick={() => {
                                                setSelectedTalhao(talhao);
                                                setPanelTab('detalhes');
                                            }}
                                            className={cn(
                                                "p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md hover:border-slate-300 cursor-pointer transition-all flex flex-col gap-3 relative group",
                                                selectedTalhao?.id === talhao.id && "ring-2 ring-indigo-500 border-indigo-500 shadow-md"
                                            )}
                                        >
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-2">
                                                    <MapPin size={16} className={talhao.tipo === 'agua' ? "text-blue-500" : "text-emerald-500"} />
                                                    <span className="text-sm font-semibold text-gray-800 truncate">{talhao.nome}</span>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTalhao(talhao.id);
                                                    }}
                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                                                    title="Excluir talhão"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                                    {formatArea(talhao.area_total_m2 || 0)}
                                                </span>
                                                {talhao.cultura && (
                                                    <span className="text-xs text-slate-500">· {talhao.cultura}</span>
                                                )}
                                                {hasValidGeometry(talhao.geometry) && (
                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-200 ml-auto">
                                                        {talhao.canteiros?.length ?? 0} est.
                                                    </span>
                                                )}
                                            </div>

                                            {!hasValidGeometry(talhao.geometry) && (
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
                                                    className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold rounded-lg transition-colors mt-1"
                                                >
                                                    <PenTool size={14} />
                                                    Desenhar no Mapa
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* View: Detalhes do Talhão (Drill-down) */}
                    {panelTab === 'detalhes' && selectedTalhao && (
                        <div className="animate-in slide-in-from-right-4 fade-in duration-300">
                            {/* Navegação e Título do Talhão */}
                            <div className="p-5 border-b border-slate-100 bg-white sticky top-0 z-10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setPanelTab('lista')}
                                        className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors shrink-0"
                                    >
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="overflow-hidden">
                                        <h2 className="text-xl font-bold text-slate-900 leading-tight truncate max-w-[200px]">{selectedTalhao.nome}</h2>
                                        <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1.5 capitalize font-medium">
                                            {selectedTalhao.tipo === 'agua' ? '🔵' : '🟢'} {selectedTalhao.tipo || 'produtivo'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteTalhao(selectedTalhao.id)}
                                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                                    title="Excluir talhão"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                {/* Engagement Status Bar */}
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                    <div 
                                        className={cn(
                                            "h-full rounded-full",
                                            selectedTalhao.tipo === 'agua' ? "bg-blue-500 w-full" : 
                                            !hasValidGeometry(selectedTalhao.geometry) ? "bg-amber-400 w-1/3" : "bg-emerald-500 w-[85%]"
                                        )}
                                    />
                                    {hasValidGeometry(selectedTalhao.geometry) && selectedTalhao.tipo !== 'agua' && (
                                        <div className="h-full bg-emerald-200 w-[15%] rounded-r-full" />
                                    )}
                                </div>

                                {/* KPI Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Área Total</p>
                                        <p className="text-2xl font-black text-slate-800">{formatArea(selectedTalhao.area_total_m2 || 0)}</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cultura</p>
                                        <p className="text-xl font-bold text-slate-800 truncate" title={selectedTalhao.cultura || 'Não definida'}>
                                            {selectedTalhao.cultura || '—'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">pH do Solo</p>
                                        <p className="text-xl font-bold text-slate-800">{selectedTalhao.ph_solo ?? '—'}</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Teor Argila</p>
                                        <p className="text-xl font-bold text-slate-800">
                                            {selectedTalhao.teor_argila != null ? `${selectedTalhao.teor_argila}%` : '—'}
                                        </p>
                                    </div>
                                </div>

                                {/* Call to Action para Talhões sem Geometria */}
                                {!hasValidGeometry(selectedTalhao.geometry) && (
                                    <div className="mt-2 p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-center">
                                        <div className="w-10 h-10 mx-auto bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-3">
                                            <MapPin size={18} />
                                        </div>
                                        <p className="text-sm font-medium text-indigo-900 mb-3">Ainda não possui área desenhada no mapa.</p>
                                        <button
                                            onClick={() => {
                                                setDrawingForTalhaoId(selectedTalhao.id);
                                                setSnackbar({
                                                    open: true,
                                                    message: `Desenhe a geometria de "${selectedTalhao.nome}" no mapa agora.`,
                                                    severity: 'alert'
                                                });
                                            }}
                                            className="w-full justify-center py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-2"
                                        >
                                            <PenTool size={16} />
                                            Desenhar Polígono
                                        </button>
                                    </div>
                                )}

                                {/* Secção de Estruturas (Lista Contida) */}
                                <div className="pt-2">
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                            Estruturas ({selectedTalhao.canteiros?.length || 0})
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        {selectedTalhao.canteiros?.map((canteiro: any) => (
                                            <div
                                                key={canteiro.id}
                                                className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-sm group transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-500 group-hover:shadow-sm transition-all border border-transparent group-hover:border-slate-100 shrink-0">
                                                        <Hexagon size={16} />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{canteiro.nome}</span>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                    <button
                                                        onClick={() => handleEditCanteiroStart(canteiro)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                                                        title="Editar Dados da Estrutura"
                                                    >
                                                        <PenTool size={16} /> 
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCanteiro(canteiro.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all shrink-0"
                                                        title="Excluir Canteiro"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {(!selectedTalhao.canteiros || selectedTalhao.canteiros.length === 0) && (
                                            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                                                <p className="text-xs text-slate-400 font-medium">Não há estruturas cadastradas.</p>
                                            </div>
                                        )}

                                        <button
                                            onClick={handleAddCanteiroInit}
                                            className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-slate-50 hover:bg-slate-100 text-indigo-600 hover:text-indigo-700 text-sm font-semibold rounded-xl border border-dashed border-slate-200 hover:border-indigo-200 transition-colors"
                                        >
                                            <Plus size={16} />
                                            Adicionar Canteiro
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* --- Footer CTA Absoluto/Fixo do Painel --- */}
                {panelTab === 'lista' && (
                    <div className="p-4 border-t border-slate-100/50 bg-white/80 backdrop-blur-md flex-shrink-0 z-10">
                        <button
                            onClick={() => setCreateModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-black text-white text-sm font-semibold rounded-2xl shadow-xl shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <Plus size={16} />
                            Adicionar Talhão
                        </button>
                    </div>
                )}
            </aside>

            {/* Modal: Adicionar/Editar Canteiro (Metadados) */}
            {canteiroModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Hexagon size={20} className="text-indigo-500" />
                                {editingCanteiroData ? 'Editar Estrutura' : 'Nova Estrutura'}
                            </h3>
                            <button
                                onClick={handleCancelCanteiroModal}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6">
                            <label className="block text-sm font-bold text-slate-700 mb-2">
                                Nome / Identificação
                            </label>
                            <input
                                type="text"
                                value={canteiroFormData.nome}
                                onChange={(e) => setCanteiroFormData({ ...canteiroFormData, nome: e.target.value })}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 font-medium transition-shadow placeholder:text-slate-300"
                                placeholder="Ex: Canteiro 01"
                                autoFocus
                            />
                            <p className="mt-2 text-xs text-slate-400 font-medium">Você poderá editar o tamanho/geometria pelo painel principal posteriormente.</p>
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                            <button
                                onClick={handleCancelCanteiroModal}
                                disabled={savingNew}
                                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveCanteiroMetadata}
                                disabled={savingNew || !canteiroFormData.nome.trim()}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {savingNew ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                Salvar Estrutura
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                MODAL: CONFIRMAR EXCLUSÃO DE TALHÃO
                ========================================= */}
            <div className={cn(
                "fixed inset-0 z-[130] flex items-center justify-center p-4 transition-all duration-200",
                deleteTalhaoConfirmOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
            )}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteTalhaoConfirmOpen(false)} />
                <div className={cn(
                    "relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col items-center text-center transition-all duration-300 transform",
                    deleteTalhaoConfirmOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}>
                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle size={40} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight mb-2">Excluir Talhão?</h3>
                    <p className="text-sm text-slate-500 mb-8 font-medium">Esta ação removerá o talhão e estrutura/registros vinculados. Não pode ser desfeita.</p>
                    <div className="w-full flex flex-col gap-2">
                        <button onClick={confirmDeleteTalhao} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-red-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            Sim, Excluir Talhão
                        </button>
                        <button onClick={() => setDeleteTalhaoConfirmOpen(false)} className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 transition-all">
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
