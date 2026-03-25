// src/components/PropertyMap/TalhaoDetailsDrawer.tsx

import React, { useState, useEffect, useMemo } from 'react';
import L from 'leaflet';
import {
    X,
    Sprout,
    Trash2,
    Plus,
    FlaskConical,
    Droplets,
    TreePine,
    Info,
    LayoutGrid,
    Pencil,
    Loader2,
    Save,
    Edit2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import { locationService } from '../../services/locationService';
import { cn } from '../../utils/cn';

// --- Helper: Soil Classification ---
const getSoilClassification = (clay: number, sand: number) => {
    if (!clay && !sand) return "Indefinido";
    const c = parseFloat(String(clay));
    const s = parseFloat(String(sand));

    if (c >= 60) return "Muito Argiloso";
    if (c >= 35) return "Argiloso";
    if (s >= 70 && c < 15) return "Arenoso";
    if (c >= 20 && c < 35 && s < 45) return "Franco-Argiloso";
    if (c < 35 && s > 45) return "Franco-Arenoso";
    return "Franco (Médio)";
};

// Interface Props
interface TalhaoDetailsDrawerProps {
    open: boolean;
    onClose: () => void;
    talhao: any;
    onDeleteCanteiro: (id: string | number) => void;
    onAddCanteiro?: () => void;
    onUpdateStart?: () => void;
}

const TalhaoDetailsDrawer: React.FC<TalhaoDetailsDrawerProps> = ({
    open,
    onClose,
    talhao,
    onDeleteCanteiro,
    onUpdateStart
}) => {
    const [tabIndex, setTabIndex] = useState(0);

    // --- Feedback State ---
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });

    useEffect(() => {
        if (snackbar.open) {
            const timer = setTimeout(() => setSnackbar(prev => ({ ...prev, open: false })), 4000);
            return () => clearTimeout(timer);
        }
    }, [snackbar.open]);

    // --- State for Create Modal ---
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [batchData, setBatchData] = useState({
        type: 'canteiro', // canteiro, linha, tanque
        baseName: '',
        width: '',
        length: '',
        depth: '',
        volume: '',
        isManualVolume: false,
        isBatch: false,
        quantity: 1,
        startNumber: 1
    });

    // Helper to open modal
    const handleOpenCreateModal = () => {
        setBatchData({
            type: 'canteiro',
            baseName: '',
            width: '',
            length: '',
            depth: '',
            volume: '',
            isManualVolume: false,
            isBatch: false,
            quantity: 1,
            startNumber: 1
        });
        setCreateModalOpen(true);
    };

    // Reactive Calculations for Area and Volume
    useEffect(() => {
        const w = parseFloat(batchData.width.replace(',', '.')) || 0;
        const l = parseFloat(batchData.length.replace(',', '.')) || 0;
        const d = parseFloat(batchData.depth.replace(',', '.')) || 0;
        
        if (batchData.type === 'tanque' && !batchData.isManualVolume && w > 0 && l > 0 && d > 0) {
            const calculatedVolume = w * l * d;
            setBatchData(prev => ({ ...prev, volume: calculatedVolume.toFixed(2).replace('.', ',') }));
        }
    }, [batchData.width, batchData.length, batchData.depth, batchData.type, batchData.isManualVolume]);

    const handleBatchSave = async () => {
        if (!talhao) return;
        try {
            const payloads: any[] = [];
            const w = parseFloat(batchData.width.replace(',', '.')) || 0;
            const l = parseFloat(batchData.length.replace(',', '.')) || 0;
            const d = parseFloat(batchData.depth.replace(',', '.')) || 0;
            const v = parseFloat(batchData.volume.replace(',', '.')) || 0;
            const q = batchData.isBatch ? 1 : (batchData.quantity || 1);
            const area = (w > 0 && l > 0) ? (w * l * q) : null;

            const count = batchData.isBatch ? (Math.max(1, batchData.quantity)) : 1;
            const start = batchData.isBatch ? (Math.max(1, batchData.startNumber)) : 1;

            for (let i = 0; i < count; i++) {
                const num = start + i;
                let finalName = batchData.baseName;
                if (!finalName) finalName = batchData.type === 'linha' ? 'Linha' : (batchData.type === 'tanque' ? 'Tanque' : 'Canteiro');

                if (batchData.isBatch) {
                    finalName = `${finalName} ${num}`;
                }

                payloads.push({
                    talhao_id: String(talhao.id),
                    nome: finalName,
                    tipo_estrutura: batchData.type,
                    largura_metros: w || null,
                    comprimento_metros: l || null,
                    profundidade_metros: batchData.type === 'tanque' ? d : null,
                    volume_m3: batchData.type === 'tanque' ? v : null,
                    quantidade: q,
                    area_total_m2: area,
                    status: 'ativo'
                });
            }

            if (locationService.createCanteirosBatch) {
                await locationService.createCanteirosBatch(payloads);
                if (onUpdateStart) onUpdateStart();
                setCreateModalOpen(false);
                setSnackbar({ open: true, message: `${count} estruturas criadas com sucesso!`, severity: 'success' });
            }
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: "Erro ao criar estruturas.", severity: 'error' });
        }
    };

    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false); // Refere-se à Saúde do Solo
    const [unitMode, setUnitMode] = useState<'percent' | 'g_kg'>('percent');

    // Estados para edição do cabeçalho (Talhão)
    const [isEditingTalhao, setIsEditingTalhao] = useState(false);
    const [talhaoEditData, setTalhaoEditData] = useState({ nome: '', cultura: '' });

    // Estados para edição de Canteiros/Estruturas individuais
    const [editingCanteiroId, setEditingCanteiroId] = useState<string | number | null>(null);
    const [canteiroEditData, setCanteiroEditData] = useState({ nome: '', largura: '', comprimento: '' });

    // Form Data para métricas de solo
    const [formData, setFormData] = useState({
        ph_solo: '', materia_organica: '', v_percent: '',
        fosforo: '', potassio: '',
        teor_argila: '', silte: '', areia: ''
    });

    // Hooks de cálculo movidos para o topo para respeitar as Rules of Hooks
    const calculatedAreaM2 = useMemo(() => {
        if (!talhao || !talhao.geometry) return 0;
        try {
            const geo = typeof talhao.geometry === 'string' ? JSON.parse(talhao.geometry) : talhao.geometry;
            if (geo.coordinates && geo.coordinates[0]) {
                const coords: L.LatLngTuple[] = geo.coordinates[0].map((c: any) => [c[1], c[0]] as L.LatLngTuple);
                return (L as any).GeometryUtil?.geodesicArea(coords) || 0;
            }
        } catch (e) {
            console.error("Error calculating area fallback:", e);
        }
        return 0;
    }, [talhao]);

    const perimetroKm = useMemo(() => {
        if (!talhao || !talhao.geometry) return null;
        try {
            const geo = typeof talhao.geometry === 'string' ? JSON.parse(talhao.geometry) : talhao.geometry;
            if (geo.coordinates && geo.coordinates[0]) {
                const coords: L.LatLngTuple[] = geo.coordinates[0].map((c: any) => [c[1], c[0]] as L.LatLngTuple);
                let dist = 0;
                for (let i = 0; i < coords.length - 1; i++) {
                    dist += L.latLng(coords[i]).distanceTo(L.latLng(coords[i+1]));
                }
                return dist;
            }
        } catch (e) {
            console.error("Error calculating perimeter:", e);
        }
        return null;
    }, [talhao]);

    // Load Initial Data for Editing
    useEffect(() => {
        if (talhao) {
            setFormData({
                ph_solo: talhao.ph_solo || '',
                materia_organica: talhao.materia_organica || '',
                v_percent: talhao.v_percent || '',
                fosforo: talhao.fosforo || '',
                potassio: talhao.potassio || '',
                teor_argila: talhao.teor_argila || '',
                silte: talhao.silte || '',
                areia: talhao.areia || ''
            });
            setTalhaoEditData({
                nome: talhao.nome || '',
                cultura: talhao.cultura || ''
            });
        }
    }, [talhao, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let newFormData = { ...formData, [name]: value };

        if (['teor_argila', 'silte', 'areia'].includes(name)) {
            const totalTarget = unitMode === 'percent' ? 100 : 1000;
            const getVal = (k: string) => {
                const raw = newFormData[k as keyof typeof newFormData];
                if (raw === '' || raw === undefined) return NaN;
                return parseFloat(String(raw).replace(',', '.')) || 0;
            };

            const argila = getVal('teor_argila');
            const silte = getVal('silte');
            const areia = getVal('areia');
            const isVal = (n: number) => !isNaN(n);

            if (name === 'teor_argila') {
                if (isVal(silte)) newFormData.areia = Math.max(0, totalTarget - argila - silte).toString().replace('.', ',');
                else if (isVal(areia)) newFormData.silte = Math.max(0, totalTarget - argila - areia).toString().replace('.', ',');
            } else if (name === 'silte') {
                if (isVal(argila)) newFormData.areia = Math.max(0, totalTarget - argila - silte).toString().replace('.', ',');
                else if (isVal(areia)) newFormData.teor_argila = Math.max(0, totalTarget - silte - areia).toString().replace('.', ',');
            } else if (name === 'areia') {
                if (isVal(argila)) newFormData.silte = Math.max(0, totalTarget - argila - areia).toString().replace('.', ',');
                else if (isVal(silte)) newFormData.teor_argila = Math.max(0, totalTarget - silte - areia).toString().replace('.', ',');
            }
        }
        setFormData(newFormData);
    };

    const handleSave = async () => {
        if (!talhao) return;
        setSaving(true);
        try {
            const parseNum = (val: any) => {
                if (!val && val !== 0) return null;
                return parseFloat(String(val).replace(',', '.'));
            };

            const payload = {
                ph_solo: parseNum(formData.ph_solo),
                v_percent: parseNum(formData.v_percent),
                materia_organica: parseNum(formData.materia_organica),
                fosforo: parseNum(formData.fosforo),
                potassio: parseNum(formData.potassio),
                teor_argila: parseNum(formData.teor_argila),
                silte: parseNum(formData.silte),
                areia: parseNum(formData.areia)
            };

            await locationService.updateTalhao(talhao.id, payload);
            setIsEditing(false);
            if (onUpdateStart) onUpdateStart();
            setSnackbar({ open: true, message: "Dados salvos com sucesso!", severity: 'success' });
        } catch (error: any) {
            console.error(error);
            setSnackbar({ open: true, message: `Erro ao salvar: ${error.message || "Erro desconhecido"}`, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTalhaoHeader = async () => {
        if (!talhao) return;
        setSaving(true);
        try {
            await locationService.updateTalhao(talhao.id, {
                nome: talhaoEditData.nome,
                cultura: talhaoEditData.cultura
            });
            setIsEditingTalhao(false);
            if (onUpdateStart) onUpdateStart();
            setSnackbar({ open: true, message: "Informações do talhão atualizadas!", severity: 'success' });
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: "Erro ao atualizar talhão.", severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleStartEditCanteiro = (canteiro: any) => {
        setEditingCanteiroId(canteiro.id);
        setCanteiroEditData({
            nome: canteiro.nome || '',
            largura: String(canteiro.largura_metros || ''),
            comprimento: String(canteiro.comprimento_metros || '')
        });
    };

    const handleSaveCanteiroEdit = async () => {
        if (!editingCanteiroId) return;
        setSaving(true);
        try {
            await locationService.updateCanteiro(editingCanteiroId, {
                nome: canteiroEditData.nome,
                largura_metros: parseFloat(canteiroEditData.largura.replace(',', '.')) || null,
                comprimento_metros: parseFloat(canteiroEditData.comprimento.replace(',', '.')) || null
            });
            setEditingCanteiroId(null);
            if (onUpdateStart) onUpdateStart();
            setSnackbar({ open: true, message: "Estrutura atualizada com sucesso!", severity: 'success' });
        } catch (e) {
            console.error(e);
            setSnackbar({ open: true, message: "Erro ao atualizar estrutura.", severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    if (!talhao) return null;

    // --- CÁLCULOS VISUAIS ---
    const argilaVal = parseFloat(String(formData.teor_argila).replace(',', '.')) || 0;
    const silteVal = parseFloat(String(formData.silte).replace(',', '.')) || 0;
    const areiaVal = parseFloat(String(formData.areia).replace(',', '.')) || 0;
    const argilaPct = unitMode === 'g_kg' ? argilaVal / 10 : argilaVal;
    const siltePct = unitMode === 'g_kg' ? silteVal / 10 : silteVal;
    const areiaPct = unitMode === 'g_kg' ? areiaVal / 10 : areiaVal;
    const classificacao = getSoilClassification(argilaPct, areiaPct);
    const total = argilaVal + silteVal + areiaVal;
    const baseEsperada = unitMode === 'percent' ? 100 : 1000;
    const isTotalCorrect = Math.abs(total - baseEsperada) < 0.5;

    const areaM2 = talhao.area_m2 || talhao.area_total_m2 || talhao.area_ha * 10000 || calculatedAreaM2 || 0;
    const areaHa = areaM2 / 10000;
    const areaFormatada = areaHa.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

    const getIcon = (nome?: string) => {
        const lower = (nome || '').toLowerCase();
        if (lower.includes('tanque') || lower.includes('água')) return <Droplets className="text-blue-500" size={18} />;
        if (lower.includes('linha') || lower.includes('saf')) return <TreePine className="text-amber-600" size={18} />;
        return <Sprout className="text-emerald-500" size={18} />;
    };

    return (
        <>
            {/* Drawer Panel (Floating Card) - SPEC 01 */}
            <div className={cn(
                "absolute top-6 left-6 bottom-6 z-[1000] w-80 md:w-[26rem] bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden transition-all duration-300 transform",
                open ? "translate-y-0 opacity-100 scale-100 pointer-events-auto" : "translate-y-4 opacity-0 scale-95 pointer-events-none"
            )}>
                {/* Header */}
                <div className="flex items-start gap-4 p-6 shrink-0 bg-white border-b border-slate-50">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                    {getIcon(talhao.nome)}
                </div>
                <div className="flex-1 overflow-hidden min-w-0">
                    {isEditingTalhao ? (
                        <div className="space-y-1">
                            <input
                                autoFocus
                                value={talhaoEditData.nome}
                                onChange={(e) => setTalhaoEditData(prev => ({ ...prev, nome: e.target.value }))}
                                className="w-full text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 focus:border-emerald-500 outline-none"
                                placeholder="Nome do talhão"
                            />
                            <input
                                value={talhaoEditData.cultura}
                                onChange={(e) => setTalhaoEditData(prev => ({ ...prev, cultura: e.target.value }))}
                                className="w-full text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2 py-0.5 focus:border-emerald-500 outline-none"
                                placeholder="Cultura (ex: Feijão)"
                            />
                        </div>
                    ) : (
                        <>
                            <h3 className="text-base font-bold text-slate-900 truncate leading-tight">{talhao.nome || 'Talhão Sem Nome'}</h3>
                            <p className="text-[11px] text-slate-400 font-medium">{talhao.cultura || 'Rotação de Culturas'}</p>
                        </>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {isEditingTalhao ? (
                        <button 
                            onClick={handleSaveTalhaoHeader}
                            disabled={saving}
                            className="p-1.5 text-white bg-emerald-600 rounded-full hover:bg-emerald-700 transition-colors"
                        >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        </button>
                    ) : (
                        <button 
                            onClick={() => setIsEditingTalhao(true)}
                            className="p-1.5 text-emerald-600 bg-emerald-50 rounded-full hover:bg-emerald-100 transition-colors"
                        >
                            <Pencil size={13} />
                        </button>
                    )}
                    <button onClick={onClose} className="p-1.5 text-slate-300 hover:text-slate-500 transition-all">
                        <X size={18} />
                    </button>
                </div>
            </div>                {/* Body Content (Invisible Scrollarea) */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-6 pt-0 pb-8">
                    {/* Insights/Soil Progress */}
                    <div className="space-y-6">
                        {/* Nested Data Card (Seeding/Area) */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900">Propriedades</h4>
                                    <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-bold mt-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>EM PRODUÇÃO</span>
                                    </div>
                                </div>
                                <button className="text-emerald-600 text-[11px] font-bold hover:underline">
                                    Editar mapa +
                                </button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Área</p>
                                    <p className="text-2xl font-black text-slate-900 leading-none">{areaFormatada}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">hectares</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Perímetro</p>
                                    <p className="text-2xl font-black text-slate-900 leading-none">
                                        {perimetroKm ? Math.round(perimetroKm).toLocaleString('pt-BR') : '--'}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">metros</p>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Altivez</p>
                                    <p className="text-2xl font-black text-slate-900 leading-none">850</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">m (nível mar)</p>
                                </div>
                            </div>
                    </div>
                </div>
                
                    {/* Tabs */}
                    <div className="flex bg-slate-50/50 border-b border-slate-100 shrink-0 mb-3 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setTabIndex(0)}
                            className={cn(
                                "flex-1 py-3.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all",
                                 tabIndex === 0 ? "text-emerald-600 border-emerald-600 bg-white" : "text-slate-400 border-transparent hover:text-slate-600"
                            )}
                        >
                            <LayoutGrid size={16} />
                            Estrutura
                        </button>
                        <button
                            onClick={() => setTabIndex(1)}
                            className={cn(
                                "flex-1 py-3.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all",
                                 tabIndex === 1 ? "text-emerald-600 border-emerald-600 bg-white" : "text-slate-400 border-transparent hover:text-slate-600"
                            )}
                        >
                            <FlaskConical size={16} />
                            Saúde Solo
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1">
                        {/* Tab 0: Structure */}
                        {tabIndex === 0 && (
                            <div className="animate-in fade-in duration-300">
                                {(!talhao.canteiros || talhao.canteiros.length === 0) ? (
                                    <div className="py-20 px-10 text-center">
                                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                                            <Sprout size={40} />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-900 mb-2">Sem estruturas</h4>
                                        <p className="text-sm text-slate-500 mb-8">Nenhum canteiro, linha ou tanque cadastrado para este talhão.</p>
                                        <button
                                            onClick={handleOpenCreateModal}
                                             className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            Adicionar Agora
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-green-50/50 px-6 py-2 border-b border-green-100">
                                            <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">
                                                {talhao.canteiros.length} ESTRUTURAS REGISTRADAS
                                            </span>
                                        </div>
                                        <div className="divide-y divide-slate-50 mb-20">
                                            {talhao.canteiros.map((canteiro: any) => (
                                                <div key={canteiro.id} className="p-4 px-6 hover:bg-slate-50 group transition-colors">
                                                    {editingCanteiroId === canteiro.id ? (
                                                        <div className="space-y-3 animate-in slide-in-from-top-1 duration-200">
                                                            <div className="flex items-center gap-2">
                                                                <input 
                                                                    value={canteiroEditData.nome}
                                                                    onChange={(e) => setCanteiroEditData(p => ({ ...p, nome: e.target.value }))}
                                                                    className="flex-1 text-sm font-bold bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500"
                                                                    placeholder="Nome"
                                                                />
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="space-y-1">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Largura (m)</p>
                                                                    <input 
                                                                        type="text"
                                                                        value={canteiroEditData.largura}
                                                                        onChange={(e) => setCanteiroEditData(p => ({ ...p, largura: e.target.value }))}
                                                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500"
                                                                        placeholder="0,00"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">Comprimento (m)</p>
                                                                    <input 
                                                                        type="text"
                                                                        value={canteiroEditData.comprimento}
                                                                        onChange={(e) => setCanteiroEditData(p => ({ ...p, comprimento: e.target.value }))}
                                                                        className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-emerald-500"
                                                                        placeholder="0,00"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end gap-2 mt-2">
                                                                <button onClick={() => setEditingCanteiroId(null)} className="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600">Cancelar</button>
                                                                <button 
                                                                    onClick={handleSaveCanteiroEdit}
                                                                    className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-100"
                                                                >
                                                                    Salvar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                                    {getIcon(canteiro.nome)}
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-slate-800">{canteiro.nome}</h4>
                                                                    <div className="flex gap-2 text-[10px] text-slate-400 font-medium">
                                                                        {canteiro.largura_metros && <span>{String(canteiro.largura_metros).replace('.', ',')}m larg.</span>}
                                                                        {canteiro.comprimento_metros && <span>{String(canteiro.comprimento_metros).replace('.', ',')}m comp.</span>}
                                                                        {!canteiro.largura_metros && !canteiro.comprimento_metros && <span>Dimensões não info.</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                                <button
                                                                    onClick={() => handleStartEditCanteiro(canteiro)}
                                                                    className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                                                                    title="Editar"
                                                                >
                                                                    <Pencil size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => onDeleteCanteiro(canteiro.id)}
                                                                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                    title="Excluir"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Tab 1: Soil Health */}
                        {tabIndex === 1 && (
                            <div className="p-6 space-y-8 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between">
                                         <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-emerald-600 rounded-full" />
                                        Métricas de Fertilidade
                                    </h4>
                                    <button
                                        onClick={isEditing ? handleSave : () => setIsEditing(true)}
                                        disabled={saving}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
                                            isEditing
                                                 ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                                : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-600 hover:text-emerald-600"
                                        )}
                                    >
                                        {isEditing ? (saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />) : <Edit2 size={14} />}
                                        {isEditing ? (saving ? "Salvando..." : "Salvar") : "Editar"}
                                    </button>
                                </div>

                                {isEditing ? (
                                    <div className="space-y-6">
                                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3 text-blue-700">
                                            <Info size={18} />
                                            <span className="text-xs font-semibold uppercase tracking-tight">Insira os dados técnicos da última análise de solo.</span>
                                        </div>

                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Atributos Químicos</p>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">pH (H₂O)</label>
                                                     <input type="text" name="ph_solo" value={formData.ph_solo} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">M.O. (%)</label>
                                                     <input type="text" name="materia_organica" value={formData.materia_organica} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">V (%)</label>
                                                     <input type="text" name="v_percent" value={formData.v_percent} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">P (mg/dm³)</label>
                                                     <input type="text" name="fosforo" value={formData.fosforo} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">K (mg/dm³)</label>
                                                     <input type="text" name="potassio" value={formData.potassio} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mt-8">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Textura (%)</p>
                                                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                                    <button onClick={() => setUnitMode('percent')} className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", unitMode === 'percent' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>%</button>
                                                    <button onClick={() => setUnitMode('g_kg')} className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", unitMode === 'g_kg' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>g/kg</button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-amber-600 ml-2">Argila</label>
                                                    <input type="text" name="teor_argila" value={formData.teor_argila} onChange={handleChange} className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-[0_4px_12px_rgba(217,119,6,0.05)]" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">Silte</label>
                                                     <input type="text" name="silte" value={formData.silte} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">Areia</label>
                                                     <input type="text" name="areia" value={formData.areia} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all" />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center px-2">
                                                <span className="text-[10px] font-black text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded uppercase">{classificacao}</span>
                                                <span className={cn("text-[10px] font-black uppercase", isTotalCorrect ? "text-emerald-600" : "text-red-500")}>
                                                    Total: {total.toFixed(1)} / {baseEsperada}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        {/* Gauges View (Dashboard Style) */}
                                        <div className="grid grid-cols-1 gap-6 px-2">
                                            {/* pH */}
                                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                                <div className="flex justify-between items-baseline mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">pH do Solo</span>
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900">{formData.ph_solo || '-'}</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-1000"
                                                        style={{ width: `${Math.min((Number(formData.ph_solo) / 8) * 100, 100)}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-1 px-0.5">
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Ácido</span>
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Neutro</span>
                                                    <span className="text-[8px] font-bold text-slate-500 uppercase">Alcalino</span>
                                                </div>
                                            </div>
 
                                            {/* V% */}
                                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                                <div className="flex justify-between items-baseline mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                                                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Saturação por Bases</span>
                                                    </div>
                                                    <span className="text-sm font-black text-slate-900">{formData.v_percent || '-'}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 transition-all duration-1000"
                                                        style={{ width: `${Number(formData.v_percent) || 0}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Nutrients Row */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fósforo (P)</p>
                                                    <h3 className="text-base font-black text-slate-900 flex items-baseline gap-1">
                                                        {formData.fosforo || '-'}
                                                        <span className="text-[10px] font-bold text-slate-300">mg</span>
                                                    </h3>
                                                </div>
                                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Potássio (K)</p>
                                                    <h3 className="text-base font-black text-slate-900 flex items-baseline gap-1">
                                                        {formData.potassio || '-'}
                                                        <span className="text-[10px] font-bold text-slate-300">mg</span>
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Physical / Texture Card */}
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Textura Física</h5>
                                                <span className="text-[10px] font-black bg-slate-900 text-white px-3 py-1 rounded-full">{classificacao}</span>
                                            </div>

                                            <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-[#5D4037] transition-all duration-1000" style={{ width: `${argilaPct}%` }} />
                                                <div className="h-full bg-slate-400 transition-all duration-1000" style={{ width: `${siltePct}%` }} />
                                                <div className="h-full bg-amber-400 transition-all duration-1000" style={{ width: `${areiaPct}%` }} />
                                            </div>

                                            <div className="flex justify-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-[#5D4037]" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Argila</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Silte</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Areia</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions (Inside Scrollarea) */}
                    {tabIndex === 0 && (
                        <div className="mt-10 mb-2">
                             <button
                                onClick={handleOpenCreateModal}
                                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Plus size={18} />
                                Nova Estrutura
                            </button>
                        </div>
                    )}
                </div>
            </div>

                {/* --- CREATE MODAL --- */}
            <div className={cn(
                "fixed inset-0 z-[2000] flex items-center justify-center p-4 transition-all duration-200",
                createModalOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
            )}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)} />
                <div className={cn(
                    "relative bg-white w-full max-w-md max-h-[calc(100dvh-4rem)] rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform",
                    createModalOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}>
                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Nova Estrutura</h3>
                        <button onClick={() => setCreateModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Content - Invisible Scroll area */}
                    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6 space-y-6 pb-12">
                        {/* Type Selection */}
                        <div className="space-y-3">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Estrutura</label>
                            <div className="grid grid-cols-3 gap-2">
                                {['canteiro', 'linha', 'tanque'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setBatchData({ ...batchData, type: t })}
                                        className={cn(
                                            "py-2 px-1 text-[10px] font-black uppercase rounded-xl border transition-all",
                                            batchData.type === t
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 shadow-inner ring-2 ring-emerald-600/5"
                                                : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50"
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Basic Info */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                {batchData.isBatch ? "Nome Base" : "Nome da Estrutura"}
                            </label>
                            <input
                                type="text"
                                value={batchData.baseName}
                                onChange={(e) => setBatchData({ ...batchData, baseName: e.target.value })}
                                placeholder={batchData.isBatch ? "Ex: Linha" : "Ex: Canteiro 1"}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-600 transition-all placeholder:text-slate-300"
                            />
                        </div>

                        {/* Dimensions */}
                        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Largura (m)</label>
                                <input
                                    type="text"
                                    value={batchData.width}
                                    onChange={(e) => setBatchData({ ...batchData, width: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-center text-slate-700 focus:outline-none focus:border-emerald-600 transition-all"
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Comp. (m)</label>
                                <input
                                    type="text"
                                    value={batchData.length}
                                    onChange={(e) => setBatchData({ ...batchData, length: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-center text-slate-700 focus:outline-none focus:border-emerald-600 transition-all"
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        {/* Tangue Specific: Profundidade e Volume */}
                        {batchData.type === 'tanque' && (
                            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-200">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-blue-400 uppercase tracking-widest ml-1 text-center block">Profundidade (m)</label>
                                    <input
                                        type="text"
                                        value={batchData.depth}
                                        onChange={(e) => setBatchData({ ...batchData, depth: e.target.value })}
                                        className="w-full bg-blue-50/30 border border-blue-100 rounded-2xl px-5 py-3 text-sm font-black text-center text-blue-700 focus:outline-none focus:border-blue-500 transition-all"
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-blue-400 uppercase tracking-widest ml-1 text-center block">Volume (m³)</label>
                                    <input
                                        type="text"
                                        value={batchData.volume}
                                        onChange={(e) => {
                                            setBatchData({ ...batchData, volume: e.target.value, isManualVolume: true });
                                        }}
                                        className={cn(
                                            "w-full border rounded-2xl px-5 py-3 text-sm font-black text-center transition-all focus:outline-none",
                                            batchData.isManualVolume 
                                                ? "bg-amber-50 border-amber-200 text-amber-700 focus:border-amber-500" 
                                                : "bg-blue-50/30 border-blue-100 text-blue-700 focus:border-blue-500"
                                        )}
                                        placeholder="0,00"
                                    />
                                    {batchData.isManualVolume && (
                                        <button 
                                            onClick={() => setBatchData(prev => ({ ...prev, isManualVolume: false }))}
                                            className="text-[9px] font-bold text-amber-600 uppercase tracking-tight w-full hover:underline"
                                        >
                                            Resetar para Automático
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {!batchData.isBatch && (
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantidade de Estruturas</label>
                                <input
                                    type="number"
                                    value={batchData.quantity}
                                    onChange={(e) => setBatchData({ ...batchData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-700 focus:outline-none focus:border-emerald-600 transition-all"
                                />
                            </div>
                        )}

                        {/* Batch Switch */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <div>
                                <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest">Gerar Múltiplos</h5>
                                <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Criar lotes automaticamente</p>
                            </div>
                            <button
                                onClick={() => setBatchData({ ...batchData, isBatch: !batchData.isBatch })}
                                className={cn(
                                    "w-12 h-6 rounded-full p-1 transition-all duration-300",
                                    batchData.isBatch ? "bg-emerald-600" : "bg-slate-300"
                                )}
                            >
                                <div className={cn(
                                    "w-4 h-4 bg-white rounded-full shadow-md transition-transform duration-300",
                                    batchData.isBatch ? "translate-x-6" : "translate-x-0"
                                )} />
                            </button>
                        </div>

                        {/* Batch Fields */}
                        {batchData.isBatch && (
                            <div className="grid grid-cols-2 gap-4 p-5 bg-green-50/50 rounded-3xl border border-green-100/50 animate-in zoom-in duration-200">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-green-700 uppercase tracking-widest ml-1 block text-center">Quantidade</label>
                                    <input
                                        type="number"
                                        value={batchData.quantity}
                                        onChange={(e) => setBatchData({ ...batchData, quantity: Math.max(1, parseInt(e.target.value) || 0) })}
                                        className="w-full bg-white border border-green-200 rounded-2xl px-4 py-2 text-sm font-black text-center text-green-700 focus:outline-none"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-green-700 uppercase tracking-widest ml-1 block text-center">Nº Inicial</label>
                                    <input
                                        type="number"
                                        value={batchData.startNumber}
                                        onChange={(e) => setBatchData({ ...batchData, startNumber: Math.max(0, parseInt(e.target.value) || 0) })}
                                        className="w-full bg-white border border-green-200 rounded-2xl px-4 py-2 text-sm font-black text-center text-green-700 focus:outline-none"
                                    />
                                </div>
                                <p className="col-span-2 text-[10px] text-green-600/60 font-medium italic text-center mt-2">
                                    Serão criadas {batchData.quantity} estruturas: "{batchData.baseName || 'Item'} {batchData.startNumber}" até "{batchData.baseName || 'Item'} {batchData.startNumber + batchData.quantity - 1}"
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-6 border-t border-slate-50 bg-slate-50/50 flex gap-3">
                        <button
                            onClick={() => setCreateModalOpen(false)}
                            className="flex-1 py-3 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-2xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleBatchSave}
                            className="flex-[2] py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {batchData.isBatch ? `Gerar ${batchData.quantity} itens` : 'Criar Estrutura'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Success/Error Snackbars - Custom Implementation */}
            {snackbar.open && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2100] animate-in slide-in-from-bottom-5 fade-in duration-300">
                    <div className={cn(
                        "flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-md",
                        snackbar.severity === 'success'
                            ? "bg-emerald-500/90 text-white border-emerald-400/50"
                            : "bg-red-500/90 text-white border-red-400/50"
                    )}>
                        {snackbar.severity === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span className="text-sm font-black tracking-tight">{snackbar.message}</span>
                        <button onClick={() => setSnackbar(prev => ({ ...prev, open: false }))} className="ml-2 hover:opacity-70 transition-opacity">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default TalhaoDetailsDrawer;
