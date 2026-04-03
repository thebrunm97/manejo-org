/**
 * @file ManualRecordDialog.tsx
 * @description Dialog component for creating and editing field diary records.
 * 
 * REFACTORED: Implementation using Tailwind CSS and native HTML elements.
 * Removed Material UI dependencies.
 * 
 * LATEST FIX: Applied strict structure to fix layout issues (overlay fusing with modal).
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
    X,
    AlertTriangle,
    Sparkles,
    Recycle,
    ShoppingCart,
    DollarSign,
    Check,
    ArrowLeft,
    Sprout,
    FlaskConical,
    Scissors,
    Package
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import { useManualRecordDrafts } from '../../hooks/manual-record/useManualRecordDrafts';
import { useManualRecordSave } from '../../hooks/manual-record/useManualRecordSave';
import { useTalhaoManager } from '../../hooks/map/useTalhaoManager';
import LocationSelectorDialog from '../Common/LocationSelectorDialog';
import { 
    CadernoEntry, 
    CadernoCampoRecord
} from '../../types/CadernoTypes';
import {
    TipoRegistro,
    useRecordFormState
} from '../../hooks/manual-record';
import { useCadernoOfflineLogic } from '../../hooks/offline/useCadernoOfflineLogic';

// --- Form Components ---
import PlantioForm from './ManualRecord/Forms/PlantioForm';
import ColheitaForm from './ManualRecord/Forms/ColheitaForm';
import ManejoForm from './ManualRecord/Forms/ManejoForm';
import VendasForm from './ManualRecord/Forms/VendasForm';
import LimpezaForm from './ManualRecord/Forms/LimpezaForm';
import CompostagemForm from './ManualRecord/Forms/CompostagemForm';
import ComprasForm from './ManualRecord/Forms/ComprasForm';
import OutroForm from './ManualRecord/Forms/OutroForm';

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
        setActiveTab,
        resetAllDrafts
    } = useRecordFormState({ open, recordToEdit });

    const { pmoAtivoId, user, currentPropriedade } = useAuth();
    const pmoId = pmoAtivoId ? Number(pmoAtivoId) : 0;

    const {
        saveRecord
    } = useCadernoOfflineLogic();

    // --- Local UI State ---
    const [loading, setLoading] = useState(false);
    const [openJustification, setOpenJustification] = useState(false);
    const [justificativa, setJustificativa] = useState('');
    const [openLocation, setOpenLocation] = useState(false);
    
    const [step, setStep] = useState<1 | 2>(isEditMode ? 2 : 1);

    // Get Talhoes from Property Context (Fase 2)
    const { talhoes } = useTalhaoManager(pmoId.toString(), currentPropriedade?.id);

    // --- Logic Extraction ---
    const { 
        plantioDraft,
        manejoDraft,
        colheitaDraft,
        outroDraft,
        limpezaDraft,
        compostagemDraft,
        comprasDraft,
        vendasDraft,
        getCurrentDraft, 
        clearDraft, 
        isDraftValid, 
        updateDraft,
        errors,
        clearError,
        clearAllErrors,
        organicWarning,
        checkInsumoOrganico
    } = useManualRecordDrafts(isEditMode, recordToEdit);

    const { executeSave: executeSaveImpl } = useManualRecordSave({
        saveRecord,
        onRecordSaved,
        onClose,
        clearDraft,
        clearAllErrors,
        setLoading,
        setOpenJustification
    });

    useEffect(() => {
        if (open) {
            setStep(isEditMode ? 2 : 1);
        }
    }, [open, isEditMode]);

    // --- Actions ---
    const handleSaveClick = () => {
        if (!isDraftValid(activeTab, talhoes as any)) {
            toast.warn("⚠️ Verifique os campos obrigatórios.");
            return;
        }

        if (isEditMode) {
            setOpenJustification(true);
        } else {
            executeSave();
        }
    };

    const executeSave = useCallback(() => {
        const draft = getCurrentDraft();
        const payloadBase: Partial<CadernoEntry> = {
            data_registro: new Date(draft.dataHora).toISOString(),
            observacao_original: draft.observacao,
            propriedade_id: currentPropriedade?.id,
            pmo_id: pmoAtivoId ? Number(pmoAtivoId) : undefined,
            user_id: user?.id,
        };

        // Inject talhao_id if available (handled as any since it's not in the BaseRegistro type but accepted by API)
        if ((draft as any).talhaoId) {
            (payloadBase as any).talhao_id = Number((draft as any).talhaoId);
        }

        executeSaveImpl(
            activeTab as TipoRegistro, 
            draft, 
            payloadBase, 
            isEditMode, 
            recordToEdit || null, 
            justificativa
        );
    }, [getCurrentDraft, activeTab, currentPropriedade, user, isEditMode, recordToEdit, justificativa, executeSaveImpl]);

    const handleClose = useCallback(() => {
        resetAllDrafts();
        onClose();
    }, [onClose, resetAllDrafts]);

    const handleTabClick = (tabId: TipoRegistro) => {
        if (isEditMode && activeTab !== tabId) return;
        
        setActiveTab(tabId); 
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
                        {isEditMode ? 'Editar Registro' : (step === 1 ? 'Novo Registro' : `Novo Registro > ${(typeof activeTab === 'string' ? activeTab.charAt(0).toUpperCase() + activeTab.slice(1) : '')}`)}
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full p-2 transition-colors"
                    >
                        <span className="sr-only">Fechar</span>
                        <X size={24} />
                    </button>
                </div>

                {/* --- Step 1: Seleção da Atividade (Wizard Grid) --- */}
                {step === 1 && (
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-8 animate-in fade-in duration-300">
                        <div className="text-center mb-8 mt-4">
                            <h4 className="text-xl font-bold text-slate-800">Qual atividade você deseja registrar?</h4>
                            <p className="text-base text-slate-500 mt-1">Toque em uma das opções abaixo</p>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6 px-1 sm:px-4">
                            {[
                                { id: 'plantio', label: 'Plantio', icon: Sprout, bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', ringColor: 'hover:ring-emerald-500/50' },
                                { id: 'manejo', label: 'Manejo', icon: FlaskConical, bgColor: 'bg-blue-50', textColor: 'text-blue-700', ringColor: 'hover:ring-blue-500/50' },
                                { id: 'colheita', label: 'Colheita', icon: Scissors, bgColor: 'bg-amber-50', textColor: 'text-amber-700', ringColor: 'hover:ring-amber-500/50' },
                                { id: 'vendas', label: 'Vendas', icon: DollarSign, bgColor: 'bg-green-50', textColor: 'text-green-700', ringColor: 'hover:ring-green-500/50' },
                                { id: 'limpeza', label: 'Limpeza', icon: Sparkles, bgColor: 'bg-cyan-50', textColor: 'text-cyan-700', ringColor: 'hover:ring-cyan-500/50' },
                                { id: 'compostagem', label: 'Composto', icon: Recycle, bgColor: 'bg-lime-50', textColor: 'text-lime-700', ringColor: 'hover:ring-lime-500/50' },
                                { id: 'compras', label: 'Compras', icon: ShoppingCart, bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', ringColor: 'hover:ring-indigo-500/50' },
                                { id: 'outro', label: 'Outro', icon: Package, bgColor: 'bg-slate-100', textColor: 'text-slate-700', ringColor: 'hover:ring-slate-500/50' },
                            ].map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            handleTabClick(tab.id as TipoRegistro);
                                            setStep(2);
                                        }}
                                        className={`flex flex-col items-center justify-center p-6 sm:p-8 gap-4 rounded-[28px] cursor-pointer transition-all border-2 border-transparent active:scale-95 hover:shadow-lg ${tab.bgColor} ${tab.textColor} ${tab.ringColor}`}
                                    >
                                        <Icon size={44} strokeWidth={1.5} />
                                        <span className="font-bold text-base tracking-tight">{tab.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* --- Step 2: Corpo do Formulário (Scrollable Content) --- */}
                {step === 2 && (
                    <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-4 md:p-6 pb-8 space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">

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

                    {/* --- FORM SELECTOR --- */}
                    {activeTab === 'plantio' && (
                        <PlantioForm
                            formData={plantioDraft}
                            updateForm={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                            onOpenLocation={() => setOpenLocation(true)}
                            clearError={clearError}
                        />
                    )}

                    {activeTab === 'colheita' && (
                        <ColheitaForm
                            formData={colheitaDraft}
                            updateForm={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                            onOpenLocation={() => setOpenLocation(true)}
                            clearError={clearError}
                        />
                    )}

                    {activeTab === 'manejo' && (
                        <ManejoForm
                            formData={manejoDraft}
                            updateForm={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                            onOpenLocation={() => setOpenLocation(true)}
                            clearError={clearError}
                            checkInsumoOrganico={checkInsumoOrganico}
                            organicWarning={organicWarning}
                        />
                    )}

                    {activeTab === 'vendas' && (
                        <VendasForm
                            formData={vendasDraft}
                            updateForm={updateDraft}
                            errors={errors}
                        />
                    )}

                    {activeTab === 'limpeza' && (
                        <LimpezaForm
                            formData={limpezaDraft}
                            updateForm={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {activeTab === 'compostagem' && (
                        <CompostagemForm
                            formData={compostagemDraft}
                            updateForm={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {activeTab === 'compras' && (
                        <ComprasForm
                            formData={comprasDraft}
                            updateForm={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                    {activeTab === 'outro' && (
                        <OutroForm
                            formData={outroDraft}
                            updateForm={updateDraft}
                            errors={errors}
                            isEditMode={isEditMode}
                        />
                    )}

                </div>
                )}

                {/* --- 4. Rodapé com Botões (Footer) --- */}
                <div className={`p-4 md:p-6 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row gap-3 rounded-b-xl items-center ${step === 1 && !isEditMode ? 'justify-center' : 'md:justify-between'}`}>
                    {step === 1 && !isEditMode ? (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full sm:w-auto px-8 py-3 rounded-xl font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                            Cancelar
                        </button>
                    ) : (
                        <>
                            <div className="w-full md:w-auto flex flex-row gap-3 order-2 md:order-1">
                                {!isEditMode && step === 2 && (
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 md:flex-none px-4 md:px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ArrowLeft size={20} />
                                        <span>Voltar</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="flex-1 md:flex-none px-4 md:px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                            </div>
                            
                            <button
                                type="button"
                                onClick={handleSaveClick}
                                disabled={loading}
                                className={`w-full md:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 group order-1 md:order-2
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
                                        <Check size={20} className="transition-transform group-hover:scale-110" />
                                        <span>{isEditMode ? 'Salvar Edição' : 'Salvar Registro'}</span>
                                    </>
                                )}
                            </button>
                        </>
                    )}
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
                propriedadeId={currentPropriedade?.id}
                initialSelected={getCurrentDraft().locais}
            />
        </div>
    );
};

const ManualRecordDialogMemo = React.memo(ManualRecordDialog);
export default ManualRecordDialogMemo;
