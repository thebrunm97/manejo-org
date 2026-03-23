import React from 'react';
import { Scissors } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { ColheitaDraft, UNIDADES_COLHEITA } from '../../../../hooks/manual-record';
import UnitSelect from '../Common/UnitSelect';

const ColheitaTab: React.FC<ManualRecordTabProps<ColheitaDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-orange-800 uppercase tracking-wide flex items-center gap-2">
                <Scissors size={16} /> Rastreabilidade da Colheita
            </h4>

            <div>
                <label htmlFor="lote-input" className="block text-sm font-medium text-gray-700 mb-1">LOTE (Auto-Gerado)</label>
                <input
                    id="lote-input"
                    type="text"
                    value={draft.lote}
                    onChange={e => updateDraft('lote', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border bg-gray-100 text-gray-600 cursor-not-allowed"
                    readOnly
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                <div>
                    <label htmlFor="qtd-colheita" className="block text-sm font-medium text-gray-700 mb-1">Quantidade Colhida</label>
                    <input
                        id="qtd-colheita"
                        type="number"
                        value={draft.qtdColheita}
                        onChange={e => updateDraft('qtdColheita', e.target.value)}
                        placeholder="0.00"
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                             ${errors.qtdColheita ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-orange-500 focus:ring-orange-500'}
                         `}
                    />
                    {errors.qtdColheita && <p className="mt-1 text-xs text-red-600">{errors.qtdColheita}</p>}
                </div>
                <div>
                    <UnitSelect
                        value={draft.unidadeColheita}
                        fieldName="unidadeColheita"
                        options={UNIDADES_COLHEITA}
                        label="Unid."
                        id="unidade-colheita-select"
                        onChange={updateDraft}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="destino-colheita-select" className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                    <select
                        id="destino-colheita-select"
                        value={draft.destino}
                        onChange={e => updateDraft('destino', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border bg-white"
                    >
                        <option value="Mercado Interno">Mercado Interno</option>
                        <option value="Exportação">Exportação</option>
                        <option value="Processamento">Processamento</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="classificacao-colheita-select" className="block text-sm font-medium text-gray-700 mb-1">Classificação</label>
                    <select
                        id="classificacao-colheita-select"
                        value={draft.classificacao}
                        onChange={e => updateDraft('classificacao', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm px-3 py-2 border bg-white"
                    >
                        <option value="Extra">Extra</option>
                        <option value="Primeira">Primeira</option>
                        <option value="Segunda">Segunda</option>
                    </select>
                </div>
            </div>

            {/* Perda / Descarte Colheita */}
            <div className="space-y-2 pt-2 border-t border-orange-200">
                <div className="flex items-center">
                    <input
                        id="houveDescartesC"
                        type="checkbox"
                        checked={draft.houveDescartes}
                        onChange={e => updateDraft('houveDescartes', e.target.checked)}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                    />
                    <label htmlFor="houveDescartesC" className="ml-2 block text-sm text-gray-900 cursor-pointer select-none">
                        Houve descartes (perdas) na colheita?
                    </label>
                </div>

                {draft.houveDescartes && (
                    <div className="pl-6 grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="qtd-descartes-colheita" className="block text-sm font-medium text-gray-700 mb-1">Qtd. Descartes</label>
                            <input
                                id="qtd-descartes-colheita"
                                type="number"
                                value={draft.qtdDescartes}
                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                    ${errors.qtdDescartes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-orange-500 focus:ring-orange-500'}
                                `}
                            />
                            {errors.qtdDescartes && <p className="mt-1 text-xs text-red-600">{errors.qtdDescartes}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidadeDescartes}
                                fieldName="unidadeDescartes"
                                options={UNIDADES_COLHEITA}
                                label="Unid."
                                id="unidade-descartes-colheita-select"
                                onChange={updateDraft}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ColheitaTab;
