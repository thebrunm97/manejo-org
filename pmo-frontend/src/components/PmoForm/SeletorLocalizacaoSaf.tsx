// src/components/PmoForm/SeletorLocalizacaoSaf.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useState, useEffect, useMemo } from 'react';
import {
    Sprout, TreePine, Plus, Search, MapPin, X, ArrowLeft,
    Droplets, Loader2, Ruler
} from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { locationService } from '../../services/locationService';

// Types
interface Talhao {
    id: number | string;
    nome: string;
    [key: string]: any;
}

interface Canteiro {
    id: number | string;
    nome: string;
    tipo?: string;
    area_total_m2?: number;
    largura?: number;
    comprimento?: number;
    _displayName?: string;
    [key: string]: any;
}

interface SelectionValue {
    talhao_id?: number | string | null;
    talhao_nome?: string;
    canteiro_id?: number | string;
    canteiro_nome?: string;
    area_m2?: number;
    _display?: string;
}

interface FormLocalData {
    nome: string;
    tipo: string;
    largura: string;
    comprimento: string;
    linhas: string;
}

interface SeletorLocalizacaoSafProps {
    value?: SelectionValue | string | null;
    onChange: (value: SelectionValue) => void;
    multiple?: boolean;
    error?: boolean;
    helperText?: string;
}

type ViewMode = 'list' | 'create';
type FilterType = 'todos' | 'canteiro' | 'entrelinha' | 'tanque';

