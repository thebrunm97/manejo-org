// src/components/PropertyMap/TalhaoDetailsDrawer.tsx

import React, { useState, useEffect } from 'react';
import {
    X,
    ArrowLeft,
    Sprout,
    Trash2,
    Plus,
    FlaskConical,
    Droplets,
    TreePine,
    Edit2,
    Save,
    ChevronRight,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Info,
    LayoutGrid
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
            isBatch: false,
            quantity: 1,
            startNumber: 1
        });
        setCreateModalOpen(true);
    };

    const handleBatchSave = async () => {
        if (!talhao) return;
        try {
            const payloads = [];
            const w = parseFloat(batchData.width.replace(',', '.')) || 0;
            const l = parseFloat(batchData.length.replace(',', '.')) || 0;
            const area = (w > 0 && l > 0) ? (w * l) : null;

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
                    talhao_id: talhao.id,
                    nome: finalName,
                    tipo: batchData.type,
                    largura: w || null,
                    comprimento: l || null,
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

    // --- Soil State ---
    const [isEditing, setIsEditing] = useState(false);
    const [unitMode, setUnitMode] = useState<'percent' | 'g_kg'>('percent');

    // Form Data
    const [formData, setFormData] = useState({
        ph_solo: '', materia_organica: '', v_percent: '',
        fosforo: '', potassio: '',
        teor_argila: '', silte: '', areia: ''
    });

    const [saving, setSaving] = useState(false);

    // Load Data
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

    const getStrIcon = (nome: string) => {
        const lower = nome.toLowerCase();
        if (lower.includes('tanque') || lower.includes('água')) return <Droplets className="text-blue-500" size={18} />;
        if (lower.includes('linha') || lower.includes('saf')) return <TreePine className="text-amber-600" size={18} />;
        return <Sprout className="text-emerald-500" size={18} />;
    };

    return (
        <>
            {/* Offcanvas Drawer Pattern */}
            <div className={cn(
                "fixed inset-0 z-[110] transition-all duration-300 pointer-events-none md:pointer-events-auto",
                open ? "visible" : "invisible"
            )}>
                {/* Backdrop overlay (Desktop/Mobile) */}
                <div
                    className={cn(
                        "absolute inset-0 bg-slate-900/60 transition-opacity duration-300 pointer-events-auto",
                        open ? "opacity-100 backdrop-blur-sm" : "opacity-0"
                    )}
                    onClick={onClose}
                />

                {/* Drawer Panel */}
                <div className={cn(
                    "absolute top-0 bottom-0 right-0 w-full md:w-[500px] bg-white shadow-2xl transition-transform duration-300 pointer-events-auto flex flex-col",
                    open ? "translate-x-0" : "translate-x-full"
                )}>
                    {/* Header */}
                    <div className="flex items-center gap-4 p-5 border-b border-slate-100 shrink-0">
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex-1 overflow-hidden">
                            <h3 className="text-lg font-extrabold text-slate-900 truncate tracking-tight">{talhao.nome || 'Talhão Sem Nome'}</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                                {talhao.area_ha ? `${talhao.area_ha} ha` : `${talhao.area_total_m2 || 0} m²`}
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                {talhao.cultura || 'Sem cultura'}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex bg-slate-50/50 border-b border-slate-100 shrink-0">
                        <button
                            onClick={() => setTabIndex(0)}
                            className={cn(
                                "flex-1 py-3.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all",
                                tabIndex === 0 ? "text-green-600 border-green-600 bg-white" : "text-slate-400 border-transparent hover:text-slate-600"
                            )}
                        >
                            <LayoutGrid size={16} />
                            Estrutura
                        </button>
                        <button
                            onClick={() => setTabIndex(1)}
                            className={cn(
                                "flex-1 py-3.5 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all",
                                tabIndex === 1 ? "text-green-600 border-green-600 bg-white" : "text-slate-400 border-transparent hover:text-slate-600"
                            )}
                        >
                            <FlaskConical size={16} />
                            Saúde Solo
                        </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide">
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
                                            className="px-8 py-3 bg-green-600 text-white font-bold rounded-2xl shadow-lg shadow-green-100 hover:bg-green-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
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
                                        <div className="divide-y divide-slate-50">
                                            {talhao.canteiros.map((canteiro: any) => (
                                                <div key={canteiro.id} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 group transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                                                            {getStrIcon(canteiro.nome)}
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-slate-800">{canteiro.nome}</h4>
                                                            {canteiro.status !== 'ativo' && (
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">{canteiro.status}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => onDeleteCanteiro(canteiro.id)}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
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
                                        <div className="w-1.5 h-6 bg-green-600 rounded-full" />
                                        Métricas de Fertilidade
                                    </h4>
                                    <button
                                        onClick={isEditing ? handleSave : () => setIsEditing(true)}
                                        disabled={saving}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm",
                                            isEditing
                                                ? "bg-green-600 text-white hover:bg-green-700"
                                                : "bg-white text-slate-600 border border-slate-200 hover:border-green-600 hover:text-green-600"
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
                                                    <input type="text" name="ph_solo" value={formData.ph_solo} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">M.O. (%)</label>
                                                    <input type="text" name="materia_organica" value={formData.materia_organica} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">V (%)</label>
                                                    <input type="text" name="v_percent" value={formData.v_percent} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">P (mg/dm³)</label>
                                                    <input type="text" name="fosforo" value={formData.fosforo} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">K (mg/dm³)</label>
                                                    <input type="text" name="potassio" value={formData.potassio} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 mt-8">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Textura (%)</p>
                                                <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                                                    <button onClick={() => setUnitMode('percent')} className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", unitMode === 'percent' ? "bg-white text-green-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>%</button>
                                                    <button onClick={() => setUnitMode('g_kg')} className={cn("px-3 py-1 text-[10px] font-bold rounded-md transition-all", unitMode === 'g_kg' ? "bg-white text-green-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}>g/kg</button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-amber-600 ml-2">Argila</label>
                                                    <input type="text" name="teor_argila" value={formData.teor_argila} onChange={handleChange} className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 transition-all shadow-[0_4px_12px_rgba(217,119,6,0.05)]" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">Silte</label>
                                                    <input type="text" name="silte" value={formData.silte} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-[9px] font-bold text-slate-500 ml-2">Areia</label>
                                                    <input type="text" name="areia" value={formData.areia} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-green-500/20 focus:border-green-600 transition-all" />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center px-2">
                                                <span className="text-[10px] font-black text-amber-700 bg-amber-100/50 px-2 py-0.5 rounded uppercase">{classificacao}</span>
                                                <span className={cn("text-[10px] font-black uppercase", isTotalCorrect ? "text-green-600" : "text-red-500")}>
                                                    Total: {total.toFixed(1)} / {baseEsperada}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        {/* Gauges View */}
                                        <div className="grid grid-cols-1 gap-6">
                                            {/* pH */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-tighter">pH (Água)</span>
                                                    <span className="text-lg font-black text-slate-900 leading-none">{formData.ph_solo || '-'}</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                                                        style={{ width: `${Math.min((Number(formData.ph_solo) / 8) * 100, 100)}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* V% */}
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-tighter">Saturação por Bases (V%)</span>
                                                    <span className="text-lg font-black text-slate-900 leading-none">{formData.v_percent || '-'}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-blue-500 transition-all duration-1000 shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                                                        style={{ width: `${Number(formData.v_percent) || 0}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* P & K Dual Cards */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-12 h-12 bg-purple-500/5 blur-xl -mr-6 -mt-6 group-hover:bg-purple-500/10 transition-colors" />
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fósforo (P)</p>
                                                    <h3 className="text-xl font-black text-slate-900 flex items-baseline gap-1">
                                                        {formData.fosforo || '-'}
                                                        <span className="text-[9px] font-bold text-slate-400">mg/dm³</span>
                                                    </h3>
                                                </div>
                                                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group">
                                                    <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/5 blur-xl -mr-6 -mt-6 group-hover:bg-amber-500/10 transition-colors" />
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Potássio (K)</p>
                                                    <h3 className="text-xl font-black text-slate-900 flex items-baseline gap-1">
                                                        {formData.potassio || '-'}
                                                        <span className="text-[9px] font-bold text-slate-400">mg/dm³</span>
                                                    </h3>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Physical / Texture Card */}
                                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm overflow-hidden space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest">Textura Física</h5>
                                                <span className="text-[10px] font-black bg-[#451a03] text-white px-2 py-0.5 rounded-full">{classificacao}</span>
                                            </div>

                                            <div className="h-10 w-full bg-slate-50 rounded-2xl overflow-hidden flex shadow-inner border border-slate-200/50">
                                                <div className="h-full bg-[#5D4037] flex items-center justify-center transition-all duration-1000 border-r border-white/20" style={{ width: `${argilaPct}%` }}>
                                                    {argilaPct > 15 && <span className="text-[10px] font-black text-white/90">{argilaPct}%</span>}
                                                </div>
                                                <div className="h-full bg-slate-400 flex items-center justify-center transition-all duration-1000 border-r border-white/20" style={{ width: `${siltePct}%` }}>
                                                    {siltePct > 15 && <span className="text-[10px] font-black text-white/90">{siltePct}%</span>}
                                                </div>
                                                <div className="h-full bg-amber-400 flex items-center justify-center transition-all duration-1000" style={{ width: `${areiaPct}%` }}>
                                                    {areiaPct > 15 && <span className="text-[10px] font-black text-[#5D4037]">{areiaPct}%</span>}
                                                </div>
                                            </div>

                                            <div className="flex justify-center gap-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-[#5D4037]" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Argila</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Silte</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Areia</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    {tabIndex === 0 && (
                        <div className="p-6 border-t border-slate-100 shrink-0 bg-white shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)]">
                            <button
                                onClick={handleOpenCreateModal}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-green-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Plus size={20} />
                                Novo Canteiro / Estrutura
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- CREATE MODAL --- */}
            <div className={cn(
                "fixed inset-0 z-[130] flex items-center justify-center p-4 transition-all duration-200",
                createModalOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
            )}>
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setCreateModalOpen(false)} />
                <div className={cn(
                    "relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 transform",
                    createModalOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
                )}>
                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Nova Estrutura</h3>
                        <button onClick={() => setCreateModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Content */}
                    <div className="p-6 space-y-6">
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
                                                ? "bg-green-50 text-green-700 border-green-200 shadow-inner ring-2 ring-green-600/5"
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
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-4 focus:ring-green-500/5 focus:border-green-600 transition-all placeholder:text-slate-300"
                            />
                        </div>

                        {/* Dimensions */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Largura (m)</label>
                                <input
                                    type="number"
                                    value={batchData.width}
                                    onChange={(e) => setBatchData({ ...batchData, width: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-center text-slate-700 focus:outline-none focus:border-green-600 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 text-center block">Comp. (m)</label>
                                <input
                                    type="number"
                                    value={batchData.length}
                                    onChange={(e) => setBatchData({ ...batchData, length: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-center text-slate-700 focus:outline-none focus:border-green-600 transition-all"
                                />
                            </div>
                        </div>

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
                                    batchData.isBatch ? "bg-green-600" : "bg-slate-300"
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
                            className="flex-[2] py-3 bg-green-600 hover:bg-green-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-green-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {batchData.isBatch ? `Gerar ${batchData.quantity} itens` : 'Criar Estrutura'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Success/Error Snackbars - Custom Implementation */}
            {snackbar.open && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-5 fade-in duration-300">
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
