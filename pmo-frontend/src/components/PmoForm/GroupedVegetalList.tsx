// src/components/PmoForm/GroupedVegetalList.tsx
// Refatorado — Zero MUI. Usa Tailwind + lucide-react.

import React, { useCallback, useState, useEffect } from 'react';
import { ChevronDown, Trash2, PlusCircle, Sprout, MapPin, Download, Info } from 'lucide-react';

// @ts-ignore - Legacy JS component
import SeletorLocalizacaoSaf from './SeletorLocalizacaoSaf';
import { useVegetalGrouping } from '../../hooks/pmo/useVegetalGrouping';
import VegetalImportDialog from './VegetalImportDialog';

// ==================================================================
// ||                         INTERFACES                           ||
// ==================================================================

import { VegetalItem } from '../../domain/pmo/pmoTypes';

interface GroupedVegetalListProps {
    data: VegetalItem[];
    onDataChange: (newData: VegetalItem[]) => void;
    readOnly?: boolean;
    pmoId: string | number | undefined;
    propriedadeId?: number;
}

// ==================================================================
// ||                    HELPER FUNCTIONS                          ||
// ==================================================================

const getDisplayLocation = (loc: VegetalItem['talhoes_canteiros']): string => {
    if (!loc) return 'Não informado';
    if (typeof loc === 'string') return loc || 'Não informado';
    if (loc._display) return loc._display;
    if (loc.talhao_nome || loc.canteiro_nome) {
        return `${loc.talhao_nome || '?'} › ${loc.canteiro_nome || '?'}`;
    }
    return 'Não informado';
};

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

// ==================================================================
// ||                    COMPONENT DEFINITION                      ||
// ==================================================================

