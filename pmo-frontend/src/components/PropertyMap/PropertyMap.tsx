// src/components/PropertyMap/PropertyMap.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
    LayoutGrid,
    Map as MapIcon,
    Edit2,
    Navigation,
    Plus,
    Sprout,
    X,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Droplets,
    TreePine,
    Maximize2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

// Componentes Internos
import FarmMap from '../Map/FarmMap';
import TalhaoDetailsDrawer from './TalhaoDetailsDrawer';
import { locationService } from '../../services/locationService';

// Tipagem simplificada para evitar erros
interface Talhao {
    id: number;
    nome: string;
    tipo: string;
    area_total_m2: number;
    area_ha?: number;
    cultura?: string;
    canteiros?: any[];
    [key: string]: any;
}

const formatArea = (m2: number) => {
    if (!m2) return '0 m²';
    if (m2 >= 10000) {
        return `${(m2 / 10000).toFixed(2)} ha`;
    }
    return `${Math.round(m2)} m²`;
};

interface PropertyMapProps {
    propriedadeId?: number | null;
}

const PropertyMap: React.FC<PropertyMapProps> = ({ propriedadeId }) => {
    const { user } = useAuth();

    // Estados
    const [viewMode, setViewMode] = useState<'croqui' | 'mapa'>('croqui');
    const [talhoes, setTalhoes] = useState<Talhao[]>([]);
    const [selectedTalhao, setSelectedTalhao] = useState<Talhao | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Estado para Novo Talhão
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [pendingTalhao, setPendingTalhao] = useState<{ layer: any, geometry: string, areaM2: number } | null>(null);
    const [newTalhaoData, setNewTalhaoData] = useState({ nome: '', cultura: '' });
    const [savingNew, setSavingNew] = useState(false);

    // Estado para Deleção
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [canteiroToDelete, setCanteiroToDelete] = useState<string | null>(null);

    // Snackbar State
    const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'alert' | 'error' }>({
        open: false,
        message: '',
        severity: 'success'
    });

    useEffect(() => {
        if (snackbar.open) {
            const timer = setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
            return () => clearTimeout(timer);
        }
    }, [snackbar.open]);

    // Carregar dados
    const loadTalhoes = useCallback(async () => {
        try {
            setLoading(true);
            const data = await locationService.getTalhoes();
            setTalhoes(data || []);
        } catch (error) {
            console.error("Erro ao buscar talhões", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTalhoes();
    }, [loadTalhoes]);

    // Handlers
    const handleOpenDrawer = (talhao: Talhao) => {
        setSelectedTalhao(talhao);
        setIsDrawerOpen(true);
    };

    const handleCloseDrawer = () => {
        setIsDrawerOpen(false);
        setSelectedTalhao(null);
    };

    const handleUpdateTalhao = async (id: string | number, data: any) => {
        try {
            await locationService.updateTalhao(String(id), data);
            await loadTalhoes();
            setSelectedTalhao(prev => prev ? { ...prev, ...data } : null);
        } catch (error) {
            console.error("Erro ao atualizar", error);
        }
    };

    const handleDeleteCanteiro = async (canteiroId: string | number) => {
        setCanteiroToDelete(String(canteiroId));
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteCanteiro = async () => {
        if (!canteiroToDelete) return;

        try {
            await locationService.deleteCanteiro(canteiroToDelete);
            await loadTalhoes();

            if (selectedTalhao && selectedTalhao.canteiros) {
                const updatedCanteiros = selectedTalhao.canteiros.filter(c => String(c.id) !== canteiroToDelete);
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
    };

    const handleViewOnMap = (talhao: Talhao) => {
        setSelectedTalhao(talhao);
        setViewMode('mapa');
    };

    // --- CRIAÇÃO DE TALHÃO ---
    const handleMapCreated = (data: { layer: any, geometry: string, areaM2: number }) => {
        setPendingTalhao(data);
        setNewTalhaoData({ nome: `Talhão ${talhoes.length + 1}`, cultura: '' });
        setCreateModalOpen(true);
    };

    const handleCancelNewTalhao = () => {
        if (pendingTalhao?.layer?.remove) {
            pendingTalhao.layer.remove();
        }
        setCreateModalOpen(false);
        setPendingTalhao(null);
    };

    const handleSaveNewTalhao = async () => {
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
                cor: '#16a34a', // Sucesso Green
                propriedade_id: propriedadeId,
                user_id: user.id
            };

            if (locationService.createTalhao) {
                await locationService.createTalhao(payload);
                await loadTalhoes();
            }

            if (pendingTalhao.layer?.remove) {
                pendingTalhao.layer.remove();
            }

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
    };

    return (
        <div className="p-4 md:p-6 pb-20 h-full flex flex-col bg-slate-50/50">
            {/* Header / Switcher */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Mapa da Propriedade</h2>
                    <p className="text-sm font-medium text-slate-500">Gestão espacial e infraestrutura produtiva.</p>
                </div>

                <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-200">
                    <button
                        onClick={() => setViewMode('croqui')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                            viewMode === 'croqui'
                                ? "bg-green-600 text-white shadow-lg shadow-green-900/10"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        <LayoutGrid size={16} />
                        Croqui
                    </button>
                    <button
                        onClick={() => setViewMode('mapa')}
                        className={cn(
                            "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                            viewMode === 'mapa'
                                ? "bg-green-600 text-white shadow-lg shadow-green-900/10"
                                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                        )}
                    >
                        <MapIcon size={16} />
                        Satélite
                    </button>
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="flex-1 relative">

                {/* MODO CROQUI (CARDS) */}
                {viewMode === 'croqui' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Botão de Adicionar */}
                        <button
                            onClick={() => setViewMode('mapa')}
                            className="group relative min-h-[220px] rounded-3xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-4 transition-all hover:border-green-500 hover:bg-green-50/30 overflow-hidden"
                        >
                            {/* Decorative background circle */}
                            <div className="absolute inset-0 bg-green-500/0 group-hover:bg-green-500/5 transition-colors opacity-0 group-hover:opacity-100" />

                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 group-hover:text-green-500 group-hover:bg-green-100 transition-all">
                                <Plus size={32} />
                            </div>
                            <div className="text-center z-10">
                                <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">Novo Talhão</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Desenhar no Mapa</p>
                            </div>
                        </button>

                        {/* Cards dos Talhões Existentes */}
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="min-h-[220px] rounded-3xl bg-slate-200 animate-pulse" />
                            ))
                        ) : (
                            talhoes.map((talhao) => (
                                <div
                                    key={talhao.id}
                                    className="group relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-slate-200 transition-all duration-300 flex flex-col overflow-hidden"
                                >
                                    {/* Top Indicator */}
                                    <div className={cn(
                                        "h-1.5 w-full",
                                        talhao.tipo === 'agua' ? "bg-blue-500" : "bg-emerald-500"
                                    )} />

                                    <div className="p-6 flex-1">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight">{talhao.nome}</h3>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{formatArea(talhao.area_total_m2)}</p>
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
                                            <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                {talhao.tipo === 'agua' ? <Droplets size={16} className="text-blue-500" /> : <Sprout size={16} className="text-emerald-500" />}
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
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                                        >
                                            <Navigation size={14} />
                                            No Mapa
                                        </button>
                                        <button
                                            onClick={() => handleOpenDrawer(talhao)}
                                            className="flex-[1.5] flex items-center justify-center gap-2 py-2.5 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-green-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <Edit2 size={14} />
                                            Gerenciar
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* MODO MAPA (SATÉLITE) */}
                {viewMode === 'mapa' && (
                    <div className="h-[75vh] w-full bg-slate-200 rounded-3xl overflow-hidden shadow-2xl border border-slate-200 relative animate-in zoom-in duration-500">
                        <FarmMap
                            talhoes={talhoes}
                            focusTarget={selectedTalhao}
                            // @ts-ignore
                            onMapCreated={handleMapCreated}
                            onCreated={() => { }}
                            onEdited={() => { }}
                            onDeleted={() => { }}
                            onSaveTalhao={undefined}
                            onTalhaoClick={handleOpenDrawer}
                        />
                    </div>
                )}
            </div>

            {/* DRAWER LATERAL (GERENCIADOR) */}
            <TalhaoDetailsDrawer
                open={isDrawerOpen}
                onClose={handleCloseDrawer}
                talhao={selectedTalhao}
                onDeleteCanteiro={handleDeleteCanteiro}
                onUpdateStart={loadTalhoes}
            />

            {/* MODAL: NOVO TALHÃO */}
            <div className={cn(
                "fixed inset-0 z-[130] flex items-center justify-center p-4 transition-all duration-200",
                createModalOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
            )}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleCancelNewTalhao} />
                <div className={cn(
                    "relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform",
                    createModalOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}>
                    {/* Header */}
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 text-green-600 rounded-xl">
                                <Plus size={20} />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Novo Talhão Detectado</h3>
                        </div>
                        <button onClick={handleCancelNewTalhao} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-6">
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center gap-4">
                            <div className="text-center">
                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Área Estimada</p>
                                <p className="text-2xl font-black text-emerald-700">{pendingTalhao ? formatArea(pendingTalhao.areaM2) : '0 m²'}</p>
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

            {/* CUSTOM SNACKBAR */}
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
