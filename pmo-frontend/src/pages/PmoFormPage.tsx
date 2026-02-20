/**
 * @file PmoFormPage.tsx
 * @description View component for PMO (Plano de Manejo Orgânico) form.
 * 
 * ✅ REFACTORED: Zero MUI. All visual elements use native HTML + Tailwind CSS.
 * All logic extracted to usePmoFormLogic hook.
 */

import React, { useState, useMemo, useEffect, ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, X, Loader2 } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

// Hook with all business logic
import { usePmoFormLogic } from '../hooks/pmo/usePmoFormLogic';

// Validation functions (still needed for section config)
import * as validations from '../validation/pmoValidation';

// Form Components
import DesktopStepperMUI from '../components/PmoForm/DesktopStepper';
import StepperNavigationMUI from '../components/PmoForm/StepperNavigation';
import MobileBottomNav from '../components/PmoForm/MobileBottomNav';
import SectionsModal from '../components/PmoForm/SectionsModal';
import PmoParaImpressao from '../components/PmoForm/PmoParaImpressao';

// Section Components
import DiarioDeCampo from '../components/DiarioDeCampo';
import Secao1MUI from '../components/PmoForm/Secao1';
import Secao2MUI from '../components/PmoForm/Secao2';
import Secao3MUI from '../components/PmoForm/Secao3';
import Secao4MUI from '../components/PmoForm/Secao4';
import Secao5MUI from '../components/PmoForm/Secao5';
import Secao6MUI from '../components/PmoForm/Secao6';
import Secao7MUI from '../components/PmoForm/Secao7';
import Secao8MUI from '../components/PmoForm/Secao8';
import Secao9MUI from '../components/PmoForm/Secao9';
import Secao10MUI from '../components/PmoForm/Secao10';
import Secao11MUI from '../components/PmoForm/Secao11';
import Secao12MUI from '../components/PmoForm/Secao12';
import Secao13MUI from '../components/PmoForm/Secao13';
import Secao14MUI from '../components/PmoForm/Secao14';
import Secao15MUI from '../components/PmoForm/Secao15';
import Secao16MUI from '../components/PmoForm/Secao16';
import Secao17MUI from '../components/PmoForm/Secao17';
import Secao18MUI from '../components/PmoForm/Secao18';

// ==================================================================
// ||                         TYPES                                ||
// ==================================================================

interface FormSection {
    id: number;
    key: string;
    Component: React.FC<any>;
    validate: (data: any) => boolean;
    label: string;
}

// ==================================================================
// ||                     MAIN COMPONENT                           ||
// ==================================================================

