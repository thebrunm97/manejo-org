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
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 mb-2">
                 <div className="p-1.5 bg-orange-100 rounded-lg">
                    <Scissors size={18} className="text-orange-700" />
                 </div>
                 <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Rastreabilidade da Colheita</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                    <label htmlFor="lote-input" className="block text-sm font-semibold text-slate-900 mb-1.5">LOTE (Auto-Gerado)</label>
                    <input
                        id="lote-input"
                        type="text"
                        value={draft.lote}
                        onChange={e => updateDraft('lote', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-200 shadow-sm sm:text-base px-4 py-2 border bg-slate-100 text-slate-500 font-bold tracking-wider cursor-not-allowed"
                        readOnly
                    />
                </div>

                <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                        Destino Inicial (Ex: Depósito, Lavagem)
                    </label>
                    <input
                        type="text"
                        value={draft.destino_inicial || ''}
                        onChange={(e) => updateDraft('destino_inicial', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 transition-all"
                        placeholder="Onde o produto foi colocado logo após colher"
                    />
                </div>

                <div>
                    <label htmlFor="qtd-colheita" className="block text-sm font-semibold text-slate-900 mb-1.5">Quantidade Colhida</label>
                    <input
                        id="qtd-colheita"
                        type="number"
                        value={draft.qtdColheita}
                        onChange={e => updateDraft('qtdColheita', e.target.value)}
                        placeholder="0.00"
                        className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                             ${errors.qtdColheita ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                         `}
                    />
                    {errors.qtdColheita && <p className="mt-1 text-xs text-red-600 font-medium">{errors.qtdColheita}</p>}
                </div>
                <div>
                    <UnitSelect
                        value={draft.unidadeColheita}
                        fieldName="unidadeColheita"
                        options={UNIDADES_COLHEITA}
                        label="Unidade"
                        id="unidade-colheita-select"
                        onChange={updateDraft}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="destino-colheita-select" className="block text-sm font-semibold text-slate-900 mb-1.5">Destino Final</label>
                    <select
                        id="destino-colheita-select"
                        value={draft.destino}
                        onChange={e => updateDraft('destino', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 appearance-none transition-all"
                    >
                        <option value="Mercado Interno">Mercado Interno</option>
                        <option value="Exportação">Exportação</option>
                        <option value="Processamento">Processamento</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="classificacao-colheita-select" className="block text-sm font-semibold text-slate-900 mb-1.5">Classificação</label>
                    <select
                        id="classificacao-colheita-select"
                        value={draft.classificacao}
                        onChange={e => updateDraft('classificacao', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 appearance-none transition-all"
                    >
                        <option value="Extra">Extra</option>
                        <option value="Primeira">Primeira</option>
                        <option value="Segunda">Segunda</option>
                    </select>
                </div>
            </div>

            {/* Perda / Descarte Colheita */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                    <input
                        id="houveDescartesC"
                        type="checkbox"
                        checked={draft.houveDescartes}
                        onChange={e => updateDraft('houveDescartes', e.target.checked)}
                        className="h-6 w-6 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded-lg transition-all"
                    />
                    <label htmlFor="houveDescartesC" className="block text-sm font-bold text-slate-900 cursor-pointer select-none">
                        Houve descartes (perdas) na colheita?
                    </label>
                </div>

                {draft.houveDescartes && (
                    <div className="pl-2 animate-in fade-in duration-300 grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="qtd-descartes-colheita" className="block text-sm font-semibold text-slate-900 mb-1.5">Qtd. Descartes</label>
                            <input
                                id="qtd-descartes-colheita"
                                type="number"
                                value={draft.qtdDescartes}
                                onChange={e => updateDraft('qtdDescartes', e.target.value)}
                                className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                                    ${errors.qtdDescartes ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                `}
                            />
                            {errors.qtdDescartes && <p className="mt-1 text-xs text-red-600 font-medium">{errors.qtdDescartes}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidadeDescartes}
                                fieldName="unidadeDescartes"
                                options={UNIDADES_COLHEITA}
                                label="Unidade"
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
