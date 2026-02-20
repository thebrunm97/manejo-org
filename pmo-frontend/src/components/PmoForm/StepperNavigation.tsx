// src/components/PmoForm/StepperNavigation.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React from 'react';
import { ArrowLeft, ArrowRight, Save, CheckCheck, LayoutDashboard, Loader2 } from 'lucide-react';

interface StepperNavigationMUIProps {
    currentStep: number;
    totalSteps: number;
    isLoading: boolean;
    saveStatus: string;
    onPrev: () => void;
    onSaveDraft: () => void;
    onNext: () => void;
    onFinalSubmit: () => void;
    onGoToStart: () => void;
}

const StepperNavigationMUI: React.FC<StepperNavigationMUIProps> = ({
    currentStep,
    totalSteps,
    isLoading,
    saveStatus,
    onPrev,
    onSaveDraft,
    onNext,
    onFinalSubmit,
    onGoToStart,
}) => {
    const isSaving = isLoading && saveStatus.includes('Salvando');

    return (
        <div className="flex justify-between items-center p-3 mt-4 bg-white rounded-lg shadow-sm border-t border-gray-200 flex-wrap gap-2">
            {/* Left: Back Navigation */}
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onGoToStart}
                    disabled={isLoading}
                    title="Voltar para o Painel"
                    className="p-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <LayoutDashboard size={20} />
                </button>
                <button
                    type="button"
                    onClick={onPrev}
                    disabled={currentStep === 1 || isLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    <ArrowLeft size={18} />
                    Anterior
                </button>
            </div>

            {/* Center: Save Draft */}
            <div>
                <button
                    type="button"
                    onClick={onSaveDraft}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSaving ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Save size={18} />
                    )}
                    {isSaving ? 'Salvando...' : 'Salvar Rascunho'}
                </button>
            </div>

            {/* Right: Forward Navigation */}
            <div>
                {currentStep < totalSteps ? (
                    <button
                        type="button"
                        onClick={onNext}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Próximo
                        <ArrowRight size={18} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onFinalSubmit}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {isLoading && !saveStatus ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <CheckCheck size={18} />
                        )}
                        {isLoading && !saveStatus ? 'Salvando...' : 'Finalizar e Salvar'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default StepperNavigationMUI;
