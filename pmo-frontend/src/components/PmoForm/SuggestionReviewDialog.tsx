// src/components/PmoForm/SuggestionReviewDialog.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { TableColumn } from './TabelaDinamica';

interface Props {
    open: boolean;
    initialData: any;
    columns: TableColumn[];
    onClose: () => void;
    onConfirm: (data: any) => void;
}

/**
 * Dialog to review and edit AI suggestions before adding to the table.
 * Dynamically renders fields based on table columns.
 */
export default function SuggestionReviewDialog({
    open,
    initialData,
    columns,
    onClose,
    onConfirm
}: Props) {
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        if (open && initialData) {
            setFormData({ ...initialData });
        }
    }, [open, initialData]);

    const handleChange = (id: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [id]: value }));
    };

    const handleSave = () => {
        onConfirm(formData);
    };

    if (!open) return null;

    const inputCls = "w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500";

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-green-600 text-white px-5 py-4 rounded-t-xl flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Revisar Sugestão do Assistente</h2>
                    <button type="button" onClick={onClose} className="p-1 hover:bg-green-700 rounded-lg"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="p-5 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-4">
                        Verifique os dados extraídos abaixo e complemente o que for necessário antes de adicionar à tabela.
                    </p>

                    <div className="flex flex-col gap-3">
                        {columns.map((col) => {
                            if (col.id === 'actions') return null;

                            // Unit Selector
                            if (col.unitSelector) {
                                return (
                                    <div key={col.id}>
                                        <label className="text-xs font-medium text-gray-600 mb-1 block">{col.label}</label>
                                        <div className="flex gap-2">
                                            <input
                                                type={col.type === 'number' ? 'number' : 'text'}
                                                value={formData[col.id] || ''}
                                                onChange={(e) => handleChange(col.id, e.target.value)}
                                                placeholder={col.placeholder || 'Valor'}
                                                className={`${inputCls} flex-1`}
                                            />
                                            <select
                                                value={formData[col.unitSelector.key] || ''}
                                                onChange={(e) => handleChange(col.unitSelector!.key, e.target.value)}
                                                className="border border-gray-300 rounded-md p-2 text-sm bg-white min-w-[100px] focus:ring-1 focus:ring-green-500"
                                            >
                                                <option value="" disabled>Unidade</option>
                                                {col.unitSelector.options.map((opt) => (
                                                    <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                );
                            }

                            // Standard Field
                            return (
                                <div key={col.id}>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">{col.label}</label>
                                    <input
                                        type="text"
                                        value={formData[col.id] || ''}
                                        onChange={(e) => handleChange(col.id, e.target.value)}
                                        placeholder={col.placeholder}
                                        className={inputCls}
                                    />
                                    {col.suffix && <p className="text-xs text-gray-400 mt-0.5">Unidade esperada: {col.suffix}</p>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button type="button" onClick={handleSave} className="px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg">
                        Adicionar à Tabela
                    </button>
                </div>
            </div>
        </div>
    );
}