const PmoFormPage: React.FC = () => {
    const navigate = useNavigate();
    const isMobile = useIsMobile();

    // ─────────────────────────────────────────────────────────────────
    // HOOK: All business logic comes from here
    // ─────────────────────────────────────────────────────────────────
    const {
        formData,
        nomeIdentificador,
        currentStep,
        totalSteps,
        isLoading,
        isSaving,
        isDirty,
        isEditMode,
        saveStatus,
        error,
        sectionStatus,
        editablePmoId,
        setNomeIdentificador,
        updateSection,
        goToStep,
        nextStep,
        prevStep,
        clearError,
        saveDraft,
        submitFinal
    } = usePmoFormLogic();

    // ─────────────────────────────────────────────────────────────────
    // LOCAL UI STATE (only visual, not business logic)
    // ─────────────────────────────────────────────────────────────────
    const [isSectionsModalOpen, setSectionsModalOpen] = useState(false);
    const [isConfirmExitOpen, setConfirmExitOpen] = useState(false);
    const [isPrintMode, setIsPrintMode] = useState(false);
    const [toastMsg, setToastMsg] = useState<string | null>(null);

    // Auto-show toast when saveStatus changes
    useEffect(() => {
        if (saveStatus) {
            setToastMsg(saveStatus);
            const timer = setTimeout(() => setToastMsg(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [saveStatus]);

    // ─────────────────────────────────────────────────────────────────
    // SECTION CONFIG (static, memoized)
    // ─────────────────────────────────────────────────────────────────
    const formSections: FormSection[] = useMemo(() => [
        { id: 1, key: 'secao_1_descricao_propriedade', Component: Secao1MUI, validate: validations.validateSecao1, label: 'Propriedade' },
        { id: 2, key: 'secao_2_atividades_produtivas_organicas', Component: Secao2MUI, validate: validations.validateSecao2, label: 'Atividades Orgânicas' },
        { id: 3, key: 'secao_3_atividades_produtivas_nao_organicas', Component: Secao3MUI, validate: validations.validateSecao3, label: 'Atividades Não-Orgânicas' },
        { id: 4, key: 'secao_4_animais_servico_subsistencia_companhia', Component: Secao4MUI, validate: validations.validateSecao4, label: 'Outros Animais' },
        { id: 5, key: 'secao_5_producao_terceirizada', Component: Secao5MUI, validate: validations.validateSecao5, label: 'Terceiros' },
        { id: 6, key: 'secao_6_aspectos_ambientais', Component: Secao6MUI, validate: validations.validateSecao6, label: 'Ambiental' },
        { id: 7, key: 'secao_7_aspectos_sociais', Component: Secao7MUI, validate: validations.validateSecao7, label: 'Social' },
        { id: 8, key: 'secao_8_insumos_equipamentos', Component: Secao8MUI, validate: validations.validateSecao8, label: 'Insumos' },
        { id: 9, key: 'secao_9_propagacao_vegetal', Component: Secao9MUI, validate: validations.validateSecao9, label: 'Propagação' },
        { id: 10, key: 'secao_10_fitossanidade', Component: Secao10MUI, validate: validations.validateSecao10, label: 'Fitossanidade' },
        { id: 11, key: 'secao_11_colheita', Component: Secao11MUI, validate: validations.validateSecao11, label: 'Colheita' },
        { id: 12, key: 'secao_12_pos_colheita', Component: Secao12MUI, validate: validations.validateSecao12, label: 'Pós-Colheita' },
        { id: 13, key: 'secao_13_producao_animal', Component: Secao13MUI, validate: validations.validateSecao13, label: 'Produção Animal' },
        { id: 14, key: 'secao_14_comercializacao', Component: Secao14MUI, validate: validations.validateSecao14, label: 'Comércio' },
        { id: 15, key: 'secao_15_rastreabilidade', Component: Secao15MUI, validate: validations.validateSecao15, label: 'Rastreio' },
        { id: 16, key: 'secao_16_sac', Component: Secao16MUI, validate: validations.validateSecao16, label: 'SAC' },
        { id: 17, key: 'secao_17_opiniao', Component: Secao17MUI, validate: validations.validateSecao17, label: 'Opinião' },
        { id: 18, key: 'secao_18_anexos', Component: Secao18MUI, validate: validations.validateSecao18, label: 'Anexos' },
        { id: 19, key: 'caderno_de_campo', Component: DiarioDeCampo, validate: () => true, label: 'Caderno de Campo' }
    ], []);

    const currentSectionConfig = formSections.find(sec => sec.id === currentStep);

    // ─────────────────────────────────────────────────────────────────
    // UI HANDLERS (simple, no business logic)
    // ─────────────────────────────────────────────────────────────────
    const handleAttemptExit = () => {
        if (isDirty) { setConfirmExitOpen(true); } else { navigate('/'); }
    };

    const handleCancelExit = () => setConfirmExitOpen(false);

    const handleSaveDraft = async () => {
        const result = await saveDraft();
        if (result.success && result.pmoId) { /* Navigation handled by hook */ }
    };

    const handleSubmitFinal = async () => { await submitFinal(); };

    const handleSaveAndExit = async () => {
        await saveDraft();
        setConfirmExitOpen(false);
        navigate('/');
    };

    // ─────────────────────────────────────────────────────────────────
    // RENDER: Print Mode
    // ─────────────────────────────────────────────────────────────────
    if (isPrintMode) {
        return <PmoParaImpressao dadosPmo={formData} onClose={() => setIsPrintMode(false)} />;
    }

    // ─────────────────────────────────────────────────────────────────
    // RENDER: Loading State
    // ─────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 size={32} className="animate-spin text-green-600" />
                <span className="ml-3 text-gray-500">Carregando...</span>
            </div>
        );
    }

    // Progress percentage for mobile
    const progressPct = totalSteps > 0 ? ((currentStep) / totalSteps) * 100 : 0;

    // ─────────────────────────────────────────────────────────────────
    // RENDER: Main Form
    // ─────────────────────────────────────────────────────────────────
    return (
        <div key={editablePmoId || 'new-pmo'} className="max-w-[1200px] mx-auto p-1 sm:p-2 md:p-3 pb-20 md:pb-3">
            {/* Header */}
            <div className="p-2 mb-3 flex flex-col md:flex-row items-start md:items-center gap-3">
                <button type="button" onClick={handleAttemptExit} className="text-slate-500 hover:text-slate-900 p-0 transition-colors">
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Planejamento</span>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">
                        {isEditMode ? 'Editando Plano' : 'Novo Plano'}
                    </h1>
                </div>
                <button
                    type="button"
                    onClick={() => setIsPrintMode(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-md text-slate-500 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                >
                    <Printer size={16} />
                    Visualizar Impressão
                </button>
                <div className="w-full md:w-[350px]">
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Identificação *</label>
                    <input
                        required
                        placeholder="Nome da Propriedade / Ano"
                        value={nomeIdentificador}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setNomeIdentificador(e.target.value)}
                        className="w-full border border-gray-300 rounded-md p-2.5 text-sm bg-white shadow-sm focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    />
                </div>
            </div>

            {/* Stepper */}
            <div className="w-full mb-4">
                {isMobile ? (
                    <div className="sticky top-0 z-[100] bg-white shadow-sm rounded-md p-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-1">Seção {currentStep} de {totalSteps}</p>
                    </div>
                ) : (
                    <DesktopStepperMUI
                        sections={formSections}
                        currentStep={currentStep}
                        goToStep={goToStep}
                        sectionStatus={sectionStatus}
                    />
                )}
            </div>

            {/* Form Content */}
            <div>
                <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleSubmitFinal(); }}>
                    {currentSectionConfig && (
                        <currentSectionConfig.Component
                            key={currentSectionConfig.key}
                            data={formData[currentSectionConfig.key]}
                            formData={formData}
                            onSectionChange={(newData: any) => updateSection(currentSectionConfig.key, newData)}
                            errors={error ? { global: error } : {}}
                            pmoId={editablePmoId}
                        />
                    )}

                    {error && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                            <span className="text-sm text-red-700">{error}</span>
                            <button type="button" onClick={clearError} className="text-red-400 hover:text-red-600"><X size={16} /></button>
                        </div>
                    )}

                    {!isMobile && (
                        <StepperNavigationMUI
                            currentStep={currentStep}
                            totalSteps={totalSteps}
                            isLoading={isLoading || isSaving}
                            saveStatus={saveStatus}
                            onPrev={prevStep}
                            onSaveDraft={handleSaveDraft}
                            onNext={nextStep}
                            onFinalSubmit={handleSubmitFinal}
                            onGoToStart={handleAttemptExit}
                        />
                    )}
                </form>
            </div>

            {/* Mobile Bottom Nav */}
            {isMobile && (
                <MobileBottomNav
                    onNext={nextStep}
                    onPrev={prevStep}
                    onSaveDraft={handleSaveDraft}
                    onGoToSections={() => setSectionsModalOpen(true)}
                    isNextDisabled={isLoading || isSaving || currentStep === totalSteps}
                    isPrevDisabled={isLoading || isSaving || currentStep === 1}
                />
            )}

            {/* Sections Modal */}
            <SectionsModal
                open={isSectionsModalOpen}
                onClose={() => setSectionsModalOpen(false)}
                sections={formSections}
                currentStep={currentStep}
                onNavigate={(step: number) => { goToStep(step); setSectionsModalOpen(false); }}
                sectionStatus={sectionStatus}
            />

            {/* Confirm Exit Dialog */}
            {isConfirmExitOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-bold text-gray-800">Sair da Edição?</h3>
                            <button type="button" onClick={handleCancelExit} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-sm text-gray-600">
                                Você tem alterações não salvas. Deseja salvá-las como rascunho antes de sair?
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
                            <button type="button" onClick={handleCancelExit} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Cancelar</button>
                            <button type="button" onClick={() => { setConfirmExitOpen(false); navigate('/'); }} className="px-4 py-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-md">
                                Sair sem Salvar
                            </button>
                            <button type="button" onClick={handleSaveAndExit} className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 font-medium">
                                Salvar e Sair
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification (replaces MUI Snackbar) */}
            {toastMsg && (
                <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-4 py-3 rounded-lg shadow-lg text-sm animate-fade-in flex items-center gap-2">
                    <span>{toastMsg}</span>
                    <button type="button" onClick={() => setToastMsg(null)} className="text-gray-300 hover:text-white"><X size={14} /></button>
                </div>
            )}
        </div>
    );
};

export default PmoFormPage;
