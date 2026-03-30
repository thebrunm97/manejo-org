import React, { useState, useEffect } from 'react';
import { 
    X, Trash, Trash2, Sprout, Layers, FlaskConical, 
    Save, CheckCircle2, AlertCircle, LayoutGrid, 
    Pencil, Droplets, TreePine
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface TalhaoDetailsDrawerProps {
    open: boolean;
    onClose: () => void;
    talhao: any;
    onDeleteCanteiro: (id: string | number) => void;
    onUpdateCanteiro: (id: string | number, data: any) => void;
    onCreateCanteiros: (data: any) => void;
    onDeleteTalhao?: (id: string | number) => void;
    onUpdateTalhao?: (id: string | number, data: any) => void;
}

const TalhaoDetailsDrawer: React.FC<TalhaoDetailsDrawerProps> = ({
    open, onClose, talhao, onDeleteCanteiro, onUpdateCanteiro, onCreateCanteiros, onDeleteTalhao, onUpdateTalhao
}) => {
    const [tabIndex, setTabIndex] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [showDeleteTalhaoConfirm, setShowDeleteTalhaoConfirm] = useState(false);
    const [isEditingTalhao, setIsEditingTalhao] = useState(false);
    const [talhaoEditData, setTalhaoEditData] = useState({
        nome: '', cultura: '', fillColor: '#10B981', borderColor: '#059669'
    });
    const [editingCanteiroId, setEditingCanteiroId] = useState<string | number | null>(null);
    const [canteiroEditData, setCanteiroEditData] = useState({ nome: '', largura: '', comprimento: '' });
    const [formData, setFormData] = useState({
        ph_solo: '', v_percent: '', materia_organica: '', fosforo: '', potassio: '', teor_argila: '', silte: '', areia: ''
    });
    const [unitMode] = useState<'percent' | 'g_kg'>('percent');
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    const [batchData, setBatchData] = useState({
        type: 'canteiro', baseName: '', width: '', length: '', quantity: 1, isBatch: false, startNumber: 1, depth: '', volume: '', isManualVolume: false
    });

    useEffect(() => {
        if (talhao) {
            setFormData({
                ph_solo: talhao.ph_solo || '', v_percent: talhao.v_percent || '', materia_organica: talhao.materia_organica || '',
                fosforo: talhao.fosforo || '', potassio: talhao.potassio || '', teor_argila: talhao.teor_argila || '',
                silte: talhao.silte || '', areia: talhao.areia || ''
            });
            setTalhaoEditData({
                nome: talhao.nome || '', cultura: talhao.cultura || '',
                fillColor: talhao.fillColor || talhao.fill_color || '#10B981',
                borderColor: talhao.borderColor || talhao.border_color || '#059669'
            });
        }
    }, [talhao]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!onUpdateTalhao) return;
        setSaving(true);
        try {
            const d = {
                ...formData,
                ph_solo: parseFloat(String(formData.ph_solo).replace(',', '.')) || null,
                v_percent: parseFloat(String(formData.v_percent).replace(',', '.')) || null,
                materia_organica: parseFloat(String(formData.materia_organica).replace(',', '.')) || null,
                fosforo: parseFloat(String(formData.fosforo).replace(',', '.')) || null,
                potassio: parseFloat(String(formData.potassio).replace(',', '.')) || null,
                teor_argila: parseFloat(String(formData.teor_argila).replace(',', '.')) || null,
                silte: parseFloat(String(formData.silte).replace(',', '.')) || null,
                areia: parseFloat(String(formData.areia).replace(',', '.')) || null,
            };
            await onUpdateTalhao(talhao.id, d);
            setIsEditing(false);
            setSnackbar({ open: true, message: 'Dados de solo atualizados!', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Erro ao atualizar dados.', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleSaveTalhaoHeader = async () => {
        if (!onUpdateTalhao) return;
        setSaving(true);
        try {
            await onUpdateTalhao(talhao.id, {
                nome: talhaoEditData.nome, cultura: talhaoEditData.cultura,
                fill_color: talhaoEditData.fillColor, border_color: talhaoEditData.borderColor
            });
            setIsEditingTalhao(false);
            setSnackbar({ open: true, message: 'Talhão atualizado!', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Erro ao atualizar talhão.', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleStartEditCanteiro = (c: any) => {
        setEditingCanteiroId(c.id);
        setCanteiroEditData({ nome: c.nome, largura: String(c.largura_metros || '').replace('.', ','), comprimento: String(c.comprimento_metros || '').replace('.', ',') });
    };

    const handleSaveCanteiroEdit = async () => {
        if (!editingCanteiroId) return;
        try {
            await onUpdateCanteiro(editingCanteiroId, {
                nome: canteiroEditData.nome, 
                largura_metros: parseFloat(canteiroEditData.largura.replace(',', '.')) || null,
                comprimento_metros: parseFloat(canteiroEditData.comprimento.replace(',', '.')) || null
            });
            setEditingCanteiroId(null);
            setSnackbar({ open: true, message: 'Estrutura atualizada!', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Erro ao atualizar.', severity: 'error' });
        }
    };

    const handleBatchSave = async () => {
        if (!onCreateCanteiros) return;
        try {
            const structs: any[] = [];
            const qty = batchData.isBatch ? batchData.quantity : 1;
            for (let i = 0; i < qty; i++) {
                structs.push({
                    nome: batchData.isBatch ? `${batchData.baseName} ${batchData.startNumber + i}` : batchData.baseName,
                    tipo: batchData.type, largura_metros: parseFloat(batchData.width.replace(',', '.')) || null,
                    comprimento_metros: parseFloat(batchData.length.replace(',', '.')) || null,
                    profundidade_metros: batchData.type === 'tanque' ? parseFloat(batchData.depth.replace(',', '.')) || null : null,
                    volume_m3: batchData.type === 'tanque' ? parseFloat(batchData.volume.replace(',', '.')) || null : null,
                    talhao_id: talhao.id
                });
            }
            await onCreateCanteiros(structs);
            setCreateModalOpen(false);
            setSnackbar({ open: true, message: `${qty} estrutura(s) criada(s)!`, severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Erro ao criar.', severity: 'error' });
        }
    };

    const areaFormatada = talhao?.area_ha?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '--';
    const argila = parseFloat(String(formData.teor_argila).replace(',', '.')) || 0;
    const silte = parseFloat(String(formData.silte).replace(',', '.')) || 0;
    const areia = parseFloat(String(formData.areia).replace(',', '.')) || 0;
    const total = argila + silte + areia;
    const baseEsperada = unitMode === 'percent' ? 100 : 1000;
    let classificacao = '--';
    if (total > 0) {
        if (argila > 35) classificacao = 'Argiloso';
        else if (argila > 15 && areia > 45) classificacao = 'Franco-Arenoso';
        else if (argila < 15 && areia > 70) classificacao = 'Arenoso';
        else classificacao = 'Franco';
    }

    const getIcon = (name: string, color?: string) => {
        const lower = name?.toLowerCase() || '';
        const baseColor = color || (talhao?.tipo === 'agua' ? '#3B82F6' : '#10B981');
        if (lower.includes('tanque') || lower.includes('água')) return <Droplets style={{ color: baseColor }} size={18} />;
        if (lower.includes('linha') || lower.includes('saf')) return <TreePine style={{ color: baseColor }} size={18} />;
        return <Sprout style={{ color: baseColor }} size={18} />;
    };

    if (!talhao) return null;

    return (
        <div className="talhao-details-container">
            <div className={cn("fixed inset-x-0 bottom-0 md:inset-y-0 md:right-8 md:left-auto md:max-w-md z-[2000] pointer-events-none transition-all duration-500 flex md:items-center", open ? "visible" : "invisible")}>
                <div className={cn("relative bg-white/95 backdrop-blur-3xl shadow-soft flex flex-col overflow-hidden transition-all duration-500 transform pointer-events-auto", "md:w-[28rem] md:rounded-[40px] md:max-h-[92vh] md:border md:border-slate-200/60", "top-auto left-0 right-0 bottom-0 w-full h-[85vh] rounded-t-[40px]", open ? "translate-y-0 md:translate-x-0 opacity-100" : "translate-y-full md:translate-x-12 opacity-0")}>
                    <div className="flex items-start gap-4 p-6 shrink-0 bg-transparent">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg bg-emerald-500/10 border border-white/40 overflow-hidden relative group" style={{ backgroundColor: `${talhao.fill_color || '#10B981'}15` }}>
                            {getIcon(talhao.nome, talhao.fill_color)}
                        </div>
                        <div className="flex-1 overflow-hidden min-w-0 pt-1">
                            {isEditingTalhao ? (
                                <input autoFocus value={talhaoEditData.nome} onChange={e=>setTalhaoEditData({...talhaoEditData, nome: e.target.value})} className="w-full text-base font-black bg-slate-50 border rounded-xl px-2 py-1 outline-none focus:border-emerald-500" />
                            ) : (
                                <>
                                    <h3 className="text-xl font-black text-slate-900 truncate tracking-tight">{talhao.nome || "Talhão"}</h3>
                                    <p className="text-sm text-slate-500 font-bold tracking-tight">{talhao.cultura || "Geral"} • {areaFormatada} ha</p>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {!isEditingTalhao ? (
                                <>
                                    <button 
                                        onClick={() => setIsEditingTalhao(true)} 
                                        className="w-10 h-10 flex items-center justify-center text-slate-400 bg-slate-50 rounded-2xl hover:text-emerald-600 transition-all cursor-pointer border border-slate-100"
                                        title="Editar"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button 
                                        onClick={() => setShowDeleteTalhaoConfirm(true)} 
                                        className="w-10 h-10 flex items-center justify-center text-red-400 bg-red-50/50 rounded-2xl hover:text-red-600 transition-all cursor-pointer border border-red-100/50"
                                        title="Excluir"
                                    >
                                        <Trash size={18} />
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={handleSaveTalhaoHeader} 
                                    className="w-10 h-10 flex items-center justify-center text-white bg-emerald-600 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all cursor-pointer"
                                    title="Salvar"
                                >
                                    <Save size={18} />
                                </button>
                            )}
                            <button 
                                onClick={onClose} 
                                className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-all cursor-pointer"
                                title="Fechar"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-100/50 p-1.5 shrink-0 mb-6 rounded-2xl mx-4 border border-slate-200/40 backdrop-blur-sm">
                        <button onClick={() => setTabIndex(0)} className={cn("flex-1 py-3 text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 rounded-xl transition-all", tabIndex === 0 ? "bg-white shadow-md text-emerald-700" : "text-slate-400")}>
                            <LayoutGrid size={16} /> Estrutura
                        </button>
                        <button onClick={() => setTabIndex(1)} className={cn("flex-1 py-3 text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 rounded-xl transition-all", tabIndex === 1 ? "bg-white shadow-md text-emerald-700" : "text-slate-400")}>
                            <FlaskConical size={16} /> Saúde Solo
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 pb-6">
                        {tabIndex === 0 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                {talhao.canteiros?.length === 0 ? (
                                    <div className="py-20 text-center bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200">
                                        <Sprout size={48} className="mx-auto text-slate-200 mb-4" />
                                        <h4 className="font-black text-slate-900">Sem estruturas</h4>
                                        <button onClick={()=>setCreateModalOpen(true)} className="mt-6 px-8 py-3 bg-emerald-600 text-white font-black text-[10px] uppercase rounded-xl">Adicionar Agora</button>
                                    </div>
                                ) : (
                                    talhao.canteiros?.map((c: any) => (
                                        <div key={c.id} className="p-4 bg-white border border-slate-200/60 rounded-3xl flex items-center justify-between group transition-all hover:border-emerald-200/60 hover:shadow-soft">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors">{getIcon(c.nome)}</div>
                                                <div>
                                                    <h4 className="text-sm font-black">{c.nome}</h4>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{c.largura_metros}m x {c.comprimento_metros}m</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-100 transition-opacity">
                                                <button 
                                                    onClick={(e)=>{
                                                        e.stopPropagation();
                                                        handleStartEditCanteiro(c);
                                                    }} 
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer bg-slate-50/50 rounded-xl"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e)=>{
                                                        e.stopPropagation();
                                                        onDeleteCanteiro(c.id);
                                                    }} 
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors cursor-pointer bg-slate-50/50 rounded-xl"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <button onClick={()=>setCreateModalOpen(true)} className="w-full h-16 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest rounded-[24px] shadow-2xl shadow-emerald-500/20 transition-all mt-4">+ Nova Estrutura</button>
                            </div>
                        )}

                        {tabIndex === 1 && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                {/* PHYSICAL COMPOSITION - LIGHT PREMIUM CARD */}
                                <div className="bg-white border border-slate-200/60 rounded-[32px] p-6 shadow-soft relative overflow-hidden group mx-1">
                                    <div className="flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100/50">
                                                <Layers size={20} className="text-emerald-600" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">Composição Física</p>
                                                <p className="text-lg font-black text-slate-900">{classificacao || 'Analisando...'}</p>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* SEGMENTED BAR */}
                                    <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 mb-6">
                                        <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${Math.min(100, (argila/baseEsperada)*100)}%` }} />
                                        <div className="h-full bg-amber-400 transition-all duration-1000 delay-200" style={{ width: `${Math.min(100, (silte/baseEsperada)*100)}%` }} />
                                        <div className="h-full bg-sky-400 transition-all duration-1000 delay-400" style={{ width: `${Math.min(100, (areia/baseEsperada)*100)}%` }} />
                                    </div>

                                    {/* LEGEND DOTS */}
                                    <div className="flex items-center gap-6 justify-center">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Argila {argila}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Silte {silte}%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Areia {areia}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* CHEMICAL METRICS - BENTO GRID */}
                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { l: 'pH', v: formData.ph_solo, u: 'CaCl2', i: <FlaskConical size={14} />, c: 'emerald', s: Number(formData.ph_solo) >= 6 && Number(formData.ph_solo) <= 7 ? 'Ideal' : 'Ajustar' },
                                        { l: 'V%', v: formData.v_percent, u: '%', i: <Droplets size={14} />, c: 'blue', s: Number(formData.v_percent) >= 60 ? 'Ideal' : 'Baixo' },
                                        { l: 'M.O.', v: formData.materia_organica, u: 'g/dm³', i: <Layers size={14} />, c: 'amber', s: Number(formData.materia_organica) >= 2.5 ? 'Ideal' : 'Baixo' },
                                        { l: 'P', v: formData.fosforo, u: 'mg', i: <Sprout size={14} />, c: 'emerald', s: Number(formData.fosforo) >= 20 ? 'Ideal' : 'Baixo' }
                                    ].map((m, i) => (
                                        <div key={i} className="bg-slate-50/50 border border-slate-200/60 p-5 rounded-[28px] group transition-all hover:bg-white hover:shadow-soft hover:-translate-y-1 relative overflow-hidden">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", m.c === 'emerald' ? "bg-emerald-100 text-emerald-600" : m.c === 'blue' ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600")}>
                                                    {m.i}
                                                </div>
                                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full", m.s === 'Ideal' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{m.s}</span>
                                            </div>
                                            <div className="text-center py-2">
                                                <p className="text-3xl font-black text-slate-900 mb-1">{m.v || '--'}</p>
                                                <div className="flex items-center justify-center gap-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.l}</span>
                                                    <span className="text-[9px] font-bold text-slate-300">({m.u})</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button onClick={()=>setIsEditing(true)} className="w-full py-4 bg-emerald-50 text-emerald-700 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-emerald-100 transition-all border border-emerald-200/50 mt-2">Editar Análise Completa</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-[40px] p-8 shadow-2xl overflow-y-auto max-h-[90vh] [&::-webkit-scrollbar]:hidden">
                        <h3 className="text-2xl font-black text-slate-900 mb-8">Análise de Solo</h3>
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">pH Solo</label><input className="w-full p-3 bg-slate-50 border rounded-2xl outline-none focus:border-emerald-500" name="ph_solo" value={formData.ph_solo} onChange={handleChange} /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">V %</label><input className="w-full p-3 bg-slate-50 border rounded-2xl outline-none focus:border-emerald-500" name="v_percent" value={formData.v_percent} onChange={handleChange} /></div>
                            </div>
                            <div className="grid grid-cols-3 gap-4 border-t pt-6">
                                <div className="space-y-1"><label className="text-[10px] font-black text-emerald-600 uppercase">Argila</label><input className="w-full p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl" name="teor_argila" value={formData.teor_argila} onChange={handleChange} /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Silte</label><input className="w-full p-3 bg-slate-50 border rounded-2xl" name="silte" value={formData.silte} onChange={handleChange} /></div>
                                <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Areia</label><input className="w-full p-3 bg-slate-50 border rounded-2xl" name="areia" value={formData.areia} onChange={handleChange} /></div>
                            </div>
                        </div>
                        <div className="mt-10 flex gap-4"><button onClick={()=>setIsEditing(false)} className="flex-1 py-4 font-black text-slate-400">Cancelar</button><button onClick={handleSave} className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl">Salvar Dados</button></div>
                    </div>
                </div>
            )}

            {editingCanteiroId && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                                <Pencil size={20} className="text-emerald-600" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900">Editar Estrutura</h3>
                        </div>
                        <div className="space-y-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nome da Estrutura</label>
                                <input className="w-full bg-slate-50 border p-4 rounded-2xl font-black focus:border-emerald-500 outline-none" value={canteiroEditData.nome} onChange={e=>setCanteiroEditData({...canteiroEditData, nome: e.target.value})} placeholder="Ex: Canteiro 1" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Largura (m)</label>
                                    <input className="bg-slate-50 border p-4 rounded-2xl text-center font-black focus:border-emerald-500 outline-none" value={canteiroEditData.largura} onChange={e=>setCanteiroEditData({...canteiroEditData, largura: e.target.value})} placeholder="Largura" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Comprimento (m)</label>
                                    <input className="bg-slate-50 border p-4 rounded-2xl text-center font-black focus:border-emerald-500 outline-none" value={canteiroEditData.comprimento} onChange={e=>setCanteiroEditData({...canteiroEditData, comprimento: e.target.value})} placeholder="Comp." />
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex gap-4">
                            <button onClick={()=>setEditingCanteiroId(null)} className="flex-1 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest">Cancelar</button>
                            <button onClick={handleSaveCanteiroEdit} className="flex-[1.5] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl transition-all">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteTalhaoConfirm && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in zoom-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl text-center">
                        <div className="w-20 h-20 bg-red-50 rounded-[30px] flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={40} className="text-red-500 underline-offset-4" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-2">Excluir Talhão?</h3>
                        <p className="text-sm text-slate-500 font-medium mb-8">Esta ação é irreversível e removerá todas as estruturas vinculadas a este talhão ({talhao.nome}).</p>
                        <div className="flex flex-col gap-2">
                            <button onClick={() => {onDeleteTalhao?.(talhao.id); setShowDeleteTalhaoConfirm(false);}} className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-200 transition-all">Sim, Excluir Tudo</button>
                            <button onClick={()=>setShowDeleteTalhaoConfirm(false)} className="w-full py-4 text-slate-400 font-black uppercase tracking-widest text-[10px]">Manter Talhão</button>
                        </div>
                    </div>
                </div>
            )}

            {snackbar.open && (
                <div className={cn("fixed bottom-10 left-1/2 -translate-x-1/2 z-[4000] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300", snackbar.severity === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
                    {snackbar.severity === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    <span className="text-xs font-black uppercase tracking-wider">{snackbar.message}</span>
                    <button onClick={()=>setSnackbar({...snackbar, open: false})} className="ml-2 hover:opacity-70"><X size={14} /></button>
                </div>
            )}

            {createModalOpen && (
                <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl">
                        <h3 className="text-2xl font-black text-slate-900 mb-8">Nova Estrutura</h3>
                        <div className="space-y-6">
                            <input className="w-full bg-slate-50 border p-4 rounded-2xl font-black" value={batchData.baseName} onChange={e=>setBatchData({...batchData, baseName: e.target.value})} placeholder="Nome (ex: Canteiro 1)" />
                            <div className="grid grid-cols-2 gap-4">
                                <input className="bg-slate-50 border p-4 rounded-2xl text-center font-black" value={batchData.width} onChange={e=>setBatchData({...batchData, width: e.target.value})} placeholder="Largura" />
                                <input className="bg-slate-50 border p-4 rounded-2xl text-center font-black" value={batchData.length} onChange={e=>setBatchData({...batchData, length: e.target.value})} placeholder="Comp." />
                            </div>
                        </div>
                        <button onClick={handleBatchSave} className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl mt-8 shadow-xl">Criar Estrutura</button>
                        <button onClick={()=>setCreateModalOpen(false)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-xs">Descartar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TalhaoDetailsDrawer;
