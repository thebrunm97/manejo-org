// src/components/Plan/SectionShell.tsx

import React from 'react';
import BotSuggestionsPanel from '../PmoForm/BotSuggestionsPanel';

/**
 * Props for the SectionShell component
 */
export interface SectionShellProps {
    /** Section label (e.g., "Seção 1") - displayed above the title */
    sectionLabel?: string;
    /** Main section title (e.g., "Descrição da Propriedade") */
    title: string;
    /** Optional subtitle below the main title */
    subtitle?: string;
    /** Section content */
    children: React.ReactNode;
    /** Optional: ID of the section to filter suggestions (e.g. 8 for inputs) */
    sectionId?: number;
    /** Optional: Callback to apply a suggestion (receives data and removal callback) */
    onApplySuggestion?: (data: any, onRemove?: () => void) => void;
}

/**
 * SectionShell - A reusable section container for the Plan editor.
 * 
 * Renders a card-style container with:
 * - Optional section label (uppercase, muted)
 * - Title (18px, bold)
 * - Optional subtitle
 * - Container with subtle border and rounded corners for content
 * 
 * Pattern follows the "SaaS Moderno" design system.
 */
export function SectionShell({
    sectionLabel,
    title,
    subtitle,
    children,
    sectionId,
    onApplySuggestion
}: SectionShellProps) {
    return (
        <div className="mb-8">
            {/* Section header */}
            <div className="mb-4">
                {sectionLabel && (
                    <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        {sectionLabel}
                    </span>
                )}
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
                    {title}
                </h2>
                {subtitle && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* AI Suggestions Panel */}
            {sectionId && onApplySuggestion && (
                <div className="mb-4">
                    <BotSuggestionsPanel sectionId={sectionId} onApply={onApplySuggestion} />
                </div>
            )}

            {/* Content container */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-6 hover:border-green-500/30 dark:hover:border-green-500/50 transition-colors duration-300">
                {children}
            </div>
        </div>
    );
}

export default SectionShell;
