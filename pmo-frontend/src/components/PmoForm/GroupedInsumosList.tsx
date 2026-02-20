// src/components/PmoForm/GroupedInsumosList.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.
// Segue o padrão visual de Cards/Accordions da Secao 2.1.

import React, { useCallback, useState, useEffect } from 'react';
import { ChevronDown, Trash2, PlusCircle, FlaskConical, MapPin, X, Info } from 'lucide-react';

import { useInsumoGrouping } from '../../hooks/pmo/useInsumoGrouping';

// @ts-ignore
import SeletorLocalizacaoSaf from './SeletorLocalizacaoSaf';

interface GroupedInsumosListProps {
    data: any[];
    onDataChange: (newData: any[]) => void;
    readOnly?: boolean;
    opcoesCulturas?: string[];
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

/**
 * Componente de Seleção Múltipla customizado (Tailwind)
 */
const MultiSelectCulturas: React.FC<{
    value: string[];
    options: string[];
    onChange: (val: string[]) => void;
    disabled?: boolean;
}> = ({ value = [], options = [], onChange, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleOption = (opt: string) => {
        if (value.includes(opt)) {
            onChange(value.filter(v => v !== opt));
        } else {
            onChange([...value, opt]);
        }
    };

    const handleSelectAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([...options]);
    };

    const handleClearAll = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    return (
        <div className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className="w-full border border-gray-300 rounded-md p-1.5 text-sm bg-white text-left flex items-center justify-between focus:ring-1 focus:ring-green-500 min-h-[38px]"
            >
                <div className="flex flex-wrap gap-1 max-w-[250px] overflow-hidden">
                    {value.length === 0 ? (
                        <span className="text-gray-400">Selecione as culturas...</span>
                    ) : (
                        value.map(v => (
                            <span key={v} className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {v}
                            </span>
                        ))
                    )}
                </div>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-[100] mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl p-2 animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex justify-between mb-2">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="text-[10px] uppercase font-bold text-blue-600 hover:text-blue-800 transition-colors"
                        >
                            Selecionar Todas
                        </button>
                        <button
                            type="button"
                            onClick={handleClearAll}
                            className="text-[10px] uppercase font-bold text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Limpar
                        </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                        {options.length === 0 ? (
                            <p className="text-[10px] text-gray-400 py-2 text-center px-2">Por favor, adicione culturas na Secção 2.1 primeiro.</p>
                        ) : (
                            options.map(opt => (
                                <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors text-xs">
                                    <input
                                        type="checkbox"
                                        checked={value.includes(opt)}
                                        onChange={() => toggleOption(opt)}
                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-gray-700">{opt}</span>
                                </label>
                            ))
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="w-full mt-2 py-1 bg-gray-100 hover:bg-gray-200 text-[10px] font-bold text-gray-600 rounded"
                    >
                        Fechar
                    </button>
                </div>
            )}
        </div>
    );
};

const GroupedInsumosList: React.FC<GroupedInsumosListProps> = ({ data, onDataChange, readOnly = false, opcoesCulturas = [] }) => {
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
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-visible p-4"
            >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Onde (Multi-Select) */}
                    <div className="col-span-1 md:col-span-1">
                        <label className="text-xs text-gray-500 mb-1 flex items-center gap-1 font-bold uppercase tracking-wider">
                            <MapPin size={12} />Onde (Culturas)
                        </label>
                        {readOnly ? (
                            <div className="flex flex-wrap gap-1">
                                {(Array.isArray(item.onde) ? item.onde : [item.onde]).map((o: any) => (
                                    <span key={o} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">{o}</span>
                                ))}
                            </div>
                        ) : (
                            <MultiSelectCulturas
                                value={Array.isArray(item.onde) ? item.onde : (item.onde ? [item.onde] : [])}
                                options={opcoesCulturas}
                                onChange={(val) => handleItemChange(item.id, 'onde', val)}
                                disabled={readOnly}
                            />
                        )}
                    </div>