const SeletorLocalizacaoSaf: React.FC<SeletorLocalizacaoSafProps> = ({
    value,
    onChange,
    multiple = false,
    error = false,
    helperText = ''
}) => {
    const isMobile = useIsMobile();

    // States
    const [talhoes, setTalhoes] = useState<Talhao[]>([]);
    const [canteiros, setCanteiros] = useState<Canteiro[]>([]);
    const [modalSelectorOpen, setModalSelectorOpen] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');

    const displayValue = useMemo(() => {
        if (!value) return '';
        if (typeof value === 'object') {
            return `${value.talhao_nome || ''} > ${value.canteiro_nome || ''}`;
        }
        return value;
    }, [value]);

    const [selectedTalhaoId, setSelectedTalhaoId] = useState<number | string | null>(null);
    const [loadingTalhoes, setLoadingTalhoes] = useState(false);
    const [loadingCanteiros, setLoadingCanteiros] = useState(false);
    const [busca, setBusca] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('todos');

    const [formLocal, setFormLocal] = useState<FormLocalData>({
        nome: '', tipo: 'canteiro', largura: '', comprimento: '', linhas: ''
    });
    const [saving, setSaving] = useState(false);

    // Load Talhões
    useEffect(() => {
        const loadTalhoes = async () => {
            setLoadingTalhoes(true);
            try {
                const data = await locationService.getTalhoes();
                setTalhoes(data);
                if (data.length > 0) setSelectedTalhaoId(data[0].id);
            } catch (err) {
                console.error("Failed to load Talhoes", err);
            } finally {
                setLoadingTalhoes(false);
            }
        };
        loadTalhoes();
    }, []);

    // Load Canteiros
    useEffect(() => {
        if (!selectedTalhaoId) { setCanteiros([]); return; }
        const loadCanteiros = async () => {
            setLoadingCanteiros(true);
            try {
                const data = await locationService.getCanteirosByTalhao(selectedTalhaoId);
                setCanteiros(data);
            } catch (err) {
                console.error("Failed to load Canteiros", err);
            } finally {
                setLoadingCanteiros(false);
            }
        };
        loadCanteiros();
    }, [selectedTalhaoId]);

    // Filtered Canteiros
    const canteirosFiltrados = useMemo(() => {
        if (!canteiros) return [];
        let lista = [...canteiros];
        if (busca) lista = lista.filter(l => l.nome && l.nome.toLowerCase().includes(busca.toLowerCase()));
        if (filterType !== 'todos') lista = lista.filter(l => (l.tipo || '').toLowerCase() === filterType.toLowerCase());
        lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', undefined, { numeric: true, sensitivity: 'base' }));

        const nameCounts: Record<string, number> = {};
        lista.forEach(item => { nameCounts[item.nome] = (nameCounts[item.nome] || 0) + 1; });
        return lista.map(item => ({
            ...item,
            _displayName: nameCounts[item.nome] > 1 ? `${item.nome} (#${String(item.id).slice(-4)})` : item.nome
        }));
    }, [canteiros, busca, filterType]);

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const typesFound = [...new Set(canteirosFiltrados.map(l => l.tipo))];
            console.log('[SeletorLocalizacaoSaf] Types found in filtered list:', typesFound);
        }
    }, [canteirosFiltrados]);

    // Handlers
    const handleSelect = (canteiro: Canteiro) => {
        const talhao = talhoes.find(t => t.id === selectedTalhaoId);
        const selectionObject: SelectionValue = {
            talhao_id: selectedTalhaoId,
            talhao_nome: talhao ? talhao.nome : 'Unknown',
            canteiro_id: canteiro.id,
            canteiro_nome: canteiro.nome,
            area_m2: canteiro.area_total_m2 || 0,
            _display: `${talhao ? talhao.nome : ''} > ${canteiro.nome}`
        };
        onChange(selectionObject);
        setModalSelectorOpen(false);
    };

    const handleOpenCreateMode = () => {
        if (!selectedTalhaoId) { alert("Selecione um Talhão primeiro."); return; }
        setFormLocal({ nome: '', tipo: 'canteiro', largura: '', comprimento: '', linhas: '' });
        setViewMode('create');
    };

    const handleCloseModal = () => {
        setModalSelectorOpen(false);
        setViewMode('list');
    };

    const handleCreateLocal = async () => {
        if (!formLocal.nome || !selectedTalhaoId) return;
        setSaving(true);
        try {
            const larg = parseFloat(formLocal.largura) || 0;
            const comp = parseFloat(formLocal.comprimento) || 0;
            const areaCalc = larg * comp;
            const metadata = {
                tipo: formLocal.tipo, largura: larg, comprimento: comp,
                linhas: formLocal.linhas, area: areaCalc > 0 ? areaCalc.toFixed(2) : null
            };
            const novoCanteiro = await locationService.createCanteiro(selectedTalhaoId, formLocal.nome, metadata);
            setCanteiros(prev => [novoCanteiro, ...prev]);
            handleSelect(novoCanteiro);
            setViewMode('list');
        } catch (err) {
            console.error(err);
            alert("Erro ao criar local. Verifique o console.");
        } finally {
            setSaving(false);
        }
    };

    // Render helpers
    const getIcon = (tipo?: string) => {
        const t = (tipo || '').toLowerCase();
        switch (t) {
            case 'canteiro': return <Sprout size={20} />;
            case 'entrelinha': return <TreePine size={20} />;
            case 'tanque': return <Droplets size={20} />;
            default: return <MapPin size={20} />;
        }
    };

    const getColors = (tipo?: string) => {
        const t = (tipo || '').toLowerCase();
        switch (t) {
            case 'canteiro': return { bg: 'bg-green-100', text: 'text-green-600' };
            case 'entrelinha': return { bg: 'bg-amber-100', text: 'text-amber-600' };
            case 'tanque': return { bg: 'bg-blue-100', text: 'text-blue-600' };
            default: return { bg: 'bg-gray-100', text: 'text-gray-500' };
        }
    };

    const previewArea = ((parseFloat(formLocal.largura) || 0) * (parseFloat(formLocal.comprimento) || 0)).toFixed(1);
    const selectedTalhaoName = talhoes.find(t => t.id === selectedTalhaoId)?.nome;
    const valueObj = typeof value === 'object' ? value : null;

    const inputCls = "w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500";

    return (
        <>
            {/* Trigger Input */}
            <div className="relative">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <MapPin size={18} className={displayValue ? 'text-green-600' : 'text-gray-400'} />
                </div>
                <input
                    type="text"
                    readOnly
                    value={displayValue}
                    placeholder="Toque para selecionar..."
                    onClick={() => setModalSelectorOpen(true)}
                    className={`w-full pl-9 pr-3 py-2 text-sm border rounded-md cursor-pointer bg-white caret-transparent ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                        }`}
                />
                {helperText && (
                    <p className={`text-xs mt-0.5 ${error ? 'text-red-500' : 'text-gray-500'}`}>{helperText}</p>
                )}
            </div>

            {/* Selector Modal */}
            {modalSelectorOpen && (
                <div
                    className={
                        isMobile
                            ? 'fixed inset-0 bg-white z-[100] flex flex-col'
                            : 'fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4'
                    }
                    onClick={isMobile ? undefined : handleCloseModal}
                >
                    <div
                        className={
                            isMobile
                                ? 'flex flex-col h-full'
                                : 'bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col'
                        }
                        style={!isMobile ? { height: '80vh' } : undefined}
                        onClick={isMobile ? undefined : (e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                {viewMode === 'create' && (
                                    <button type="button" onClick={() => setViewMode('list')} className="p-1 text-gray-500 hover:text-gray-700 rounded">
                                        <ArrowLeft size={20} />
                                    </button>
                                )}
                                <h2 className="text-lg font-bold text-gray-800">
                                    {viewMode === 'list' ? 'Selecionar Local' : `Novo Local em ${selectedTalhaoName}`}
                                </h2>
                                {loadingTalhoes && viewMode === 'list' && <Loader2 size={18} className="animate-spin text-green-600" />}
                            </div>
                            <button type="button" onClick={handleCloseModal} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {viewMode === 'list' ? (
                                <>
                                    {/* Filters */}
                                    <div className="p-3 bg-gray-50 border-b border-gray-200 space-y-2.5">
                                        <p className="text-xs font-bold text-gray-500 uppercase">Talhão / Área</p>
                                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                                            {talhoes.map(talhao => (
                                                <button
                                                    type="button"
                                                    key={talhao.id}
                                                    onClick={() => setSelectedTalhaoId(talhao.id)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${selectedTalhaoId === talhao.id
                                                        ? 'bg-green-600 text-white border-green-600'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                                                        }`}
                                                >
                                                    {talhao.nome}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex gap-1.5">
                                            {(['todos', 'canteiro', 'entrelinha', 'tanque'] as FilterType[]).map((t) => (
                                                <button
                                                    type="button"
                                                    key={t}
                                                    onClick={() => setFilterType(t)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${filterType === t
                                                        ? 'bg-purple-600 text-white border-purple-600'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:border-purple-400'
                                                        }`}
                                                >
                                                    {t === 'todos' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Search */}
                                        <div className="relative">
                                            <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Buscar canteiro, linha ou espaço..."
                                                value={busca}
                                                onChange={(e) => setBusca(e.target.value)}
                                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                            />
                                        </div>
                                    </div>

                                    {/* List */}
                                    <div className="flex-1 overflow-y-auto px-2">
                                        {loadingCanteiros ? (
                                            <div className="flex justify-center py-8"><Loader2 size={28} className="animate-spin text-green-600" /></div>
                                        ) : canteirosFiltrados.length === 0 ? (
                                            <div className="py-10 text-center">
                                                <p className="text-lg font-semibold text-gray-400 mb-3">Nenhum local encontrado</p>
                                                <button
                                                    type="button"
                                                    onClick={handleOpenCreateMode}
                                                    className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-50"
                                                >
                                                    <Plus size={16} /> Criar Local Agora
                                                </button>
                                            </div>
                                        ) : (
                                            canteirosFiltrados.map((local) => {
                                                const colors = getColors(local.tipo);
                                                const isSelected = valueObj?.canteiro_id === local.id;

                                                return (
                                                    <button
                                                        type="button"
                                                        key={local.id}
                                                        onClick={() => handleSelect(local)}
                                                        className={`w-full flex items-center gap-3 p-3 text-left rounded-lg mb-1 transition-colors border ${isSelected
                                                            ? 'bg-green-50 border-green-500 ring-1 ring-green-200'
                                                            : 'border-transparent hover:bg-gray-50'
                                                            }`}
                                                    >
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bg} ${colors.text}`}>
                                                            {getIcon(local.tipo)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-sm font-bold text-gray-800 truncate">
                                                                    {local._displayName || local.nome}
                                                                </span>
                                                                {local.area_total_m2 && (
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-gray-300 text-gray-500 flex-shrink-0">
                                                                        {local.area_total_m2} m²
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-gray-500">
                                                                {local.largura && local.comprimento
                                                                    ? `${local.largura}m x ${local.comprimento}m`
                                                                    : local.tipo?.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* Create Mode */
                                <div className="flex-1 overflow-y-auto p-4">
                                    <div className="space-y-4">
                                        {/* Tipo */}
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tipo de Local</p>
                                            <div className="flex gap-3">
                                                {[
                                                    { value: 'canteiro', label: 'Canteiro', color: 'text-green-600' },
                                                    { value: 'entrelinha', label: 'Entrelinha SAF', color: 'text-amber-600' },
                                                    { value: 'tanque', label: 'Tanque', color: 'text-blue-600' }
                                                ].map(opt => (
                                                    <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
                                                        <input
                                                            type="radio" name="tipo-local" value={opt.value}
                                                            checked={formLocal.tipo === opt.value}
                                                            onChange={(e) => setFormLocal({ ...formLocal, tipo: e.target.value })}
                                                            className={`w-4 h-4 ${opt.color} focus:ring-green-500`}
                                                        />
                                                        <span className="text-sm">{opt.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Nome */}
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 mb-1 block">Nome (Ex: Canteiro 05, Linha de Limão)</label>
                                            <input
                                                type="text" autoFocus
                                                value={formLocal.nome}
                                                onChange={(e) => setFormLocal({ ...formLocal, nome: e.target.value })}
                                                placeholder="Digite o nome..."
                                                className={inputCls}
                                            />
                                        </div>

                                        {/* Dimensions */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">Largura (m)</label>
                                                <input type="number" value={formLocal.largura}
                                                    onChange={(e) => setFormLocal({ ...formLocal, largura: e.target.value })}
                                                    className={inputCls} />
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-gray-600 mb-1 block">Comprimento (m)</label>
                                                <input type="number" value={formLocal.comprimento}
                                                    onChange={(e) => setFormLocal({ ...formLocal, comprimento: e.target.value })}
                                                    className={inputCls} />
                                            </div>
                                        </div>

                                        {/* Area Preview */}
                                        {formLocal.largura && formLocal.comprimento && (
                                            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                                                <Ruler size={18} className="text-blue-600 flex-shrink-0" />
                                                Área Calculada: <strong>{previewArea} m²</strong>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between p-3 border-t border-gray-200 bg-gray-50">
                            {viewMode === 'list' ? (
                                <>
                                    <button type="button" onClick={handleCloseModal} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Fechar</button>
                                    <button type="button" onClick={handleOpenCreateMode} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg">
                                        <Plus size={16} /> Criar Novo Local
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => setViewMode('list')} disabled={saving} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancelar</button>
                                    <button
                                        type="button"
                                        onClick={handleCreateLocal}
                                        disabled={!formLocal.nome || saving}
                                        className="px-5 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? 'Salvando...' : 'Salvar Local'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SeletorLocalizacaoSaf;
