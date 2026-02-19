/**
 * @file ManualRecordDialog.tsx
 * @description Dialog component for creating and editing field diary records.
 * 
 * REFACTORED: Implementation using Tailwind CSS and native HTML elements.
 * Removed Material UI dependencies.
 * 
 * LATEST FIX: Applied strict structure to fix layout issues (overlay fusing with modal).
 */
import React, { useState, useCallback } from 'react';
import {
    Sprout,
    FlaskConical,
    Scissors,
    Package,
    MapPin,
    X,
    AlertTriangle,
    Check,
    Calendar,
    ChevronDown
} from 'lucide-react';
import LocationSelectorDialog from '../Common/LocationSelectorDialog';
import {
    ActivityType,
    UnitType,
    CadernoEntry,
    DetalhesPlantio,
    DetalhesManejo,
    DetalhesColheita,
    CadernoCampoRecord,
    ManejoSubtype
} from '../../types/CadernoTypes';

// --- Custom Hooks ---
import {
    useRecordValidation,
    useRecordFormState,
    UNIDADES_PLANTIO,
    UNIDADES_MANEJO,
    UNIDADES_COLHEITA,
    CommonDraft,
    PlantioDraft,
    ManejoDraft,
    ColheitaDraft,
    OutroDraft
} from '../../hooks/manual-record';
import { useCadernoOfflineLogic } from '../../hooks/offline/useCadernoOfflineLogic';

// --- Component Props ---
interface ManualRecordDialogProps {
    open: boolean;
    onClose: () => void;
    pmoId: number;
    recordToEdit?: CadernoCampoRecord | null;
    onRecordSaved: () => void;
}

