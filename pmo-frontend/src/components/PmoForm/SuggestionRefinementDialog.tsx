// src/components/PmoForm/SuggestionRefinementDialog.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SuggestionRefinementDialogProps {
    open: boolean;
    initialData: any;
    onClose: () => void;
    onConfirm: (data: any) => void;
}

export default function SuggestionRefinementDialog({
    open,
    initialData,
    onClose,
    onConfirm
}: SuggestionRefinementDialogProps) {
    const [formData, setFormData] = useState({
        talhao_canteiro: '',
        area_plantada: 0,
        area_plantada_unidade: 'm²',
        producao_esperada_ano: 0,
        producao_unidade: 'kg'
    });

    useEffect(() => {
        if (open && initialData) {
            setFormData({
                talhao_canteiro: initialData.talhao_canteiro || initialData.local || '',
                area_plantada: Number(initialData.area_plantada) || Number(initialData.quantidade_valor) || 0,
                area_plantada_unidade: initialData.area_plantada_unidade || initialData.quantidade_unidade || 'm²',
                producao_esperada_ano: Number(initialData.producao_anual) || 0,
                producao_unidade: initialData.unidade_producao || 'kg'
            });
        }
    }, [open, initialData]);

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleConfirm = () => {
        onConfirm({
            ...initialData,
            ...formData
        });
    };

    if (!open) return null;

    const inputCls = "w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500";
    const selectCls = "border border-gray-300 rounded-md p-2 text-sm bg-white focus:ring-1 focus:ring-green-500";

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-purple-600 text-white px-5 py-4 rounded-t-xl flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Refinar Sugestão de Plantio</h2>
                    <button type="button" onClick={onClose} className="p-1 hover:bg-purple-700 rounded-lg"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="p-5 border-t border-gray-200">
                    <h3 className="text-base font-bold text-gray-800 mb-1">
                        Produto: {initialData?.produto || 'Novo Cultivo'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                        Ajuste os valores estimados pela Inteligência Artificial antes de salvar.
                    </p>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Local */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Local (Talhão/Canteiro)</label>
                            <input
                                type="text"
                                value={formData.talhao_canteiro}
                                onChange={(e) => handleChange('talhao_canteiro', e.target.value)}
                                className={inputCls}
                            />
                        </div>

                        {/* Área Plantada */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Área / Quantidade Plantada</label>
                                <input
                                    type="number"
                                    value={formData.area_plantada}
                                    onChange={(e) => handleChange('area_plantada', Number(e.target.value))}
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Unidade</label>
                                <select
                                    value={formData.area_plantada_unidade}
                                    onChange={(e) => handleChange('area_plantada_unidade', e.target.value)}
                                    className={`${selectCls} w-full`}
                                >
                                    <option value="m²">m²</option>
                                    <option value="ha">ha</option>
                                    <option value="mudas">mudas</option>
                                    <option value="unid">unid</option>
                                    <option value="covas">covas</option>
                                </select>
                            </div>
                        </div>

                        {/* Produção Esperada */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-2">
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Produção Esperada / Ano</label>
                                <input
                                    type="number"
                                    value={formData.producao_esperada_ano}
                                    onChange={(e) => handleChange('producao_esperada_ano', Number(e.target.value))}
                                    className={inputCls}
                                />
                                <p className="text-xs text-gray-400 mt-0.5">Estimativa de colheita total</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">Unidade</label>
                                <select
                                    value={formData.producao_unidade}
                                    onChange={(e) => handleChange('producao_unidade', e.target.value)}
                                    className={`${selectCls} w-full`}
                                >
                                    <option value="kg">kg</option>
                                    <option value="ton">ton</option>
                                    <option value="maço">maço</option>
                                    <option value="unid">unid</option>
                                    <option value="cx">cx</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button type="button" onClick={handleConfirm} className="px-5 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg">
                        Confirmar e Salvar
                    </button>
                </div>
            </div>
        </div>
    );
}
