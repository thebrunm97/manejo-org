import React from 'react';
import { Sprout } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { PlantioDraft, UNIDADES_PLANTIO } from '../../../../hooks/manual-record';
import UnitSelect from '../Common/UnitSelect';

const PlantioTab: React.FC<ManualRecordTabProps<PlantioDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="p-4 bg-green-50 rounded-lg border border-green-100 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-green-800 uppercase tracking-wide flex items-center gap-2">
                <Sprout size={16} /> Detalhes do Plantio
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                    <label htmlFor="metodo-propagacao-select" className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                    <select
                        id="metodo-propagacao-select"
                        value={draft.metodoPropagacao}
                        onChange={e => updateDraft('metodoPropagacao', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border bg-white"
                    >
                        <option value="Muda">Muda (Transplante)</option>
                        <option value="Semente">Semente (Semeadura)</option>
                        <option value="Estaca">Estaca/Bulbo</option>
                    </select>
                </div>
                <div className="sm:col-span-1">
                    <label htmlFor="qtd-plantio" className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                    <input
                        id="qtd-plantio"
                        type="number"
                        value={draft.qtdPlantio}
                        onChange={e => updateDraft('qtdPlantio', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border"
                    />
                </div>
                <div className="sm:col-span-1">
                    <UnitSelect 
                        value={draft.unidadePlantio} 
                        fieldName="unidadePlantio" 
                        options={UNIDADES_PLANTIO} 
                        label="Unid." 
                        id="unidade-plantio-select"
                        onChange={updateDraft}
                    />
                </div>
            </div>

            {/* Perda / Descarte */}
            <div className="space-y-2">
                <div className="flex items-center">
                    <input
                        id="houve-descartes-plantio-check"
                        type="checkbox"
                        checked={draft.houveDescartes}
                        onChange={e => updateDraft('houveDescartes', e.target.checked)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                    />
                    <label htmlFor="houve-descartes-plantio-check" className="ml-2 block text-sm text-gray-900 cursor-pointer select-none">
                        Houve descartes (perdas) no plantio?
                    </label>
                </div>

                {draft.houveDescartes && (
                    <div className="pl-6 grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="qtd-descartes-plantio-input" className="block text-sm font-medium text-gray-700 mb-1">Qtd. Descartes</label>
                            <input
                                id="qtd-descartes-plantio-input"
                                type="number"
                                value={draft.qtdDescartes}
                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                    ${errors.qtdDescartes ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'}
                                `}
                            />
                            {errors.qtdDescartes && <p className="mt-1 text-xs text-red-600">{errors.qtdDescartes}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidadeDescartes}
                                fieldName="unidadeDescartes"
                                options={UNIDADES_PLANTIO}
                                label="Unid."
                                id="unidade-descartes-plantio-select"
                                onChange={updateDraft}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlantioTab;