                    {/* Quando / Frequência */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Quando / Frequência?</label>
                        <input
                            type="text"
                            value={item.quando || ''}
                            onChange={(e) => handleItemChange(item.id, 'quando', e.target.value)}
                            disabled={readOnly}
                            placeholder="Ex: No plantio, a cada 15 dias..."
                            className={inputCls}
                        />
                    </div>

                    {/* Dose */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Dose Aplicada</label>
                        <div className="flex gap-1">
                            <input
                                type="number"
                                value={item.dose_valor ?? ''}
                                onChange={(e) => handleItemChange(item.id, 'dose_valor', e.target.value)}
                                disabled={readOnly}
                                placeholder="Valor"
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

                    {/* Procedência (IMA) */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Procedência</label>
                        <select
                            value={item.procedencia || 'Interna'}
                            onChange={(e) => handleItemChange(item.id, 'procedencia', e.target.value)}
                            disabled={readOnly}
                            className={inputCls}
                        >
                            <option value="Interna">Interna (Propriedade)</option>
                            <option value="Externa">Externa (Compra/Doação)</option>
                        </select>
                    </div>

                    {/* Composição (IMA) */}
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Composição</label>
                        <input
                            type="text"
                            value={item.composicao || ''}
                            onChange={(e) => handleItemChange(item.id, 'composicao', e.target.value)}
                            disabled={readOnly}
                            placeholder="Ex: NPK, Orgânico..."
                            className={inputCls}
                        />
                    </div>

                    {/* Marca (IMA) */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 mb-1 block font-bold uppercase tracking-wider">Marca/Fabricante</label>
                            <input
                                type="text"
                                value={item.marca || ''}
                                onChange={(e) => handleItemChange(item.id, 'marca', e.target.value)}
                                disabled={readOnly}
                                placeholder="Nome do Fabricante"
                                className={inputCls}
                            />
                        </div>

                        {!readOnly && (
                            <button
                                type="button"
                                title="Remover esta aplicação"
                                onClick={() => handleRemoveItem(item.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shadow-sm md:mb-[1px]"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-3">
            {groupedData.length === 0 ? (
                <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <FlaskConical size={48} className="mx-auto mb-3 opacity-30 text-green-600" />
                    <p className="font-semibold text-gray-600">Nenhum insumo registrado</p>
                    <p className="text-sm text-gray-400 mt-1">Adicione adubos, defensivos ou manejos.</p>
                </div>
            ) : (
                groupedData.map(group => {
                    const isExpanded = expandedGroup === group.nome;
                    return (
                        <div key={group.nome} className={`rounded-lg border transition-all overflow-visible ${isExpanded ? 'border-green-500 shadow-md' : 'border-gray-200 hover:border-gray-300 shadow-sm'}`}>
                            {/* Accordion Summary */}
                            <button
                                type="button"
                                onClick={() => handleAccordionChange(group.nome)({} as any, !isExpanded)}
                                className={`w-full flex items-center justify-between p-3.5 text-left transition-colors ${isExpanded ? 'bg-green-50 rounded-t-lg' : 'bg-white hover:bg-gray-50 rounded-lg'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${isExpanded ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600'}`}>
                                        <FlaskConical size={18} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 leading-tight">{group.nome}</span>
                                        <span className="text-xs text-gray-500 font-medium">
                                            {group.items.length} {group.items.length === 1 ? 'aplicação registrada' : 'aplicações registradas'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ChevronDown size={20} className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {/* Accordion Details */}
                            {isExpanded && (
                                <div className="p-4 bg-gray-50 border-t border-gray-100 rounded-b-lg overflow-visible animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="flex flex-col gap-3">
                                        {group.items.map(renderItemRow)}

                                        {!readOnly && (
                                            <div className="mt-2 pt-3 border-t border-gray-200">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddLocalToGroup(group.nome)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-200"
                                                >
                                                    <PlusCircle size={16} />
                                                    Adicionar nova aplicação de {group.nome}
                                                </button>
                                            </div>
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
                    type="button"
                    onClick={() => setIsAddDialogOpen(true)}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-green-700 border-2 border-dashed border-green-300 rounded-xl hover:bg-green-50 hover:border-green-400 transition-all duration-200"
                >
                    <PlusCircle size={20} />
                    Adicionar Novo Tipo de Insumo ou Manejo
                </button>
            )}

            {/* Add Dialog (Modal) */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-300" onClick={() => setIsAddDialogOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">Novo Insumo ou Manejo</h3>
                            <button type="button" onClick={() => setIsAddDialogOpen(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-400"><X size={20} /></button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                            O que você vai aplicar? (Ex: Esterco bovino, Calda Bordalesa, Capina manual).
                        </p>

                        <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl mb-4">
                            <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-700 font-medium">
                                Dica: Agrupamos automaticamente os lançamentos por nome de insumo para facilitar a leitura.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Nome do Insumo/Manejo</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Ex: Adubo Orgânico"
                                    value={newItemName}
                                    onChange={(e) => setNewItemName(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className={`${inputCls} py-2.5 px-3 text-base`}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddDialogOpen(false)}
                                    className="flex-1 py-2.5 px-4 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmAddItem}
                                    disabled={!newItemName.trim()}
                                    className="flex-[2] py-2.5 px-4 text-sm font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-green-100"
                                >
                                    Confirmar Insumo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupedInsumosList;
