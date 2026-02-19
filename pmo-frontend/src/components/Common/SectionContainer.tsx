import React, { ReactNode } from 'react';
import { PlusCircle, Leaf } from 'lucide-react';
import BotSuggestionsPanel from '../PmoForm/BotSuggestionsPanel';

interface SectionContainerProps {
    title: string;
    onAdd?: () => void;
    addButtonLabel?: string;
    isEmpty: boolean;
    emptyMessage: string;
    children: ReactNode;
    icon?: ReactNode;
    sectionId?: number;
    onApplySuggestion?: (data: any) => void;
}

const SectionContainer: React.FC<SectionContainerProps> = ({
    title,
    onAdd,
    addButtonLabel = "Adicionar",
    isEmpty,
    emptyMessage,
    children,
    icon,
    sectionId,
    onApplySuggestion
}) => {
    return (
        <div className="flex flex-col gap-4 mb-6">
            {/* 0. Painel de Sugestões do Robô */}
            {sectionId && onApplySuggestion && (
                <BotSuggestionsPanel sectionId={sectionId} onApply={onApplySuggestion} />
            )}
            {/* Header Padronizado */}
            <div className="flex flex-row justify-between items-center mb-2">
                <h6 className="text-base font-bold text-primary-main">
                    {title}
                </h6>

                {!isEmpty && onAdd && (
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-primary-main rounded-md hover:bg-primary-dark transition-colors"
                        onClick={onAdd}
                    >
                        <PlusCircle className="w-4 h-4" />
                        {addButtonLabel}
                    </button>
                )}
            </div>

            {/* Conteúdo ou Empty State */}
            {isEmpty ? (
                <div className="text-center py-8 px-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center gap-3">
                    <div className="text-gray-400">
                        {icon || <Leaf className="w-12 h-12" />}
                    </div>
                    <p className="text-base font-medium text-gray-500">
                        {emptyMessage}
                    </p>
                    {onAdd && (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 text-sm font-medium text-primary-main border border-primary-main rounded-md hover:bg-primary-main/5 transition-colors"
                            onClick={onAdd}
                        >
                            <PlusCircle className="w-4 h-4" />
                            {addButtonLabel}
                        </button>
                    )}
                </div>
            ) : (
                <div>
                    {children}
                </div>
            )}
        </div>
    );
};

export default SectionContainer;
