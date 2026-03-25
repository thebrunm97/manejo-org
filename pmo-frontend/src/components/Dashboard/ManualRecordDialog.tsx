/**
 * @file ManualRecordDialog.tsx
 * @description Dialog component for creating and editing field diary records.
 * 
 * REFACTORED: Implementation using Tailwind CSS and native HTML elements.
 * Removed Material UI dependencies.
 * 
 * LATEST FIX: Applied strict structure to fix layout issues (overlay fusing with modal).
 */
import React, { useState, useCallback, useRef } from 'react';
import {
    Sprout,
    FlaskConical,
    Scissors,
    Package,
    MapPin,
    X,
    AlertTriangle,
    Sparkles,
    Recycle,
    ShoppingCart,
    DollarSign,
    Check
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuthProfile } from '../../context/AuthContext';
import LocationSelectorDialog from '../Common/LocationSelectorDialog';
import {
    ActivityType,
    UnitType,
    CadernoEntry,
    DetalhesPlantio,
    DetalhesManejo,
    DetalhesColheita,
    DetalhesVenda,
    DetalhesCompostagem,
    CadernoCampoRecord,
    ManejoSubtype
} from '../../types/CadernoTypes';

import {
    useRecordValidation,
    useRecordFormState,
    CommonDraft,
    PlantioDraft,
    ManejoDraft,
    ColheitaDraft,
    LimpezaDraft,
    CompostagemDraft,
    ComprasDraft,
    VendasDraft
} from '../../hooks/manual-record';
import { useCadernoOfflineLogic } from '../../hooks/offline/useCadernoOfflineLogic';

// --- Tab Components ---
import PlantioTab from './ManualRecord/Tabs/PlantioTab';
import ManejoTab from './ManualRecord/Tabs/ManejoTab';
import ColheitaTab from './ManualRecord/Tabs/ColheitaTab';
import OutroTab from './ManualRecord/Tabs/OutroTab';
import LimpezaTab from './ManualRecord/Tabs/LimpezaTab';
import CompostagemTab from './ManualRecord/Tabs/CompostagemTab';
import ComprasTab from './ManualRecord/Tabs/ComprasTab';
import VendasTab from './ManualRecord/Tabs/VendasTab';

// --- Component Props ---
interface ManualRecordDialogProps {
    open: boolean;
    onClose: () => void;
    recordToEdit?: CadernoCampoRecord | null;
    onRecordSaved: () => void;
}

