// src/components/PmoForm/GroupedInsumosList.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useCallback, useState, useEffect } from 'react';
import { ChevronDown, Trash2, PlusCircle, FlaskConical, MapPin, X } from 'lucide-react';

import { useInsumoGrouping } from '../../hooks/pmo/useInsumoGrouping';

// @ts-ignore
import SeletorLocalizacaoSaf from './SeletorLocalizacaoSaf';

interface GroupedInsumosListProps {
    data: any[];
    onDataChange: (newData: any[]) => void;
    readOnly?: boolean;
}

const DOSE_UNITS = ['kg', 'g', 'L', 'ml', 'ton', 'unid', 'sc', 'kg/ha', 'L/ha', 'm³/ha', 'g/m²', 'L/m²', 'ml/m²', 'm³/m²', 'kg/cova'];

function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 640);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);
    return isMobile;
}

const GroupedInsumosList: React.FC<GroupedInsumosListProps> = ({ data, onDataChange, readOnly = false }) => {
    const isMobile = useIsMobile();

    const {
        groupedData,
        expandedGroup,
        isAddDialogOpen,
        newItemName,
        setNewItemName,
        handleAccordionChange,
        handleItemChange,
        handleRemoveItem,
        handleAddLocalToGroup,
        setIsAddDialogOpen,
        handleConfirmAddItem
    } = useInsumoGrouping(data, onDataChange);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmAddItem();
        }
    }, [handleConfirmAddItem]);

    const inputCls = "w-full border border-gray-300 rounded-md p-1.5 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500";

    // RENDER ITEM ROW
    const renderItemRow = (item: any, index: number) => {
        return (
            <div
                key={item.id || index}
                className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center'} gap-3 p-3 bg-white rounded-lg border border-gray-200`}
            >
                {/* Onde (Local) */}
                <div className={`${isMobile ? '' : 'flex-[2]'} min-w-[200px]`}>
                    <label className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                        <MapPin size={12} />Onde (Cultura/Local)
                    </label>
                    {readOnly ? (
                        <p className="text-sm text-gray-800">{item.onde || 'Não informado'}</p>
                    ) : (
                        <input
                            type="text"
                            value={item.onde || ''}
                            onChange={(e) => handleItemChange(item.id, 'onde', e.target.value)}
                            placeholder="Ex: Canteiros de Alface"
                            className={inputCls}
                        />
                    )}
                </div>

                {/* Quando */}
                <div className={`${isMobile ? '' : 'flex-1'} min-w-[120px]`}>
                    <label className="text-xs text-gray-500 mb-0.5 block">Data</label>
                    <input
                        type="date"
                        value={item.quando || ''}
                        onChange={(e) => handleItemChange(item.id, 'quando', e.target.value)}
                        disabled={readOnly}
                        className={inputCls}
                    />
                </div>

                {/* Dose */}
                <div className={`${isMobile ? '' : 'flex-[1.5]'} min-w-[150px]`}>
                    <label className="text-xs text-gray-500 mb-0.5 block">Dose</label>
                    <div className="flex gap-1">
                        <input
                            type="number"
                            value={item.dose_valor ?? ''}
                            onChange={(e) => handleItemChange(item.id, 'dose_valor', e.target.value)}
                            disabled={readOnly}
                            placeholder="0"
                            className={`${inputCls} flex-1`}
                        />
                        <select
                            value={item.dose_unidade ?? 'kg'}
                            onChange={(e) => handleItemChange(item.id, 'dose_unidade', e.target.value)}
                            disabled={readOnly}
                            className="border border-gray-300 rounded-md p-1.5 text-sm bg-white min-w-[80px] focus:ring-1 focus:ring-green-500"
                        >
                            {DOSE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                </div>

                {/* Remove */}
                {!readOnly && (
                    <div className="flex items-center">
                        <button
                            title="Remover"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            {groupedData.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <FlaskConical size={48} className="mx-auto mb-2 opacity-50 text-green-600" />
                    <p className="font-medium">Nenhum insumo registrado</p>
                    <p className="text-sm text-gray-400 mt-1">Adicione adubos, defensivos ou manejos.</p>
                </div>
            ) : (
                groupedData.map(group => {
                    const isExpanded = expandedGroup === group.nome;
                    return (
                        <div key={group.nome} className={`rounded-lg border transition-colors ${isExpanded ? 'border-green-500' : 'border-gray-200'}`}>
                            {/* Summary */}
                            <button
                                onClick={() => handleAccordionChange(group.nome)({} as any, !isExpanded)}
                                className={`w-full flex items-center justify-between p-3 text-left rounded-t-lg transition-colors ${isExpanded ? 'bg-green-50' : 'bg-white hover:bg-gray-50'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FlaskConical size={20} className="text-green-600" />
                                    <span className="font-bold text-gray-800">{group.nome}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-300 text-gray-600">
                                        {group.items.length}
                                    </span>
                                </div>
                                <ChevronDown size={20} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {/* Details */}
                            {isExpanded && (
                                <div className="p-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                                    <div className="flex flex-col gap-2">
                                        {group.items.map(renderItemRow)}
                                        {!readOnly && (
                                            <>
                                                <hr className="border-gray-200" />
                                                <button
                                                    onClick={() => handleAddLocalToGroup(group.nome)}
                                                    className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                                                >
                                                    <PlusCircle size={16} />
                                                    Adicionar aplicação de {group.nome}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {/* Add New Type Button */}
            {!readOnly && (
                <button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="self-start inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-green-700 border-2 border-dashed border-green-400 rounded-lg hover:bg-green-50 transition-colors"
                >
                    <PlusCircle size={18} />
                    Adicionar Novo Tipo de Insumo/Manejo
                </button>
            )}

            {/* Add Dialog */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={() => setIsAddDialogOpen(false)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Novo Insumo ou Manejo</h3>
                        <p className="text-sm text-gray-500 mb-3">O que você vai aplicar? (Ex: Esterco, Calda Bordalesa, Capina)</p>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Nome do Insumo/Manejo"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={`${inputCls} mb-4`}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddDialogOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button onClick={handleConfirmAddItem} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg">Adicionar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupedInsumosList;
