// src/components/PmoForm/BotSuggestionsPanel.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useEffect, useState } from 'react';
import { Bot, Plus, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchPlanningSuggestions, markSuggestionAsProcessed } from '../../services/pmoService';

interface BotSuggestionsPanelProps {
    sectionId: number;
    onApply: (data: any, onRemove?: () => void) => void;
}

const BotSuggestionsPanel: React.FC<BotSuggestionsPanelProps> = ({ sectionId, onApply }) => {
    const { user } = useAuth();
    const [suggestions, setSuggestions] = useState<any[]>([]);

    // Load suggestions on mount
    useEffect(() => {
        console.log("[BOT-DEBUG] Buscando para o usuário:", user?.id, "| sectionId:", sectionId);
        if (user?.id) {
            fetchPlanningSuggestions(user.id).then(res => {
                if (res.success && res.data) {
                    console.log('BotSuggestions raw:', res.data);

                    const relevant = res.data.filter(s => {
                        try {
                            const json = s.json_extraido || s.dados_extraidos;
                            const data = typeof json === 'string' ? JSON.parse(json) : json;
                            console.log('Checking suggestion:', data);

                            if (data?.secao_pmo) {
                                return Number(data.secao_pmo) === Number(sectionId);
                            }

                            if (sectionId === 10) {
                                const isFitossanidade =
                                    !!data?.alvo_praga_doenca ||
                                    !!data?.alvo_principal ||
                                    (!!data?.produto && !!data?.dose_valor);
                                return isFitossanidade;
                            }

                            return false;
                        } catch (e) {
                            console.error('Error parsing suggestion JSON:', e);
                            return false;
                        }
                    });

                    console.log('Relevant suggestions:', relevant);
                    setSuggestions(relevant);
                } else {
                    console.error('Failed to fetch suggestions:', res.error);
                }
            });
        }
    }, [user, sectionId]);

    const handleIgnore = async (id: string) => {
        await markSuggestionAsProcessed(id);
        setSuggestions(prev => prev.filter(s => s.id !== id));
    };

    const handleApplyWrapper = async (suggestion: any) => {
        const json = suggestion.json_extraido || suggestion.dados_extraidos;
        const data = typeof json === 'string' ? JSON.parse(json) : json;
        const dataWithLogId = { ...data, _log_id: suggestion.id };
        onApply(dataWithLogId, () => handleIgnore(suggestion.id));
    };

    if (suggestions.length === 0) return null;

    return (
        <div className="flex flex-col gap-3 mb-4">
            {suggestions.map((s) => {
                const json = s.json_extraido || s.dados_extraidos;
                const data = typeof json === 'string' ? JSON.parse(json) : json;
                const hasAlert = !!data.alerta_conformidade;

                return (
                    <div
                        key={s.id}
                        className={`rounded-lg border p-4 flex flex-col sm:flex-row sm:items-start gap-4 ${hasAlert
                            ? 'bg-amber-50 border-amber-300'
                            : 'bg-blue-50 border-blue-200'
                            }`}
                    >
                        {/* Sub-container for Icon + Text */}
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Icon */}
                            <div className={`shrink-0 mt-0.5 ${hasAlert ? 'text-amber-600' : 'text-blue-600'}`}>
                                <Bot size={22} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold mb-1 ${hasAlert ? 'text-amber-800' : 'text-blue-800'}`}>
                                    Sugestão do Assistente de Voz
                                </p>
                                <p className="text-sm italic text-gray-700 mb-1 leading-relaxed">
                                    &quot;{s.texto_usuario}&quot;
                                </p>
                                {hasAlert && (
                                    <div className="flex items-center gap-1 mt-1 text-sm font-bold text-amber-800">
                                        <AlertTriangle size={14} className="shrink-0" />
                                        <span className="truncate">{data.alerta_conformidade}</span>
                                    </div>
                                )}
                                {!hasAlert && (
                                    <p className="text-xs text-gray-500">
                                        Extraído: {data.produto} {data.dose_valor ? `(${data.dose_valor} ${data.dose_unidade})` : ''}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0 justify-end sm:justify-start pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 sm:border-transparent">
                            <button
                                type="button"
                                onClick={() => handleIgnore(s.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                            >
                                <X size={14} />
                                Ignorar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApplyWrapper(s)}
                                className={`inline-flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white rounded-md shadow-sm transition-all active:scale-95 ${hasAlert
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                <Plus size={14} />
                                Adicionar à Tabela
                            </button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default BotSuggestionsPanel;
