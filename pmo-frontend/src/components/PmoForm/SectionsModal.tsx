// src/components/PmoForm/SectionsModal.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React from 'react';
import { X, CheckCircle, Pencil, Circle } from 'lucide-react';

// Types
interface FormSection {
    id: number;
    key: string;
    label: string;
}

type SectionStatus = 'completo' | 'em-progresso' | 'pendente' | undefined;

interface SectionsModalProps {
    open: boolean;
    onClose: () => void;
    sections: FormSection[];
    currentStep: number;
    onNavigate: (step: number) => void;
    sectionStatus: Record<string, SectionStatus>;
}

const StatusIcon: React.FC<{ status: SectionStatus }> = ({ status }) => {
    if (status === 'completo') return <CheckCircle size={22} className="text-green-500" />;
    if (status === 'em-progresso') return <Pencil size={22} className="text-blue-500" />;
    return <Circle size={22} className="text-gray-400" />;
};

const SectionsModal: React.FC<SectionsModalProps> = ({
    open,
    onClose,
    sections,
    currentStep,
    onNavigate,
    sectionStatus,
}) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl shadow-2xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom duration-300">
                {/* Header */}
                <div className="bg-green-600 text-white px-4 py-3 flex items-center gap-3 sm:rounded-t-xl rounded-t-xl">
                    <button type="button" onClick={onClose} className="p-1 hover:bg-green-700 rounded-lg transition-colors" aria-label="close">
                        <X size={22} />
                    </button>
                    <h2 className="text-lg font-semibold flex-1">Seções do Plano</h2>
                </div>

                {/* Section List */}
                <div className="overflow-y-auto flex-1">
                    {sections.map((section) => {
                        const isActive = currentStep === section.id;
                        return (
                            <button
                                type="button"
                                key={section.id}
                                onClick={() => onNavigate(section.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-gray-100 ${isActive ? 'bg-green-50 border-l-4 border-l-green-500' : 'hover:bg-gray-50'
                                    }`}
                            >
                                <StatusIcon status={sectionStatus[section.key]} />
                                <span className={`text-sm ${isActive ? 'font-bold text-green-800' : 'text-gray-700'}`}>
                                    {section.id}. {section.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SectionsModal;