const GroupedVegetalList: React.FC<GroupedVegetalListProps> = ({
    data,
    onDataChange,
    readOnly = false,
    pmoId,
    propriedadeId
}) => {
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const isMobile = useIsMobile();

    const {
        groupedData,
        expandedGroup,
        isAddDialogOpen,
        newCultureName,
        setNewCultureName,
        handleAccordionChange,
        handleItemChange,
        handleRemoveItem,
        handleAddLocalToGroup,
        handleOpenAddDialog,
        handleCloseAddDialog,
        handleConfirmAddCulture
    } = useVegetalGrouping(data, onDataChange);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmAddCulture();
        }
    }, [handleConfirmAddCulture]);

    const handleImportSuccess = useCallback((importedItems: VegetalItem[]) => {
        if (importedItems.length > 0) {
            onDataChange([...data, ...importedItems]);
        }
    }, [data, onDataChange]);

    const inputCls = "w-full border border-gray-300 rounded-md p-1.5 text-sm focus:ring-1 focus:ring-green-500 focus:border-green-500";

    // --- RENDER ITEM ---
    const renderItemRow = (item: VegetalItem, index: number) => {
        const uniqueKey = item.id ? `item-${item.id}` : `fallback-${index}-${Date.now()}`;
        return (
            <div
                key={uniqueKey}
                className={`flex ${isMobile ? 'flex-col' : 'flex-row items-center'} gap-3 p-3 bg-white rounded-lg border border-gray-200`}
            >
                {/* Localização */}
                <div className={`${isMobile ? '' : 'flex-[2]'} min-w-[200px]`}>
                    <label className="text-xs text-gray-500 mb-0.5 flex items-center gap-1">
                        <MapPin size={12} /> Local (Talhão/Canteiro)
                    </label>
                    {readOnly ? (
                        <p className="text-sm text-gray-800">{getDisplayLocation(item.talhoes_canteiros)}</p>
                    ) : (
                        <SeletorLocalizacaoSaf
                            value={item.talhoes_canteiros ?? ''}
                            onChange={(val: any) => handleItemChange(item.id, 'talhoes_canteiros', val)}
                        />
                    )}
                </div>

                {/* Área Plantada */}
                <div className={`${isMobile ? '' : 'flex-1'} min-w-[120px]`}>
                    <label className="text-xs text-gray-500 mb-0.5 block">Área Plantada</label>
                    <div className="flex gap-1">
                        <input
                            type="number"
                            value={item.area_plantada ?? ''}
                            onChange={(e) => handleItemChange(item.id, 'area_plantada', parseFloat(e.target.value) || 0)}
                            disabled={readOnly}
                            min={0}
                            step={0.01}
                            className={`${inputCls} flex-1`}
                        />
                        <select
                            value={item.area_plantada_unidade ?? 'ha'}
                            onChange={(e) => handleItemChange(item.id, 'area_plantada_unidade', e.target.value)}
                            disabled={readOnly}
                            className="border border-gray-300 rounded-md p-1.5 text-sm bg-white min-w-[60px] focus:ring-1 focus:ring-green-500"
                        >
                            <option value="ha">ha</option>
                            <option value="m²">m²</option>
                        </select>
                    </div>
                </div>

                {/* Produção Esperada */}
                <div className={`${isMobile ? '' : 'flex-1'} min-w-[120px]`}>
                    <label className="text-xs text-gray-500 mb-0.5 block">Produção/Ano</label>
                    <div className="flex gap-1">
                        <input
                            type="number"
                            value={item.producao_esperada_ano ?? ''}
                            onChange={(e) => handleItemChange(item.id, 'producao_esperada_ano', parseFloat(e.target.value) || 0)}
                            disabled={readOnly}
                            min={0}
                            className={`${inputCls} flex-1`}
                        />
                        <select
                            value={(item.producao_unidade === 'unid' ? 'unidade' : item.producao_unidade) ?? 'kg'}
                            onChange={(e) => handleItemChange(item.id, 'producao_unidade', e.target.value)}
                            disabled={readOnly}
                            className="border border-gray-300 rounded-md p-1.5 text-sm bg-white min-w-[70px] focus:ring-1 focus:ring-green-500"
                        >
                            <option value="kg">kg</option>
                            <option value="ton">ton</option>
                            <option value="cx">cx</option>
                            <option value="unidade">unid</option>
                            <option value="maço">maço</option>
                        </select>
                    </div>
                </div>

                {/* Remove */}
                {!readOnly && (
                    <div className="flex items-center">
                        <button
                            type="button"
                            title="Remover este local"
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

    // --- RENDER PRINCIPAL ---
    return (
        <div className="flex flex-col gap-3">
            {groupedData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <Sprout size={48} className="mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Nenhuma cultura cadastrada ainda.</p>
                    <p className="text-sm text-gray-400 mt-1">Clique em &quot;Adicionar Nova Cultura&quot; para começar.</p>
                </div>
            ) : (
                groupedData.map((group) => {
                    const isExpanded = expandedGroup === group.nome;
                    return (
                        <div key={group.nome} className={`rounded-lg border transition-colors ${isExpanded ? 'border-green-500' : 'border-gray-200'}`}>
                            {/* Accordion Summary */}
                            <button
                                type="button"
                                onClick={() => handleAccordionChange(group.nome)({} as any, !isExpanded)}
                                className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isExpanded ? 'bg-green-50 rounded-t-lg' : 'bg-white hover:bg-gray-50 rounded-lg'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Sprout size={20} className="text-green-600" />
                                    <span className="font-bold text-gray-800">{group.nome}</span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border border-gray-300 text-gray-600">
                                        {group.items.length} {group.items.length === 1 ? 'local' : 'locais'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Totals Chips */}
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                        {group.totalArea.toFixed(2)} {group.areaUnidade}
                                    </span>
                                    {group.totalProducao > 0 && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                            {group.totalProducao.toLocaleString('pt-BR')} {group.producaoUnidade}
                                        </span>
                                    )}
                                    <ChevronDown size={20} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {/* Accordion Details */}
                            {isExpanded && (
                                <div className="p-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                                    <div className="flex flex-col gap-2">
                                        {group.items.map(renderItemRow)}
                                        {!readOnly && (
                                            <>
                                                <hr className="border-gray-200" />
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddLocalToGroup(group.nome)}
                                                    className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 rounded-lg transition-colors"
                                                >
                                                    <PlusCircle size={16} />
                                                    Adicionar outro local para {group.nome}
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

            {/* Global Buttons */}
            {!readOnly && (
                <>
                    <VegetalImportDialog
                        open={isImportDialogOpen}
                        onClose={() => setIsImportDialogOpen(false)}
                        onImport={handleImportSuccess}
                        currentItems={data}
                        pmoId={pmoId}
                        propriedadeId={propriedadeId}
                    />

                    <div className="flex gap-3 mt-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleOpenAddDialog}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-green-700 border-2 border-dashed border-green-400 rounded-lg hover:bg-green-50 transition-colors min-w-[200px]"
                        >
                            <Sprout size={18} />
                            Adicionar Nova Cultura
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsImportDialogOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                            <Download size={18} />
                            Importar do Caderno
                        </button>
                    </div>
                </>
            )}

            {/* Add Culture Dialog */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm" onClick={handleCloseAddDialog}>
                    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Nova Cultura</h3>
                        <p className="text-sm text-gray-500 mb-3">
                            Digite o nome do que você vai plantar (ex: Tomate, Alface).
                        </p>
                        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-3">
                            <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-blue-800">
                                Dica: Se você digitar uma cultura que já existe na lista, nós vamos agrupar o novo local junto com ela automaticamente!
                            </p>
                        </div>
                        <input
                            autoFocus
                            type="text"
                            placeholder="Ex: Tomate, Alface, Cenoura..."
                            value={newCultureName}
                            onChange={(e) => setNewCultureName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={inputCls}
                        />
                        <p className="text-xs text-gray-400 mt-1 mb-4">Digite o nome e pressione Enter ou clique em Adicionar</p>
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={handleCloseAddDialog} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                            <button
                                type="button"
                                onClick={handleConfirmAddCulture}
                                disabled={!newCultureName.trim()}
                                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Adicionar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GroupedVegetalList;
