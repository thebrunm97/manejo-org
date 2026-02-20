// src/components/PmoForm/VegetalImportDialog.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useState, useEffect } from 'react';
import { Download, Sprout, Loader2, CheckCircle, X } from 'lucide-react';
import { useVegetalImportLogic } from '../../hooks/pmo/useVegetalImportLogic';
import { VegetalItem } from '../../domain/pmo/pmoTypes';

interface VegetalImportDialogProps {
    open: boolean;
    onClose: () => void;
    onImport: (items: VegetalItem[]) => void;
    currentItems: VegetalItem[];
    pmoId: string | number | undefined;
    propriedadeId?: number;
}

type VegetalItemWithDate = VegetalItem & { data_plantio_temp?: string };

const VegetalImportDialog: React.FC<VegetalImportDialogProps> = ({
    open,
    onClose,
    onImport,
    currentItems,
    pmoId,
    propriedadeId
}) => {
    const { suggestions, loading, fetchSuggestions, importItems } = useVegetalImportLogic(pmoId, currentItems, propriedadeId);

    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [estimates, setEstimates] = useState<Record<string | number, number>>({});
    const [units, setUnits] = useState<Record<string | number, string>>({});

    useEffect(() => {
        if (open) {
            fetchSuggestions();
            setSelectedIds(new Set());
            setEstimates({});
            setUnits({});
        }
    }, [open, fetchSuggestions]);

    const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedIds(new Set(suggestions.map(n => n.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelect = (id: string | number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleEstimateChange = (id: string | number, value: string) => {
        const numValue = parseFloat(value);
        setEstimates(prev => ({ ...prev, [id]: isNaN(numValue) ? 0 : numValue }));
        if (!selectedIds.has(id) && numValue > 0) {
            handleSelect(id);
        }
    };

    const handleUnitChange = (id: string | number, value: string) => {
        setUnits(prev => ({ ...prev, [id]: value }));
    };

    const handleConfirmImport = () => {
        const itemsToProcess = suggestions.filter(item => selectedIds.has(item.id));
        const finalItems = itemsToProcess.map(item => {
            const estimate = estimates[item.id] !== undefined ? estimates[item.id] : (item.producao_esperada_ano || 0);
            const unit = units[item.id] || item.producao_unidade || 'kg';
            const { data_plantio_temp, ...cleanItem } = item as VegetalItemWithDate;
            return { ...cleanItem, producao_esperada_ano: estimate, producao_unidade: unit };
        });
        const imported = importItems(finalItems);
        onImport(imported);
        onClose();
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try { return new Date(dateStr).toLocaleDateString('pt-BR'); }
        catch { return dateStr; }
    };

    if (!open) return null;

    const allSelected = suggestions.length > 0 && selectedIds.size === suggestions.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < suggestions.length;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col min-h-[60vh]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                        <Download size={22} className="text-green-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Importar do Caderno de Campo</h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X size={20} /></button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-[300px] gap-3">
                            <Loader2 size={36} className="animate-spin text-green-600" />
                            <p className="text-gray-500">Buscando novidades no campo...</p>
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="p-6 text-center">
                            <div className="flex items-center justify-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle size={20} className="text-green-600" />
                                <p className="text-sm text-green-800 font-medium">Tudo sincronizado! Nenhum novo plantio encontrado no caderno.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 bg-gray-50 z-10">
                                    <tr className="border-b border-gray-200">
                                        <th className="px-3 py-2.5 text-left w-10">
                                            <input
                                                type="checkbox"
                                                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                                                checked={allSelected}
                                                onChange={handleSelectAll}
                                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Cultura</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Local</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Data Reg.</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase w-[220px]">Estimativa de Colheita</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {suggestions.map((item) => {
                                        const itemWithDate = item as VegetalItemWithDate;
                                        const isSelected = selectedIds.has(item.id);

                                        return (
                                            <tr
                                                key={item.id}
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'SELECT') {
                                                        handleSelect(item.id);
                                                    }
                                                }}
                                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleSelect(item.id)}
                                                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <Sprout size={16} className="text-green-500" />
                                                        <span className="font-bold text-gray-800">{item.produto}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-500">
                                                    {item.talhoes_canteiros || 'N/I'}
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-300 text-gray-600">
                                                        {formatDate(itemWithDate.data_plantio_temp)}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex gap-1">
                                                        <input
                                                            type="number"
                                                            placeholder="0"
                                                            value={estimates[item.id] !== undefined ? estimates[item.id] : ''}
                                                            onChange={(e) => handleEstimateChange(item.id, e.target.value)}
                                                            className="w-20 border border-gray-300 rounded p-1 text-xs focus:ring-1 focus:ring-green-500 focus:border-green-500"
                                                        />
                                                        <select
                                                            value={units[item.id] || item.producao_unidade || 'kg'}
                                                            onChange={(e) => handleUnitChange(item.id, e.target.value)}
                                                            className="w-[70px] border border-gray-300 rounded p-1 text-xs bg-white focus:ring-1 focus:ring-green-500"
                                                        >
                                                            <option value="kg">kg</option>
                                                            <option value="ton">ton</option>
                                                            <option value="sacos">sc</option>
                                                            <option value="cx">cx</option>
                                                            <option value="unid">unid</option>
                                                            <option value="maços">maço</option>
                                                        </select>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between p-4 border-t border-gray-200">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                    <button
                        type="button"
                        onClick={handleConfirmImport}
                        disabled={selectedIds.size === 0}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download size={16} />
                        Importar ({selectedIds.size})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VegetalImportDialog;
