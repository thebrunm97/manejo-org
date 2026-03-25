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
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 mb-2">
                 <div className="p-1.5 bg-green-100 rounded-lg">
                    <Sprout size={18} className="text-green-700" />
                 </div>
                 <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Detalhes do Plantio</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                    <label htmlFor="metodo-propagacao-select" className="block text-sm font-semibold text-slate-900 mb-1.5">Método</label>
                    <select
                        id="metodo-propagacao-select"
                        value={draft.metodoPropagacao}
                        onChange={e => updateDraft('metodoPropagacao', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white appearance-none font-medium text-slate-700 transition-all"
                    >
                        <option value="Muda">Muda (Transplante)</option>
                        <option value="Semente">Semente (Semeadura)</option>
                        <option value="Estaca">Estaca/Bulbo</option>
                    </select>
                </div>
                <div className="sm:col-span-1">
                    <label htmlFor="qtd-plantio" className="block text-sm font-semibold text-slate-900 mb-1.5">Quantidade</label>
                    <input
                        id="qtd-plantio"
                        type="number"
                        value={draft.qtdPlantio}
                        onChange={e => updateDraft('qtdPlantio', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border transition-all font-medium text-slate-700"
                    />
                </div>
                <div className="sm:col-span-1">
                    <UnitSelect 
                        value={draft.unidadePlantio} 
                        fieldName="unidadePlantio" 
                        options={UNIDADES_PLANTIO} 
                        label="Unidade" 
                        id="unidade-plantio-select"
                        onChange={updateDraft}
                    />
                </div>
            </div>

            {/* Perda / Descarte */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <input
                        id="houve-descartes-plantio-check"
                        type="checkbox"
                        checked={draft.houveDescartes}
                        onChange={e => updateDraft('houveDescartes', e.target.checked)}
                        className="h-6 w-6 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded-lg transition-all"
                    />
                    <label htmlFor="houve-descartes-plantio-check" className="block text-sm font-bold text-slate-900 cursor-pointer select-none">
                        Houve descartes (perdas) no plantio?
                    </label>
                </div>

                {draft.houveDescartes && (
                    <div className="pl-2 animate-in fade-in slide-in-from-left-2 duration-300 grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="qtd-descartes-plantio-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Qtd. Descartes</label>
                            <input
                                id="qtd-descartes-plantio-input"
                                type="number"
                                value={draft.qtdDescartes}
                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all
                                    ${errors.qtdDescartes ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                `}
                            />
                            {errors.qtdDescartes && <p className="mt-1 text-xs text-red-600 font-medium">{errors.qtdDescartes}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidadeDescartes}
                                fieldName="unidadeDescartes"
                                options={UNIDADES_PLANTIO}
                                label="Unidade"
                                id="unidade-descartes-plantio-select"
                                onChange={updateDraft}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};;

export default PlantioTab;
