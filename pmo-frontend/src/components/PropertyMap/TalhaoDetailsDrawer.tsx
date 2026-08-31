// src/components/PropertyMap/TalhaoDetailsDrawer.tsx

import React, { useState, useEffect } from 'react';
import { 
    X, Trash, Trash2, Sprout, Layers, FlaskConical, ChevronLeft, 
    Save, CheckCircle2, AlertCircle, LayoutGrid, 
    Pencil, Droplets, TreePine, Loader2, Map, Plus
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface Canteiro {
    id: string | number;
    nome: string;
    largura_metros: number | string;
    comprimento_metros: number | string;
}

interface Talhao {
    id: string | number;
    nome: string;
    cultura?: string;
    area_ha?: number;
    fill_color?: string;
    border_color?: string;
    ph_solo?: string | number;
    v_percent?: string | number;
    materia_organica?: string | number;
    fosforo?: string | number;
    potassio?: string | number;
    teor_argila?: string | number;
    silte?: string | number;
    areia?: string | number;
    canteiros?: Canteiro[];
    tipo?: string;
}

interface TalhaoDetailsDrawerProps {
    open: boolean;
    onClose: () => void;
    talhao: Talhao | null;
    onDeleteCanteiro: (id: string | number) => void;
    onUpdateCanteiro: (id: string | number, data: any) => void;
    onCreateCanteiros: (data: any) => void;
    onDeleteTalhao?: (id: string | number) => void;
    onUpdateTalhao?: (id: string | number, data: any) => void;
    onEditMap?: () => void;
}

const TalhaoDetailsDrawer: React.FC<TalhaoDetailsDrawerProps> = ({
    open, onClose, talhao, onDeleteCanteiro, onUpdateCanteiro, onCreateCanteiros, onDeleteTalhao, onUpdateTalhao, onEditMap
}) => {
    const [tabIndex, setTabIndex] = useState(0);
    // No celular o card mostra resumo e ação; abas e conteúdo abrem sob demanda.
    // Enquanto tudo vivia dentro do card, sempre havia um talhão que estourava a
    // altura da tela e o painel voltava a rolar. No desktop não existe: lá o
    // conteúdo é sempre inline.
    const [verDetalhes, setVerDetalhes] = useState(false);
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
        setVerDetalhes(false);
    }, [talhao?.id]);

    useEffect(() => {
        if (talhao) {
            setFormData({
                ph_solo: String(talhao.ph_solo ?? ''), v_percent: String(talhao.v_percent ?? ''), materia_organica: String(talhao.materia_organica ?? ''),
                fosforo: String(talhao.fosforo ?? ''), potassio: String(talhao.potassio ?? ''), teor_argila: String(talhao.teor_argila ?? ''),
                silte: String(talhao.silte ?? ''), areia: String(talhao.areia ?? '')
            });
            setTalhaoEditData({
                nome: talhao.nome || '', cultura: talhao.cultura || '',
                fillColor: talhao.fill_color || '#10B981',
                borderColor: talhao.border_color || '#059669'
            });
        }
    }, [talhao]);

    // --- Specialized Empty State Illustration ---
    const EmptyStateIllustration = () => (
        <div className="flex flex-col items-center justify-center py-5 md:py-10 px-4 text-center">
            <div className="relative w-20 h-20 md:w-32 md:h-32 mb-4 md:mb-8">
                {/* Background minimalist elements */}
                <div className="absolute inset-0 bg-emerald-500/5 rounded-full scale-150 blur-3xl animate-pulse" />
                <div className="absolute top-0 left-0 w-full h-full border border-emerald-500/10 rounded-[35%] rotate-12 scale-110" />
                <div className="absolute top-0 left-0 w-full h-full border border-teal-500/5 rounded-[45%] -rotate-12 scale-125" />
                
                {/* Main Icons with layered opacities */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <TreePine className="text-slate-900/10 w-16 h-16 -translate-x-6 translate-y-3" />
                    <Sprout className="text-emerald-600/50 w-22 h-22 -translate-y-4 relative z-10" />
                    <Droplets className="text-blue-400/20 w-12 h-12 translate-x-10 translate-y-8" />
                </div>
            </div>

            {!talhao?.geometry ? (
                <>
                    <h4 className="font-outfit text-xl font-black text-slate-900 mb-2">Falta demarcar a área</h4>
                    <p className="font-sans text-sm text-slate-400 max-w-[260px] leading-relaxed mb-6">
                        O talhão "{talhao?.nome}" ainda não foi desenhado no mapa. Sem a área demarcada, não é possível criar estruturas.
                    </p>
                    <button 
                        onClick={() => {
                            onClose();
                            setTimeout(() => document.getElementById('btn-draw-talhao')?.click(), 100);
                        }}
                        className="bg-emerald-600 text-white font-black uppercase tracking-widest text-xs px-6 py-3.5 rounded-2xl shadow-lg shadow-emerald-500/30 hover:bg-emerald-500 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Pencil size={16} />
                        Demarcar Área no Mapa
                    </button>
                </>
            ) : (
                <>
                    <h4 className="font-outfit text-xl font-black text-slate-900 mb-2">Solo pronto para o plantio</h4>
                    <p className="font-sans text-sm text-slate-400 max-w-[260px] leading-relaxed">
                        Este talhão ainda não possui estruturas definidas. Vamos começar a organizar sua produção?
                    </p>
                </>
            )}
        </div>
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        if (!onUpdateTalhao || !talhao) return;
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
        if (!onUpdateTalhao || !talhao) return;
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
        setSaving(true);
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
        } finally {
            setSaving(false);
        }
    };

    const handleBatchSave = async () => {
        if (!onCreateCanteiros || !talhao) return;
        setSaving(true);
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
            setSnackbar({ open: true, message: 'Estrutura criada!', severity: 'success' });
        } catch (error) {
            setSnackbar({ open: true, message: 'Erro ao criar.', severity: 'error' });
        } finally {
            setSaving(false);
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
        <div className="talhao-details-container font-sans text-slate-900">
            {/* No desktop o painel fica à DIREITA. Tentamos a esquerda para acompanhar
                o desenho, mas lá o espaço já é do menu lateral: o painel cobria os
                cards do croqui e os controles de zoom. O lado livre é este — as
                camadas do mapa é que foram para a esquerda. */}
            <div className={cn("fixed inset-x-0 bottom-0 md:inset-y-0 md:right-8 md:left-auto md:max-w-md z-[2000] pointer-events-none transition-all duration-500 flex items-start md:items-center p-3 pt-[4.75rem] md:p-0", open ? "visible" : "invisible")}>
                <div className={cn(
                    // Passo 1 do alinhamento visual: branco sólido em vez de vidro,
                    // cantos de 26px e sombra baixa e difusa — os mesmos valores do
                    // painel de camadas e dos cards do croqui. O vidro com 48px de
                    // raio era a única superfície do app com essa linguagem.
                    "relative bg-white shadow-[0_30px_70px_-28px_rgba(15,23,42,0.6)] flex flex-col overflow-hidden transition-all duration-500 transform pointer-events-auto",
                    "md:w-[28rem] md:rounded-[26px] md:max-h-[94vh] md:border md:border-slate-100",
                    // No celular o card começa logo abaixo do botão de camadas (4,75rem
                    // = os 16px do topo, os 44px do botão e um respiro) e vai até
                    // a margem de baixo. Centralizar deixava um vão grande no topo
                    // e, pior, espremia a altura a ponto de o conteúdo rolar.
                    "relative w-full rounded-[26px]",
                    // Resumo: altura pelo conteúdo, o mapa continua visível atrás.
                    // Detalhes: usa toda a altura disponível abaixo do botão de
                    // camadas, que é onde a rolagem faz sentido.
                    verDetalhes ? "h-[calc(100vh-5.75rem)]" : "h-auto max-h-[calc(100vh-5.75rem)]",
                    open ? "translate-y-0 md:translate-x-0 opacity-100" : "translate-y-8 md:translate-x-12 opacity-0"
                )}>
                    {/* Glass Header */}
                    <div className="relative shrink-0">
                        {/* Mobile Handle Indicator */}
                        <div className="md:hidden w-full flex justify-center pt-4 pb-1">
                            <div className="w-14 h-1.5 bg-emerald-600/10 rounded-full" />
                        </div>
                        
                        <div className="flex items-center gap-3 p-5 md:p-6 shrink-0 bg-transparent">
                            <div
                                className="w-[46px] h-[46px] rounded-full flex items-center justify-center shrink-0 shadow-[0_8px_20px_-8px_rgba(5,150,105,0.7)]"
                                style={{ backgroundColor: talhao.fill_color || '#059669' }}
                            >
                                {getIcon(talhao.nome, '#ffffff')}
                            </div>
                            <div className="flex-1 overflow-hidden min-w-0 pt-1">
                                {isEditingTalhao ? (
                                    <input autoFocus value={talhaoEditData.nome} onChange={e=>setTalhaoEditData({...talhaoEditData, nome: e.target.value})} className="w-full font-outfit text-xl font-black bg-white/50 border-b-2 border-emerald-500 outline-none px-1 py-0.5" />
                                ) : (
                                    <>
                                        <h3 className="font-outfit text-[19px] font-extrabold text-slate-900 leading-tight truncate tracking-tight">{talhao.nome || "Talhão"}</h3>
                                        <p className="font-sans text-[13px] font-semibold text-slate-400 mt-0.5 truncate">
                                            {talhao.cultura || "Sem cultura definida"}
                                        </p>
                                    </>
                                )}
                            </div>
                            <div className="flex items-center gap-2 px-1">
                                {!isEditingTalhao ? (
                                    <>
                                        <button 
                                            onClick={() => {
                                                if (onEditMap) onEditMap();
                                            }} 
                                            className="w-9 h-9 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded-full hover:bg-emerald-100 transition-all cursor-pointer"
                                            title="Editar área no mapa"
                                            aria-label="Editar área no mapa"
                                        >
                                            <Map size={16} strokeWidth={2.5} />
                                        </button>
                                        <button 
                                            onClick={() => setIsEditingTalhao(true)} 
                                            className="w-9 h-9 flex items-center justify-center text-slate-500 bg-slate-100 rounded-full hover:text-slate-900 hover:bg-slate-200 transition-all cursor-pointer"
                                            title="Editar"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button 
                                            onClick={() => setShowDeleteTalhaoConfirm(true)} 
                                            className="w-9 h-9 flex items-center justify-center text-red-500 bg-red-50 rounded-full hover:bg-red-100 transition-all cursor-pointer"
                                            title="Excluir"
                                        >
                                            <Trash size={18} />
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        onClick={handleSaveTalhaoHeader} 
                                        disabled={saving}
                                        className="w-9 h-9 flex items-center justify-center text-white bg-emerald-600 rounded-full shadow-[0_8px_20px_-8px_rgba(5,150,105,0.8)] hover:bg-emerald-700 transition-all cursor-pointer disabled:opacity-50"
                                        title="Salvar"
                                    >
                                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                    </button>
                                )}
                                <button 
                                    onClick={onClose} 
                                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all cursor-pointer"
                                    title="Fechar"
                                >
                                    <X size={26} strokeWidth={2.5} />
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Resumo do talhão: os números que o produtor procura primeiro,
                        antes de decidir em qual aba entrar. */}
                    <div className="px-6 md:px-8 mb-5 shrink-0">
                        <div className="grid grid-cols-3 gap-2.5">
                            <div className="border border-slate-200 rounded-[18px] px-4 py-3.5 flex flex-col gap-1">
                                <span className="font-outfit text-[21px] font-extrabold text-slate-900 leading-none tracking-tight">
                                    {areaFormatada}<span className="text-xs font-bold text-slate-400 ml-1">ha</span>
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Área</span>
                            </div>
                            <div className="border border-slate-200 rounded-[18px] px-4 py-3.5 flex flex-col gap-1">
                                <span className="font-outfit text-[21px] font-extrabold text-slate-900 leading-none tracking-tight">
                                    {talhao.canteiros?.length ?? 0}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estruturas</span>
                            </div>
                            <div className="border border-slate-200 rounded-[18px] px-4 py-3.5 flex flex-col gap-1">
                                <span className="font-outfit text-[21px] font-extrabold text-slate-900 leading-none tracking-tight">
                                    {talhao.ph_solo ? String(talhao.ph_solo) : '—'}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">pH solo</span>
                            </div>
                        </div>
                    </div>

                    {/* Ação principal do celular: abre abas e conteúdo. */}
                    {!verDetalhes && (
                        <div className="px-6 pb-6 shrink-0 md:hidden">
                            <button
                                onClick={() => setVerDetalhes(true)}
                                className="w-full py-4 rounded-[18px] bg-emerald-600 text-white font-outfit text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2.5 active:scale-[0.98] transition-transform"
                            >
                                <LayoutGrid size={16} strokeWidth={2.5} />
                                Ver estruturas e solo
                            </button>
                        </div>
                    )}

                    {/* Voltar ao resumo, no celular. */}
                    {verDetalhes && (
                        <div className="px-6 pb-4 shrink-0 md:hidden">
                            <button
                                onClick={() => setVerDetalhes(false)}
                                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <ChevronLeft size={14} strokeWidth={3} />
                                Voltar ao resumo
                            </button>
                        </div>
                    )}

                    {/* Premium Segmented Control Tabs */}
                    <div className={cn("px-6 md:px-8 mb-6 shrink-0", verDetalhes ? "block" : "hidden md:block")}>
                        <div className="flex bg-slate-100 p-1 rounded-full gap-1">
                            <button onClick={() => setTabIndex(0)} className={cn(
                                "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-full transition-all",
                                tabIndex === 0 ? "bg-white text-slate-900 shadow-[0_6px_18px_-8px_rgba(15,23,42,0.35)]" : "text-slate-400 hover:text-slate-500"
                            )}>
                                <LayoutGrid size={14} strokeWidth={2.5} /> Estrutura
                            </button>
                            <button onClick={() => setTabIndex(1)} className={cn(
                                "flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-full transition-all",
                                tabIndex === 1 ? "bg-white text-slate-900 shadow-[0_6px_18px_-8px_rgba(15,23,42,0.35)]" : "text-slate-400 hover:text-slate-500"
                            )}>
                                <FlaskConical size={14} strokeWidth={2.5} /> Saúde Solo
                            </button>
                        </div>
                    </div>

                    <div className={cn("flex-1 overflow-y-auto px-6 md:px-8 pb-8 scrollbar-hidden", verDetalhes ? "block" : "hidden md:block")}>
                        {tabIndex === 0 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                {talhao.canteiros?.length === 0 ? (
                                    <EmptyStateIllustration />
                                ) : (
                                    talhao.canteiros?.map((c: any) => (
                                        <div key={c.id} className="p-5 bg-white border border-slate-200/60 rounded-[18px] flex items-center justify-between group transition-all duration-300 hover:border-emerald-200 hover:shadow-[0_12px_24px_-8px_rgba(16,185,129,0.1)] hover:-translate-y-0.5">
                                            <div className="flex items-center gap-5">
                                                <div className="w-14 h-14 bg-slate-50 rounded-[14px] flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-100/50 transition-colors shadow-sm">
                                                    {getIcon(c.nome)}
                                                </div>
                                                <div>
                                                    <h4 className="font-outfit text-base font-black text-slate-900 tracking-tight">{c.nome}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="font-sans text-[10px] text-slate-400 font-bold uppercase tracking-wider">{c.largura_metros}m <span className="text-slate-300">×</span> {c.comprimento_metros}m</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                        <span className="font-sans text-[10px] text-emerald-600/70 font-black uppercase tracking-wider">Ativo</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                                                <button 
                                                    onClick={(e)=>{
                                                        e.stopPropagation();
                                                        handleStartEditCanteiro(c);
                                                    }} 
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-white rounded-[14px] shadow-sm transform hover:scale-110 active:scale-95 transition-all border border-transparent hover:border-slate-100"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button 
                                                    onClick={(e)=>{
                                                        e.stopPropagation();
                                                        onDeleteCanteiro(c.id);
                                                    }} 
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-[14px] shadow-sm transform hover:scale-110 active:scale-95 transition-all border border-transparent hover:border-slate-100"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}

                                {/* Forest-to-DeepSea CTA Button with Glow and Golden Accents */}
                                <button
                                    onClick={()=>setCreateModalOpen(true)}
                                    className="w-full py-4 mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-outfit font-extrabold text-xs uppercase tracking-widest rounded-[18px] shadow-[0_12px_28px_-12px_rgba(5,150,105,0.9)] flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all"
                                >
                                    <Plus size={16} strokeWidth={3} />
                                    Nova estrutura
                                </button>
                            </div>
                        )}

                        {tabIndex === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Physical Composition Card - Premium Glass */}
                                <div className="bg-white border border-slate-200/60 rounded-[26px] p-8 shadow-soft relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                                        <Layers size={80} strokeWidth={1} />
                                    </div>
                                    
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-emerald-500/10 rounded-[18px] flex items-center justify-center border border-emerald-500/20">
                                            <Layers size={22} className="text-emerald-700" />
                                        </div>
                                        <div>
                                            <p className="font-sans text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Composição Física</p>
                                            <h4 className="font-outfit text-xl font-black text-slate-900">{classificacao || 'Analisando...'}</h4>
                                        </div>
                                    </div>
                                    
                                    {/* Segmented Bar with Premium Look */}
                                    <div className="h-5 w-full bg-slate-100/80 rounded-full overflow-hidden flex p-1 border border-slate-200/30 mb-8 items-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
                                        <div className="h-full bg-emerald-600 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(5,150,105,0.4)]" style={{ width: `${Math.min(100, (argila/baseEsperada)*100)}%` }} />
                                        <div className="h-full bg-amber-400 rounded-full transition-all duration-1000 delay-200 shadow-[0_0_12px_rgba(251,191,36,0.3)] mx-0.5" style={{ width: `${Math.min(100, (silte/baseEsperada)*100)}%` }} />
                                        <div className="h-full bg-sky-400 rounded-full transition-all duration-1000 delay-400 shadow-[0_0_12px_rgba(56,189,248,0.3)]" style={{ width: `${Math.min(100, (areia/baseEsperada)*100)}%` }} />
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'Argila', val: argila, color: 'bg-emerald-500' },
                                            { label: 'Silte', val: silte, color: 'bg-amber-400' },
                                            { label: 'Areia', val: areia, color: 'bg-sky-400' }
                                        ].map(item => (
                                            <div key={item.label} className="text-center bg-slate-50/50 py-3 rounded-2xl border border-slate-100/50">
                                                <div className={cn("w-1.5 h-1.5 rounded-full mx-auto mb-1.5 shadow-sm", item.color)} />
                                                <p className="font-sans text-[9px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
                                                <p className="font-outfit text-sm font-black text-slate-900">{item.val}%</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* CHEMICAL METRICS - BENTO GRID REFACTORED */}
                                <div className="grid grid-cols-2 gap-4 pb-2">
                                    {[
                                        { l: 'pH Solo', v: formData.ph_solo, u: 'CaCl2', i: <FlaskConical size={16} />, c: 'emerald', s: Number(formData.ph_solo) >= 6 && Number(formData.ph_solo) <= 7 ? 'Ideal' : 'Corrigir' },
                                        { l: 'V % Sat.', v: formData.v_percent, u: '%', i: <Droplets size={16} />, c: 'sky', s: Number(formData.v_percent) >= 60 ? 'Ideal' : 'Baixo' },
                                        { l: 'Mat. Org.', v: formData.materia_organica, u: 'g/dm³', i: <Layers size={16} />, c: 'amber', s: Number(formData.materia_organica) >= 2.5 ? 'Ideal' : 'Baixo' },
                                        { l: 'Fósforo', v: formData.fosforo, u: 'mg', i: <Sprout size={16} />, c: 'emerald', s: Number(formData.fosforo) >= 20 ? 'Ideal' : 'Baixo' }
                                    ].map((m, i) => (
                                        <div key={i} className="group relative bg-white border border-slate-200/60 p-6 rounded-[26px] transition-all duration-300 hover:shadow-[0_20px_40px_-16px_rgba(0,0,0,0.08)] hover:-translate-y-1 overflow-hidden">
                                            <div className="absolute -top-4 -right-4 w-16 h-16 bg-slate-50 rounded-full group-hover:scale-150 transition-transform duration-500 opacity-20" />
                                            
                                            <div className="flex items-center justify-between mb-5 relative z-10">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-[14px] flex items-center justify-center shadow-sm",
                                                    m.c === 'emerald' ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50" : m.c === 'sky' ? "bg-sky-50 text-sky-600 border border-sky-100/50" : "bg-amber-50 text-amber-600 border border-amber-100/50"
                                                )}>
                                                    {m.i}
                                                </div>
                                                <span className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full",
                                                    m.s === 'Ideal' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                                                )}>{m.s}</span>
                                            </div>
                                            
                                            <div className="relative z-10">
                                                <h5 className="font-outfit text-[28px] font-extrabold text-slate-900 tracking-tight">
                                                    {m.v || '--'}
                                                </h5>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="font-sans text-[10px] font-black text-slate-400/80 uppercase tracking-widest">{m.l}</span>
                                                    <span className="font-sans text-[9px] font-bold text-slate-300">({m.u})</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button onClick={()=>setIsEditing(true)} className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-900 font-outfit font-black text-[11px] uppercase tracking-widest rounded-[18px] transition-all border border-slate-200 flex items-center justify-center gap-2 group">
                                    <Pencil size={14} className="group-hover:rotate-12 transition-transform" />
                                    Editar Análise Completa
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isEditing && (
                <div className="fixed inset-0 z-[3000] flex md:items-center items-end justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg md:rounded-[26px] rounded-t-[40px] p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90dvh] md:max-h-[90vh] [&::-webkit-scrollbar]:hidden animate-in slide-in-from-bottom-10 duration-500">
                        {/* Mobile Handle */}
                        <div className="md:hidden w-full flex justify-center pb-6">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                        </div>
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
                        <div className="mt-10 flex gap-4">
                            <button onClick={()=>setIsEditing(false)} className="flex-1 py-4 font-black text-slate-400">Cancelar</button>
                            <button 
                                onClick={handleSave} 
                                disabled={saving}
                                className="flex-[2] py-4 bg-emerald-600 text-white font-black rounded-2xl shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving && <Loader2 size={16} className="animate-spin" />}
                                {saving ? 'Salvando...' : 'Salvar Dados'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingCanteiroId && (
                <div className="fixed inset-0 z-[3000] flex md:items-center items-end justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md md:rounded-[26px] rounded-t-[40px] p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
                        {/* Mobile Handle */}
                        <div className="md:hidden w-full flex justify-center pb-6">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                        </div>
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
                            <button 
                                onClick={handleSaveCanteiroEdit} 
                                disabled={saving}
                                className="flex-[1.5] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving && <Loader2 size={16} className="animate-spin" />}
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteTalhaoConfirm && (
                <div className="fixed inset-0 z-[3000] flex md:items-center items-end justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md animate-in zoom-in duration-300">
                    <div className="bg-white w-full max-w-sm md:rounded-[26px] rounded-t-[40px] p-6 md:p-8 shadow-2xl text-center animate-in slide-in-from-bottom-10 duration-500">
                        {/* Mobile Handle */}
                        <div className="md:hidden w-full flex justify-center pb-6">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full" />
                        </div>
                        <div className="w-20 h-20 bg-red-50 rounded-[18px] flex items-center justify-center mx-auto mb-6">
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
                <div className="fixed inset-0 z-[3000] flex md:items-center items-end justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-md">
                    <div className="bg-white w-full max-w-md md:rounded-[26px] rounded-t-[40px] p-6 md:p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
                        {/* Mobile Handle */}
                        <div className="md:hidden w-full flex justify-center pb-6">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-8">Nova Estrutura</h3>
                        <div className="space-y-6">
                            <input className="w-full bg-slate-50 border p-4 rounded-2xl font-black" value={batchData.baseName} onChange={e=>setBatchData({...batchData, baseName: e.target.value})} placeholder="Nome (ex: Canteiro 1)" />
                            <div className="grid grid-cols-2 gap-4">
                                <input className="bg-slate-50 border p-4 rounded-2xl text-center font-black" value={batchData.width} onChange={e=>setBatchData({...batchData, width: e.target.value})} placeholder="Largura" />
                                <input className="bg-slate-50 border p-4 rounded-2xl text-center font-black" value={batchData.length} onChange={e=>setBatchData({...batchData, length: e.target.value})} placeholder="Comp." />
                            </div>
                        </div>
                        <button 
                            onClick={handleBatchSave} 
                            disabled={saving}
                            className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl mt-8 shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 size={18} className="animate-spin" />}
                            {saving ? 'Criando...' : 'Criar Estrutura'}
                        </button>
                        <button onClick={()=>setCreateModalOpen(false)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-xs">Descartar</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TalhaoDetailsDrawer;