const ManualRecordDialog: React.FC<ManualRecordDialogProps> = ({
    open,
    onClose,
    pmoId,
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
        setActiveTab,
        getCurrentDraft,
        updateDraft: updateDraftBase,
        clearDraft
    } = useRecordFormState({ open, recordToEdit });

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
                pmo_id: pmoId,
                data_registro: new Date((draft as CommonDraft).dataHora).toISOString(),
                talhao_canteiro: (draft as CommonDraft).locais.join('; '),
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
                    detalhes = { ...detalhes, insumo: d.insumo, dosagem: d.dosagem, unidade_dosagem: d.unidadeDosagem, equipamento: d.equipamento };
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
            else {
                // Outro
                const d = draft as OutroDraft;
                const detalhes: any = { ...d };

                if (d.tipoOutro === 'compra') {
                    Object.assign(detalhes, {
                        tipo_registro: 'compra',
                        quantidade: parseFloat(d.quantidade) || 0,
                        unidade: d.unidade,
                        fornecedor: d.fornecedor,
                        tipo_origem: d.tipoOrigem,
                        numero_documento: d.numeroDocumento
                    });
                } else if (d.tipoOutro === 'venda') {
                    Object.assign(detalhes, {
                        tipo_registro: 'venda',
                        quantidade: parseFloat(d.quantidade) || 0,
                        unidade: d.unidade,
                        destino: d.destinoVenda,
                        numero_documento: d.numeroDocumento
                    });
                } else {
                    Object.assign(detalhes, { tipo_registro: 'outro' });
                }

                delete detalhes.dataHora;
                delete detalhes.locais;
                delete detalhes.produto;
                delete detalhes.observacao;

                finalPayload = {
                    ...payloadBase,
                    tipo_atividade: ActivityType.OUTRO,
                    id: payloadBase.id!,
                    quantidade_valor: d.quantidade ? parseFloat(d.quantidade) : 0,
                    quantidade_unidade: d.unidade || UnitType.UNID,
                    detalhes_tecnicos: detalhes
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
                    alert(`Registro salvo OFFLINE! ☁️❌\n\nEle será sincronizado automaticamente quando a internet voltar.`);
                }

                onRecordSaved();
                onClose();
            } else {
                alert(`Erro ao salvar: ${result.error}`);
            }
        } catch (error: any) {
            console.error(error);
            alert(`Erro crítico ao salvar: ${error.message}`);
        } finally {
            setLoading(false);
            setOpenJustification(false);
        }
    }, [getCurrentDraft, activeTab, isEditMode, recordToEdit, pmoId, justificativa, clearDraft, clearAllErrors, onRecordSaved, onClose, saveRecord]);

    // --- Helper: Render Unit Select ---
    const renderUnitSelect = (
        value: UnitType | string,
        fieldName: string,
        options: UnitType[],
        label: string = "Unid"
    ) => {
        const isCustomValue = value && !options.includes(value as UnitType);
        const effectiveOptions = isCustomValue ? [value, ...options] : options;
        const safeValue = value || '';

        return (
            <div className="min-w-[100px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <div className="relative">
                    <select
                        value={safeValue}
                        onChange={e => updateDraft(fieldName, e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border bg-white appearance-none pr-8"
                    >
                        {effectiveOptions.map(opt => (
                            <option key={opt} value={opt}>
                                {opt === value && isCustomValue ? `${opt} (Legado)` : opt}
                            </option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>
        );
    };

    // --- Prepare drafts for render ---
    const currentDraft = getCurrentDraft();
    const common = currentDraft as CommonDraft;
    const pDraft = plantioDraft;
    const mDraft = manejoDraft;
    const cDraft = colheitaDraft;
    const oDraft = outroDraft;

    // --- Derived UI vars ---
    const labelProduto =
        activeTab !== 'manejo'
            ? 'Cultura/Produto'
            : mDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO ||
                mDraft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL
                ? 'Cultura Alvo'
                : 'Cultura/Produto';

    const labelLocais =
        activeTab !== 'manejo'
            ? 'Talhões / Canteiros'
            : mDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO
                ? 'Locais de aplicação (Talhões/Canteiros)'
                : mDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO
                    ? 'Locais / Áreas Higienizadas'
                    : 'Talhões / Canteiros';

    if (!open) return null;

    return (
        /* --- 1. Estrutura Raiz do Modal (Fixed Overflow & Background) --- */
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">

            {/* --- 2. Caixa do Modal (White Background is Critical) --- */}
            <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl flex flex-col max-h-full">

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

                {/* Tabs */}
                <div className="bg-white border-b border-gray-200">
                    <nav className="-mb-px flex" aria-label="Tabs">
                        {[
                            { id: 'plantio', label: 'PLANTIO', icon: Sprout, color: 'text-green-600', activeBorder: 'border-green-500' },
                            { id: 'manejo', label: 'MANEJO', icon: FlaskConical, color: 'text-blue-600', activeBorder: 'border-blue-500' },
                            { id: 'colheita', label: 'COLHEITA', icon: Scissors, color: 'text-amber-600', activeBorder: 'border-amber-500' },
                            { id: 'outro', label: 'OUTRO', icon: Package, color: 'text-gray-600', activeBorder: 'border-gray-500' },
                        ].map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const disabled = isEditMode && activeTab !== tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => !disabled && setActiveTab(tab.id as any)}
                                    disabled={disabled}
                                    className={`
                                        w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm flex flex-col items-center justify-center gap-1 transition-colors duration-200
                                        ${isActive
                                            ? `${tab.activeBorder} ${tab.color} bg-gray-50`
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'}
                                        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                    `}
                                >
                                    <Icon size={20} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* --- 3. Corpo do Formulário (Scrollable Content) --- */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

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

                    {/* Common Fields: Data & Produto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Data e Hora</label>
                            <input
                                type="datetime-local"
                                value={common.dataHora}
                                onChange={e => updateDraft('dataHora', e.target.value)}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                    ${errors.data ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'}
                                `}
                            />
                            {errors.data && <p className="mt-1 text-xs text-red-600">{errors.data}</p>}
                        </div>

                        {!(activeTab === 'manejo' && mDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO) && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{labelProduto}</label>
                                <input
                                    type="text"
                                    value={common.produto}
                                    onChange={e => updateDraft('produto', e.target.value)}
                                    placeholder="Ex: Alface Americana"
                                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                        ${errors.produto ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'}
                                    `}
                                />
                                {errors.produto && <p className="mt-1 text-xs text-red-600">{errors.produto}</p>}
                            </div>
                        )}
                    </div>

                    {/* Location Selector */}
                    <div>
                        <label className={`block text-xs font-bold uppercase mb-1 ${errors.locais ? 'text-red-600' : 'text-gray-500'}`}>
                            {labelLocais} {errors.locais && `(${errors.locais})`}
                        </label>
                        <div
                            onClick={() => {
                                setOpenLocation(true);
                                if (errors.locais) clearError('locais');
                            }}
                            className={`
                                flex flex-wrap gap-2 p-3 border border-dashed rounded-md min-h-[60px] items-center cursor-pointer transition-colors
                                ${errors.locais ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:bg-gray-50 hover:border-green-500'}
                            `}
                        >
                            {common.locais.length === 0 && (
                                <div className="flex items-center text-gray-500 text-sm pl-1">
                                    <MapPin size={18} className={`mr-2 ${errors.locais ? 'text-red-500' : 'text-gray-400'}`} />
                                    <span>Clique para selecionar Talhões ou Canteiros...</span>
                                </div>
                            )}
                            {common.locais.map(l => (
                                <span key={l} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                    {l}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            updateDraft('locais', common.locais.filter(x => x !== l));
                                        }}
                                        className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-green-400 hover:bg-green-200 hover:text-green-600 focus:outline-none"
                                    >
                                        <span className="sr-only">Remover</span>
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* --- TAB CONTENT: PLANTIO --- */}
                    {activeTab === 'plantio' && (
                        <div className="p-4 bg-green-50 rounded-lg border border-green-100 space-y-4 shadow-sm">
                            <h4 className="text-sm font-bold text-green-800 uppercase tracking-wide flex items-center gap-2">
                                <Sprout size={16} /> Detalhes do Plantio
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                                    <select
                                        value={pDraft.metodoPropagacao}
                                        onChange={e => updateDraft('metodoPropagacao', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border bg-white"
                                    >
                                        <option value="Muda">Muda (Transplante)</option>
                                        <option value="Semente">Semente (Semeadura)</option>
                                        <option value="Estaca">Estaca/Bulbo</option>
                                    </select>
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                                    <input
                                        type="number"
                                        value={pDraft.qtdPlantio}
                                        onChange={e => updateDraft('qtdPlantio', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border"
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    {renderUnitSelect(pDraft.unidadePlantio, 'unidadePlantio', UNIDADES_PLANTIO)}
                                </div>
                            </div>

                            {/* Perda / Descarte */}
                            <div className="space-y-2 pt-2 border-t border-green-200">
                                <div className="flex items-center">
                                    <input
                                        id="houveDescartes"
                                        type="checkbox"
                                        checked={pDraft.houveDescartes}
                                        onChange={e => updateDraft('houveDescartes', e.target.checked)}
                                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="houveDescartes" className="ml-2 block text-sm text-gray-900 cursor-pointer select-none">
                                        Houve descartes (perdas) no plantio?
                                    </label>
                                </div>

                                {pDraft.houveDescartes && (
                                    <div className="pl-6 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Descartes</label>
                                            <input
                                                type="number"
                                                value={pDraft.qtdDescartes}
                                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                    ${errors.qtdDescartes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'}
                                                `}
                                            />
                                            {errors.qtdDescartes && <p className="mt-1 text-xs text-red-600">{errors.qtdDescartes}</p>}
                                        </div>
                                        <div>
                                            {renderUnitSelect(
                                                pDraft.unidadeDescartes,
                                                'unidadeDescartes',
                                                UNIDADES_PLANTIO,
                                                "Unid."
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- TAB CONTENT: MANEJO --- */}
                    {activeTab === 'manejo' && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4 shadow-sm">
                            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide flex items-center gap-2">
                                <FlaskConical size={16} /> Operação de Manejo
                            </h4>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Operação</label>
                                <select
                                    value={mDraft.subtipoManejo}
                                    onChange={(e) => updateDraft('subtipoManejo', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white"
                                >
                                    <option value={ManejoSubtype.MANEJO_CULTURAL}>Manejo Cultural</option>
                                    <option value={ManejoSubtype.APLICACAO_INSUMO}>Aplicação de Insumos</option>
                                    <option value={ManejoSubtype.HIGIENIZACAO}>Higienização</option>
                                </select>
                            </div>

                            <p className="text-xs text-gray-500 italic border-l-2 border-blue-200 pl-2">
                                Preencha os dados abaixo conforme a operação:
                            </p>

                            {mDraft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Insumo Utilizado</label>
                                            <input
                                                type="text"
                                                value={mDraft.insumo}
                                                onChange={e => {
                                                    updateDraft('insumo', e.target.value);
                                                    checkInsumoOrganico(e.target.value);
                                                }}
                                                placeholder="Ex: Bokashi, Calda Bordalesa"
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                    ${errors.insumo ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                                                `}
                                            />
                                            {errors.insumo && <p className="mt-1 text-xs text-red-600">{errors.insumo}</p>}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Equipamento</label>
                                            <input
                                                type="text"
                                                value={mDraft.equipamento}
                                                onChange={e => updateDraft('equipamento', e.target.value)}
                                                placeholder="Ex: Pulverizador Costal"
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                            />
                                        </div>
                                    </div>

                                    {organicWarning && (
                                        <div className="bg-amber-50 border-l-4 border-amber-400 p-2 rounded-r-md">
                                            <p className="text-xs text-amber-700">{organicWarning.msg}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Dosagem</label>
                                            <input
                                                type="text"
                                                value={mDraft.dosagem}
                                                onChange={e => updateDraft('dosagem', e.target.value)}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                    ${errors.dosagem ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                                                `}
                                            />
                                            {errors.dosagem && <p className="mt-1 text-xs text-red-600">{errors.dosagem}</p>}
                                        </div>
                                        <div>
                                            {renderUnitSelect(mDraft.unidadeDosagem, 'unidadeDosagem', UNIDADES_MANEJO)}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoria (Opcional)</label>
                                        <select
                                            value={mDraft.tipoManejo}
                                            onChange={e => updateDraft('tipoManejo', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white"
                                        >
                                            <option value="Adubação">Adubação</option>
                                            <option value="Fitossanitário">Fitossanitário</option>
                                            <option value="Irrigação">Irrigação</option>
                                            <option value="Outro">Outro</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {mDraft.subtipoManejo === ManejoSubtype.HIGIENIZACAO && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Item Higienizado</label>
                                        <input
                                            type="text"
                                            value={mDraft.itemHigienizado}
                                            onChange={e => updateDraft('itemHigienizado', e.target.value)}
                                            placeholder="Ex: Caixas Colheita, Ferramentas"
                                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                ${errors.itemHigienizado ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                                            `}
                                        />
                                        {errors.itemHigienizado && <p className="mt-1 text-xs text-red-600">{errors.itemHigienizado}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Produto Utilizado</label>
                                        <input
                                            type="text"
                                            value={mDraft.produtoUtilizado}
                                            onChange={e => updateDraft('produtoUtilizado', e.target.value)}
                                            placeholder="Ex: Hipoclorito, Detergente neutro"
                                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                ${errors.produtoUtilizado ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                                            `}
                                        />
                                        {errors.produtoUtilizado && <p className="mt-1 text-xs text-red-600">{errors.produtoUtilizado}</p>}
                                    </div>
                                </>
                            )}

                            {mDraft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Atividade Realizada</label>
                                        <input
                                            type="text"
                                            value={mDraft.atividadeCultural}
                                            onChange={e => updateDraft('atividadeCultural', e.target.value)}
                                            placeholder="Ex: Capina, Poda, Desbaste"
                                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                ${errors.atividadeCultural ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                                            `}
                                        />
                                        {errors.atividadeCultural && <p className="mt-1 text-xs text-red-600">{errors.atividadeCultural}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Trabalhadores</label>
                                        <input
                                            type="number"
                                            value={mDraft.qtdTrabalhadores}
                                            onChange={e => updateDraft('qtdTrabalhadores', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                        />
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Responsável Técnico / Operador</label>
                                <input
                                    type="text"
                                    value={mDraft.responsavel}
                                    onChange={e => updateDraft('responsavel', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                                />
                            </div>
                        </div>
                    )}

                    {/* --- TAB CONTENT: COLHEITA --- */}
                    {activeTab === 'colheita' && (
                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-4 shadow-sm">
                            <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wide flex items-center gap-2">
                                <Scissors size={16} /> Rastreabilidade da Colheita
                            </h4>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">LOTE (Auto-Gerado)</label>
                                <input
                                    type="text"
                                    value={cDraft.lote}
                                    onChange={e => updateDraft('lote', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border bg-gray-100 text-gray-600 cursor-not-allowed"
                                    readOnly
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Colhida</label>
                                    <input
                                        type="number"
                                        value={cDraft.qtdColheita}
                                        onChange={e => updateDraft('qtdColheita', e.target.value)}
                                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                            ${errors.qtdColheita ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-orange-500 focus:ring-orange-500'}
                                        `}
                                    />
                                    {errors.qtdColheita && <p className="mt-1 text-xs text-red-600">{errors.qtdColheita}</p>}
                                </div>
                                <div>{renderUnitSelect(cDraft.unidadeColheita, 'unidadeColheita', UNIDADES_COLHEITA)}</div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                                    <select
                                        value={cDraft.destino}
                                        onChange={e => updateDraft('destino', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border bg-white"
                                    >
                                        <option value="Mercado Interno">Mercado Interno</option>
                                        <option value="Exportação">Exportação</option>
                                        <option value="Processamento">Processamento</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Classificação</label>
                                    <select
                                        value={cDraft.classificacao}
                                        onChange={e => updateDraft('classificacao', e.target.value)}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border bg-white"
                                    >
                                        <option value="Extra">Extra</option>
                                        <option value="Primeira">Primeira</option>
                                        <option value="Segunda">Segunda</option>
                                    </select>
                                </div>
                            </div>

                            {/* Perda / Descarte Colheita */}
                            <div className="space-y-2 pt-2 border-t border-orange-200">
                                <div className="flex items-center">
                                    <input
                                        id="houveDescartesC"
                                        type="checkbox"
                                        checked={cDraft.houveDescartes}
                                        onChange={e => updateDraft('houveDescartes', e.target.checked)}
                                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                                    />
                                    <label htmlFor="houveDescartesC" className="ml-2 block text-sm text-gray-900 cursor-pointer select-none">
                                        Houve descartes (perdas) na colheita?
                                    </label>
                                </div>

                                {cDraft.houveDescartes && (
                                    <div className="pl-6 grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. Descartes</label>
                                            <input
                                                type="number"
                                                value={cDraft.qtdDescartes}
                                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                    ${errors.qtdDescartes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-orange-500 focus:ring-orange-500'}
                                                `}
                                            />
                                            {errors.qtdDescartes && <p className="mt-1 text-xs text-red-600">{errors.qtdDescartes}</p>}
                                        </div>
                                        <div>
                                            {renderUnitSelect(
                                                cDraft.unidadeDescartes,
                                                'unidadeDescartes',
                                                UNIDADES_COLHEITA,
                                                "Unid."
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* --- TAB CONTENT: OUTRO --- */}
                    {activeTab === 'outro' && (
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                                <Package size={16} /> Tipo de Registro Outro
                            </h4>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subtipo</label>
                                <select
                                    value={oDraft.tipoOutro}
                                    onChange={e => updateDraft('tipoOutro', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border bg-white"
                                >
                                    <option value="outro">Genérico / Outro</option>
                                    <option value="compra">Compra de Insumo/Produto</option>
                                    <option value="venda">Venda / Saída</option>
                                </select>
                            </div>

                            {oDraft.tipoOutro === 'compra' && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                                            <input
                                                type="number"
                                                value={oDraft.quantidade}
                                                onChange={e => updateDraft('quantidade', e.target.value)}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                    ${errors.quantidade ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                                                `}
                                            />
                                            {errors.quantidade && <p className="mt-1 text-xs text-red-600">{errors.quantidade}</p>}
                                        </div>
                                        <div>
                                            {renderUnitSelect(
                                                oDraft.unidade,
                                                'unidade',
                                                [UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON] as any[]
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                                        <input
                                            type="text"
                                            value={oDraft.fornecedor}
                                            onChange={e => updateDraft('fornecedor', e.target.value)}
                                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                ${errors.fornecedor ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                                            `}
                                        />
                                        {errors.fornecedor && <p className="mt-1 text-xs text-red-600">{errors.fornecedor}</p>}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                                            <select
                                                value={oDraft.tipoOrigem}
                                                onChange={e => updateDraft('tipoOrigem', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border bg-white"
                                            >
                                                <option value="compra">Compra</option>
                                                <option value="doação">Doação</option>
                                                <option value="produção própria">Produção Própria</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Nº. Documento / NF</label>
                                            <input
                                                type="text"
                                                value={oDraft.numeroDocumento}
                                                onChange={e => updateDraft('numeroDocumento', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {oDraft.tipoOutro === 'venda' && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade Vendida</label>
                                            <input
                                                type="number"
                                                value={oDraft.quantidade}
                                                onChange={e => updateDraft('quantidade', e.target.value)}
                                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                    ${errors.quantidade ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                                                `}
                                            />
                                            {errors.quantidade && <p className="mt-1 text-xs text-red-600">{errors.quantidade}</p>}
                                        </div>
                                        <div>
                                            {renderUnitSelect(
                                                oDraft.unidade,
                                                'unidade',
                                                [UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON] as any[]
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Destino / Cliente</label>
                                        <input
                                            type="text"
                                            value={oDraft.destinoVenda}
                                            onChange={e => updateDraft('destinoVenda', e.target.value)}
                                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                                ${errors.destinoVenda ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                                            `}
                                        />
                                        {errors.destinoVenda && <p className="mt-1 text-xs text-red-600">{errors.destinoVenda}</p>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nº. Documento / NF</label>
                                        <input
                                            type="text"
                                            value={oDraft.numeroDocumento}
                                            onChange={e => updateDraft('numeroDocumento', e.target.value)}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Campo de Observação Geral */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Observações Adicionais</label>
                        <textarea
                            value={common.observacao}
                            onChange={e => updateDraft('observacao', e.target.value)}
                            rows={3}
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                ${errors.observacao ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'}
                            `}
                        />
                        {errors.observacao && <p className="mt-1 text-xs text-red-600">{errors.observacao}</p>}
                    </div>

                </div>

                {/* --- 4. Rodapé com Botões (Footer) --- */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 rounded-b-xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleInitialSaveClick}
                        disabled={loading}
                        className={`px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 
                            ${isEditMode
                                ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500"
                                : "bg-green-600 hover:bg-green-700 focus:ring-green-500"}
                            ${loading ? "opacity-50 cursor-not-allowed" : ""}
                        `}
                    >
                        {loading ? 'Salvando...' : (isEditMode ? 'Salvar Edição' : 'Salvar Registro')}
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