const ManualRecordDialog: React.FC<ManualRecordDialogProps> = ({
    open,
    onClose,
    recordToEdit,
    onRecordSaved
}) => {
    // --- Custom Hooks ---
    const {
        activeTab,
        isEditMode,
        plantioDraft,
        manejoDraft,
        colheitaDraft,
        outroDraft,
        limpezaDraft,
        compostagemDraft,
        comprasDraft,
        vendasDraft,
        setActiveTab,
        getCurrentDraft,
        updateDraft: updateDraftBase,
        clearDraft
    } = useRecordFormState({ open, recordToEdit });

    const { pmoAtivoId } = useAuthProfile();
    const pmoId = pmoAtivoId ? Number(pmoAtivoId) : 0;

    const {
        validate,
        errors,
        clearError,
        clearAllErrors,
        organicWarning,
        checkInsumoOrganico
    } = useRecordValidation();

    const { saveRecord } = useCadernoOfflineLogic();

    // --- Local UI State ---
    const [loading, setLoading] = useState(false);
    const [openJustification, setOpenJustification] = useState(false);
    const [justificativa, setJustificativa] = useState('');
    const [openLocation, setOpenLocation] = useState(false);
    
    // --- Tabs Dragging Logic ---
    const tabsRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        if (tabsRef.current) {
            setStartX(e.pageX - tabsRef.current.offsetLeft);
            setScrollLeft(tabsRef.current.scrollLeft);
        }
    };

    const handleMouseLeaveOrUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !tabsRef.current) return;
        e.preventDefault();
        const x = e.pageX - tabsRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        tabsRef.current.scrollLeft = scrollLeft - walk;
    };

    // --- Wrapper for updateDraft that clears errors ---
    const updateDraft = useCallback((field: string, value: any) => {
        if (errors[field]) {
            clearError(field);
        }
        updateDraftBase(field, value);
    }, [errors, clearError, updateDraftBase]);

    // --- Validation & Save Logic ---
    const handleInitialSaveClick = useCallback(() => {
        const draft = getCurrentDraft();
        const result = validate(draft, activeTab);

        if (!result.isValid) return;

        if (isEditMode) {
            setOpenJustification(true);
        } else {
            executeSave();
        }
    }, [getCurrentDraft, validate, activeTab, isEditMode]);

    const executeSave = useCallback(async () => {
        setLoading(true);
        try {
            const draft = getCurrentDraft();

            // Base Payload
            const payloadBase = {
                id: isEditMode && recordToEdit ? recordToEdit.id : undefined,
                pmo_id: pmoId, // INJECTED: Essential for RLS and data association
                data_registro: new Date((draft as CommonDraft).dataHora).toISOString(),
                talhao_canteiro: shouldShowLocation ? (draft as CommonDraft).locais.join('; ') : '',
                produto: (draft as CommonDraft).produto,
                observacao_original: (draft as CommonDraft).observacao || `Registro de ${activeTab.toUpperCase()}`,
            };

            let finalPayload: CadernoEntry | null = null;

            if (activeTab === 'plantio') {
                const d = draft as PlantioDraft;
                const detalhes: DetalhesPlantio = {
                    metodo_propagacao: d.metodoPropagacao as any,
                    qtd_utilizada: parseFloat(d.qtdPlantio) || 0,
                    unidade_medida: d.unidadePlantio
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.PLANTIO,
                    id: payloadBase.id!,
                    quantidade_valor: parseFloat(d.qtdPlantio) || 0,
                    quantidade_unidade: d.unidadePlantio,
                    detalhes_tecnicos: detalhes,
                    houve_descartes: d.houveDescartes,
                    qtd_descartes: d.houveDescartes ? (parseFloat(d.qtdDescartes) || 0) : undefined,
                    unidade_descartes: d.houveDescartes ? d.unidadeDescartes : undefined
                } as CadernoEntry;
            }
            else if (activeTab === 'manejo') {
                const d = draft as ManejoDraft;
                let detalhes: DetalhesManejo = {
                    subtipo: d.subtipoManejo,
                    responsavel: d.responsavel,
                    tipo_manejo: d.tipoManejo
                };

                if (d.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO) {
                    detalhes = { 
                        ...detalhes, 
                        insumo_aplicado: d.insumo, 
                        insumo: d.insumo, 
                        dosagem: d.dosagem, 
                        unidade_dosagem: d.unidadeDosagem, 
                        equipamento: d.equipamento 
                    };
                } else if (d.subtipoManejo === ManejoSubtype.HIGIENIZACAO) {
                    detalhes = { ...detalhes, item_higienizado: d.itemHigienizado, produto_utilizado: d.produtoUtilizado };
                } else {
                    detalhes = { ...detalhes, atividade: d.atividadeCultural, qtd_trabalhadores: parseInt(d.qtdTrabalhadores || '0', 10) };
                }

                let produtoRef = '';
                if (d.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO) produtoRef = d.insumo;
                else if (d.subtipoManejo === ManejoSubtype.HIGIENIZACAO) produtoRef = `${d.itemHigienizado} (${d.produtoUtilizado})`;
                else produtoRef = d.atividadeCultural;

                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.MANEJO,
                    id: payloadBase.id!,
                    produto: produtoRef || (draft as CommonDraft).produto,
                    detalhes_tecnicos: detalhes
                } as CadernoEntry;
            }
            else if (activeTab === 'colheita') {
                const d = draft as ColheitaDraft;
                const detalhes: DetalhesColheita = {
                    lote: d.lote,
                    destino: d.destino,
                    destino_inicial: d.destino_inicial,
                    classificacao: d.classificacao,
                    qtd: parseFloat(d.qtdColheita) || 0,
                    unidade: d.unidadeColheita
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.COLHEITA,
                    id: payloadBase.id!,
                    quantidade_valor: parseFloat(d.qtdColheita) || 0,
                    quantidade_unidade: d.unidadeColheita,
                    detalhes_tecnicos: detalhes,
                    houve_descartes: d.houveDescartes,
                    qtd_descartes: d.houveDescartes ? (parseFloat(d.qtdDescartes) || 0) : undefined,
                    unidade_descartes: d.houveDescartes ? d.unidadeDescartes : undefined
                } as CadernoEntry;
            }
            else if (activeTab === 'compostagem') {
                const d = draft as CompostagemDraft;
                const detalhes: DetalhesCompostagem = {
                    acao: d.acao,
                    n_pilha: d.nPilha,
                    ingredientes: d.ingredientes,
                    temperatura: parseFloat(d.temperatura) || undefined,
                    responsavel: d.responsavel
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.COMPOSTAGEM,
                    id: payloadBase.id!,
                    produto: `${d.nPilha} (${d.acao})`,
                    detalhes_tecnicos: detalhes,
                    is_pmo_compostagem: true
                } as any;
            }
            else if (activeTab === 'vendas') {
                const d = draft as VendasDraft;
                const detalhes: DetalhesVenda = {
                    destinacao: d.destinacao,
                    valor_unitario: d.valorUnitario ? parseFloat(d.valorUnitario) : undefined,
                    cliente: d.cliente,
                    nf_recibo: d.nf,
                    qtd: parseFloat(d.quantidade) || 0,
                    unidade: d.unidade
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.VENDA,
                    id: payloadBase.id!,
                    quantidade_valor: parseFloat(d.quantidade) || 0,
                    quantidade_unidade: d.unidade,
                    fornecedor: d.cliente,
                    nota_fiscal: d.nf,
                    detalhes_tecnicos: detalhes
                } as CadernoEntry;
            }
            else if (activeTab === 'compras') {
                const d = draft as ComprasDraft;
                const detalhes: any = {
                    tipo_registro: 'compra'
                };
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.INSUMO || 'Insumo',
                    id: payloadBase.id!,
                    produto: d.produto,
                    quantidade_valor: parseFloat(d.quantidade) || 0,
                    quantidade_unidade: d.unidade,
                    fornecedor: d.fornecedor,
                    nota_fiscal: d.nfRecibo,
                    detalhes_tecnicos: detalhes
                } as CadernoEntry;
            }
            else if (activeTab === 'limpeza') {
                const d = draft as LimpezaDraft;
                // Nota: Registros de limpeza vão para uma tabela SEPARADA pmo_limpeza no DB real via API,
                // mas aqui no frontend estamos simulando via CadernoEntry para manter o fluxo offline/sync.
                // O hook useCadernoOfflineLogic precisará tratar este redirecionamento.
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: 'Limpeza',
                    produto: `${d.itemArea} (${d.tipoLimpeza})`,
                    responsavel: d.responsavel,
                    // Mapeamento extra para o hook de salvamento identificar a tabela
                    is_pmo_limpeza: true, 
                    data_limpeza: new Date(d.dataHora).toISOString().split('T')[0],
                    item_area: d.itemArea,
                    tipo_limpeza: d.tipoLimpeza,
                    produto_utilizado: d.produtoUtilizado,
                    dosagem: d.dosagem,
                    observacao: d.observacao
                } as any;
            }
            else {
                // Outro: Atividade Geral de Manejo
                
                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.OUTRO,
                    id: payloadBase.id!,
                    quantidade_valor: 0,
                    quantidade_unidade: UnitType.UNID,
                    detalhes_tecnicos: { 
                        tipo_registro: 'outro', 
                        subcategoria: 'geral' 
                    }
                } as CadernoEntry;
            }

            if (!finalPayload) return;

            if (isEditMode && recordToEdit) {
                const auditTrail = `[EDITADO em ${new Date().toLocaleString('pt-BR')}] Motivo: ${justificativa}\n\n`;
                finalPayload.observacao_original = auditTrail + (finalPayload.observacao_original || '');
                if (!finalPayload.id) finalPayload.id = recordToEdit.id;
            }

            const result = await saveRecord(finalPayload);

            if (result.success) {
                clearDraft(activeTab);
                clearAllErrors();

                if (result.isOffline) {
                    toast.info(`💾 Salvo OFFLINE! ☁️❌\n\nSincronização pendente.`);
                } else {
                    toast.success("✅ Registro salvo com sucesso!");
                }

                onRecordSaved();
                onClose();
            } else {
                toast.error(`❌ Erro ao salvar: ${result.error}`);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(`💥 Erro crítico ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
            setOpenJustification(false);
        }
    }, [getCurrentDraft, activeTab, isEditMode, recordToEdit, justificativa, clearDraft, clearAllErrors, onRecordSaved, onClose, saveRecord]);

    // --- Prepare drafts for render ---
    const common = getCurrentDraft() as CommonDraft;
    const shouldShowLocation = activeTab !== 'outro' && activeTab !== 'limpeza' && activeTab !== 'compostagem' && activeTab !== 'compras' && activeTab !== 'vendas';

    // --- Derived UI vars ---
    const labelProduto =
        activeTab === 'compras' ? 'Produto Adquirido'
        : activeTab !== 'manejo'
            ? 'Cultura/Produto'
            : manejoDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO ||
                manejoDraft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL
                ? 'Cultura Alvo / Item'
                : 'Cultura/Produto';

    const labelLocais =
        activeTab !== 'manejo'
            ? 'Talhões / Canteiros'
            : manejoDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO
                ? 'Locais de aplicação (Talhões/Canteiros)'
                : manejoDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO
                    ? 'Locais / Áreas Higienizadas'
                    : 'Talhões / Canteiros';

    const handleTabClick = (e: React.MouseEvent<HTMLButtonElement>, tabId: string) => {
        if (isEditMode && activeTab !== tabId) return;
        
        setActiveTab(tabId as TipoRegistro); 
        
        e.currentTarget.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
    };

    if (!open) return null;

    return (
        /* --- 1. Estrutura Raiz do Modal (Fixed Overflow & Background) --- */
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">

            {/* --- 2. Caixa do Modal (White Background is Critical) --- */}
            <div className="relative w-[calc(100vw-2rem)] max-w-2xl md:w-full max-h-[calc(100dvh-3rem)] md:max-h-[calc(100dvh-4rem)] bg-white rounded-[24px] shadow-2xl flex flex-col overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900" id="modal-title">
                        {isEditMode ? 'Editar Registro' : 'Novo Registro'}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full p-2 transition-colors"
                    >
                        <span className="sr-only">Fechar</span>
                        <X size={24} />
                    </button>
                </div>

                  <div className="bg-white border-b border-gray-100 flex-shrink-0">
                    <nav 
                        ref={tabsRef as any}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeaveOrUp}
                        onMouseUp={handleMouseLeaveOrUp}
                        onMouseMove={handleMouseMove}
                        className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth px-10 gap-5 py-4 [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)] cursor-grab active:cursor-grabbing select-none" 
                        aria-label="Tabs" 
                        role="tablist"
                    >
                        {[
                            { id: 'plantio', label: 'Plantio', icon: Sprout, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                            { id: 'manejo', label: 'Manejo', icon: FlaskConical, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                            { id: 'colheita', label: 'Colheita', icon: Scissors, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                            { id: 'vendas', label: 'Vendas', icon: DollarSign, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                            { id: 'limpeza', label: 'Limpeza', icon: Sparkles, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                            { id: 'compostagem', label: 'Composto', icon: Recycle, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                            { id: 'compras', label: 'Compras', icon: ShoppingCart, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                            { id: 'outro', label: 'Outro', icon: Package, color: 'text-white', activeBg: 'bg-emerald-600', inactiveBg: 'bg-slate-100' },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const disabled = isEditMode && activeTab !== tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={(e) => handleTabClick(e, tab.id)}
                                    disabled={disabled}
                                    className={`
                                        inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0 snap-center scroll-mx-10
                                        ${isActive
                                            ? `${tab.activeBg} ${tab.color} shadow-lg shadow-emerald-200`
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                                        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95 active:cursor-grabbing'}
                                    `}
                                >
                                    <Icon size={22} className={isActive ? 'text-white' : 'text-slate-500'} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* --- 3. Corpo do Formulário (Scrollable Content) --- */}
                <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-4 md:p-6 pb-8 space-y-6">

                    {isEditMode && (
                        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-2 rounded-r-md">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden="true" />
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-amber-700">
                                        Você está editando um registro existente. O tipo de atividade não pode ser alterado.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Informações do Registro Card */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-5">
                        <div className="flex items-center gap-2 mb-2">
                             <div className="p-1.5 bg-emerald-100 rounded-lg">
                                <MapPin size={18} className="text-emerald-700" />
                             </div>
                             <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Informações do Registro</h4>
                        </div>

                        {/* Data & Produto */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            <div className={(activeTab === 'limpeza' || activeTab === 'compostagem') ? 'sm:col-span-2' : ''}>
                                <label htmlFor="data-hora-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Data e Hora</label>
                                <input
                                    id="data-hora-input"
                                    type="datetime-local"
                                    value={common.dataHora}
                                    onChange={e => updateDraft('dataHora', e.target.value)}
                                    className={`mt-1 block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all
                                        ${errors.data ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                    `}
                                />
                                {errors.data && <p className="mt-1 text-xs text-red-600 font-medium">{errors.data}</p>}
                            </div>

                            {activeTab !== 'limpeza' && activeTab !== 'compostagem' && !(activeTab === 'manejo' && manejoDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO) && (
                                <div>
                                    <label htmlFor="produto-input" className="block text-sm font-semibold text-slate-900 mb-1.5">{labelProduto}</label>
                                    <input
                                        id="produto-input"
                                        type="text"
                                        value={common.produto}
                                        onChange={e => updateDraft('produto', e.target.value)}
                                        placeholder="Ex: Alface Americana"
                                        className={`mt-1 block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all
                                             ${errors.produto ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                         `}
                                    />
                                    {errors.produto && <p className="mt-1 text-xs text-red-600 font-medium">{errors.produto}</p>}
                                </div>
                            )}
                        </div>

                        {/* Location Selector */}
                        {shouldShowLocation && (
                            <div>
                                <label className={`block text-sm font-semibold mb-1.5 ${errors.locais ? 'text-red-600' : 'text-slate-900'}`}>
                                    {labelLocais} {errors.locais && `(${errors.locais})`}
                                </label>
                                <div
                                    onClick={() => {
                                        setOpenLocation(true);
                                        if (errors.locais) clearError('locais');
                                    }}
                                    className={`
                                        flex flex-wrap gap-2 p-4 border border-dashed rounded-xl min-h-[64px] items-center cursor-pointer transition-all
                                        ${errors.locais ? 'border-red-300 bg-red-50' : 'border-slate-300 hover:bg-white hover:border-emerald-500 hover:shadow-md'}
                                    `}
                                >
                                    {common.locais.length === 0 && (
                                        <div className="flex items-center text-slate-500 text-sm pl-1">
                                            <MapPin size={20} className={`mr-2 ${errors.locais ? 'text-red-500' : 'text-slate-400'}`} />
                                            <span>Toque para selecionar Talhões ou Canteiros...</span>
                                        </div>
                                    )}
                                    {common.locais.map(l => (
                                        <span key={l} className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                            {l}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateDraft('locais', common.locais.filter(x => x !== l));
                                                }}
                                                className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-emerald-400 hover:bg-emerald-200 hover:text-emerald-700 focus:outline-none"
                                            >
                                                <span className="sr-only">Remover</span>
                                                <X size={14} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* --- TAB CONTENT: PLANTIO --- */}
                    {activeTab === 'plantio' && (
                        <PlantioTab
                            draft={plantioDraft}
                            updateDraft={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {/* --- TAB CONTENT: MANEJO --- */}
                    {activeTab === 'manejo' && (
                        <ManejoTab
                            draft={manejoDraft}
                            updateDraft={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                            checkInsumoOrganico={checkInsumoOrganico}
                            organicWarning={organicWarning}
                        />
                    )}

                    {/* --- TAB CONTENT: COLHEITA --- */}
                    {activeTab === 'colheita' && (
                        <ColheitaTab
                            draft={colheitaDraft}
                            updateDraft={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {/* --- TAB CONTENT: OUTRO --- */}
                    {activeTab === 'outro' && (
                        <OutroTab
                            draft={outroDraft}
                            updateDraft={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {/* --- TAB CONTENT: VENDAS --- */}
                    {activeTab === 'vendas' && (
                        <VendasTab
                            draft={vendasDraft}
                            updateDraft={updateDraft}
                        />
                    )}

                    {/* --- TAB CONTENT: LIMPEZA --- */}
                    {activeTab === 'limpeza' && (
                        <LimpezaTab
                            draft={limpezaDraft}
                            updateDraft={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {/* --- TAB CONTENT: COMPOSTAGEM --- */}
                    {activeTab === 'compostagem' && (
                        <CompostagemTab
                            draft={compostagemDraft}
                            updateDraft={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {/* --- TAB CONTENT: COMPRAS --- */}
                    {activeTab === 'compras' && (
                        <ComprasTab
                            draft={comprasDraft}
                            updateDraft={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {/* Campo de Observação Geral */}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5">
                        <label htmlFor="obs-geral" className="block text-sm font-semibold text-slate-900 mb-1.5">Observações Adicionais</label>
                        <textarea
                            id="obs-geral"
                            value={common.observacao}
                            onChange={e => updateDraft('observacao', e.target.value)}
                            rows={3}
                            placeholder="Algum detalhe extra relevante?"
                            className={`mt-1 block w-full rounded-xl shadow-sm sm:text-base px-4 py-3 border transition-all
                                 ${errors.observacao ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                             `}
                        />
                        {errors.observacao && <p className="mt-1 text-xs text-red-600 font-medium">{errors.observacao}</p>}
                    </div>

                </div>

                {/* --- 4. Rodapé com Botões (Footer) --- */}
                <div className="p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col-reverse md:flex-row md:justify-end gap-3 rounded-b-xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full md:w-auto px-6 py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleInitialSaveClick}
                        disabled={loading}
                        className={`w-full md:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 group
                            ${loading ? "opacity-70 cursor-not-allowed" : ""}
                        `}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Salvando...</span>
                            </div>
                        ) : (
                            <>
                                <Check size={18} className="transition-transform group-hover:scale-110" />
                                <span>{isEditMode ? 'Salvar Edição' : 'Salvar Registro'}</span>
                            </>
                        )}
                    </button>
                </div>

            </div>

            {/* Justification Modal (Styled with Tailwind) */}
            {openJustification && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
                    <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl flex flex-col p-6 space-y-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 sm:h-10 sm:w-10">
                                <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
                            </div>
                            <div className="ml-4 w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="justification-title">
                                    Motivo da Edição
                                </h3>
                                <div className="mt-2">
                                    <p className="text-sm text-gray-500 mb-2">
                                        Para fins de auditoria, por favor justifique o motivo desta exata alteração.
                                    </p>
                                    <textarea
                                        className="shadow-sm focus:ring-amber-500 focus:border-amber-500 block w-full sm:text-sm border-gray-300 rounded-md border p-2"
                                        rows={3}
                                        placeholder="Ex: Erro de digitação na quantidade..."
                                        value={justificativa}
                                        onChange={e => setJustificativa(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                                onClick={() => setOpenJustification(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 border border-transparent rounded-md shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50"
                                onClick={executeSave}
                                disabled={!justificativa.trim() || loading}
                            >
                                Confirmar Edição
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <LocationSelectorDialog
                open={openLocation}
                onClose={() => setOpenLocation(false)}
                onConfirm={(newLocais) => {
                    updateDraft('locais', newLocais);
                    if (errors.locais) clearError('locais');
                }}
                pmoId={pmoId}
                initialSelected={common.locais}
            />
        </div>
    );
};

const ManualRecordDialogMemo = React.memo(ManualRecordDialog);
export default ManualRecordDialogMemo;
