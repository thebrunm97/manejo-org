import React from 'react';
import { FlaskConical } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { ManejoDraft, UNIDADES_MANEJO } from '../../../../hooks/manual-record';
import { ManejoSubtype } from '../../../../types/CadernoTypes';
import UnitSelect from '../Common/UnitSelect';

const ManejoTab: React.FC<ManualRecordTabProps<ManejoDraft>> = ({
    draft,
    updateDraft,
    errors,
    isEditMode,
    checkInsumoOrganico,
    organicWarning
}) => {
    return (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-6">
            <div className="flex items-center gap-2 mb-2">
                 <div className="p-1.5 bg-blue-100 rounded-lg">
                    <FlaskConical size={18} className="text-blue-700" />
                 </div>
                 <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Operação de Manejo</h4>
            </div>

            <div className="space-y-4">
                <div>
                    <label htmlFor="subtipo-manejo-select" className="block text-sm font-semibold text-slate-900 mb-1.5">Tipo de Operação</label>
                    <select
                        id="subtipo-manejo-select"
                        value={draft.subtipoManejo}
                        onChange={(e) => updateDraft('subtipoManejo', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 appearance-none transition-all"
                        disabled={isEditMode}
                    >
                        <option value={ManejoSubtype.MANEJO_CULTURAL}>Manejo Cultural</option>
                        <option value={ManejoSubtype.APLICACAO_INSUMO}>Aplicação de Insumos</option>
                        <option value={ManejoSubtype.HIGIENIZACAO}>Higienização</option>
                    </select>
                </div>

                <div className="bg-blue-50/50 border-l-4 border-blue-200 p-3 rounded-r-lg">
                    <p className="text-xs text-blue-700 font-bold italic uppercase tracking-wider">
                        Detalhes da Operação selecionada
                    </p>
                </div>
            </div>

            {draft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO && (
                <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="insumo-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Insumo Utilizado</label>
                            <input
                                id="insumo-input"
                                type="text"
                                value={draft.insumo}
                                onChange={e => {
                                    updateDraft('insumo', e.target.value);
                                    if (checkInsumoOrganico) checkInsumoOrganico(e.target.value);
                                }}
                                placeholder="Ex: Bokashi, Calda Bordalesa"
                                className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                                     ${errors.insumo ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                 `}
                            />
                            {errors.insumo && <p className="mt-1 text-xs text-red-600 font-medium">{errors.insumo}</p>}
                        </div>
                        <div>
                            <label htmlFor="equipamento-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Equipamento</label>
                            <input
                                id="equipamento-input"
                                type="text"
                                value={draft.equipamento}
                                onChange={e => updateDraft('equipamento', e.target.value)}
                                placeholder="Ex: Pulverizador Costal"
                                className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border font-medium text-slate-700 transition-all"
                            />
                        </div>
                    </div>

                    {organicWarning && (
                        <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg shadow-sm">
                            <p className="text-xs text-amber-800 font-semibold">{organicWarning.msg}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label htmlFor="dosagem-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Dosagem</label>
                            <input
                                id="dosagem-input"
                                type="text"
                                value={draft.dosagem}
                                onChange={e => updateDraft('dosagem', e.target.value)}
                                className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                                    ${errors.dosagem ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                `}
                            />
                            {errors.dosagem && <p className="mt-1 text-xs text-red-600 font-medium">{errors.dosagem}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidadeDosagem}
                                fieldName="unidadeDosagem"
                                options={UNIDADES_MANEJO}
                                label="Unidade"
                                id="unidade-dosagem-manejo-select"
                                onChange={updateDraft}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="tipo-manejo-select" className="block text-sm font-semibold text-slate-900 mb-1.5">Categoria (Opcional)</label>
                        <select
                            id="tipo-manejo-select"
                            value={draft.tipoManejo}
                            onChange={e => updateDraft('tipoManejo', e.target.value)}
                            className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 appearance-none transition-all"
                        >
                            <option value="Adubação">Adubação</option>
                            <option value="Fitossanitário">Fitossanitário</option>
                            <option value="Irrigação">Irrigação</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                </div>
            )}

            {draft.subtipoManejo === ManejoSubtype.HIGIENIZACAO && (
                <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                    <div>
                        <label htmlFor="item-higienizado-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Item Higienizado</label>
                        <input
                            id="item-higienizado-input"
                            type="text"
                            value={draft.itemHigienizado}
                            onChange={e => updateDraft('itemHigienizado', e.target.value)}
                            placeholder="Ex: Caixas Colheita, Ferramentas"
                            className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                                ${errors.itemHigienizado ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                            `}
                        />
                        {errors.itemHigienizado && <p className="mt-1 text-xs text-red-600 font-medium">{errors.itemHigienizado}</p>}
                    </div>
                    <div>
                        <label htmlFor="produto-utilizado-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Produto Utilizado</label>
                        <input
                            id="produto-utilizado-input"
                            type="text"
                            value={draft.produtoUtilizado}
                            onChange={e => updateDraft('produtoUtilizado', e.target.value)}
                            placeholder="Ex: Hipoclorito, Detergente neutro"
                            className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                                ${errors.produtoUtilizado ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                            `}
                        />
                        {errors.produtoUtilizado && <p className="mt-1 text-xs text-red-600 font-medium">{errors.produtoUtilizado}</p>}
                    </div>
                </div>
            )}

            {draft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL && (
                <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                    <div>
                        <label htmlFor="atividade-cultural-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Atividade Realizada</label>
                        <input
                            id="atividade-cultural-input"
                            type="text"
                            value={draft.atividadeCultural}
                            onChange={e => updateDraft('atividadeCultural', e.target.value)}
                            placeholder="Ex: Capina, Poda, Desbaste"
                            className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                                ${errors.atividadeCultural ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                            `}
                        />
                        {errors.atividadeCultural && <p className="mt-1 text-xs text-red-600 font-medium">{errors.atividadeCultural}</p>}
                    </div>
                    <div>
                        <label htmlFor="qtd-trabalhadores-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Qtd. Trabalhadores</label>
                        <input
                            id="qtd-trabalhadores-input"
                            type="number"
                            value={draft.qtdTrabalhadores}
                            onChange={e => updateDraft('qtdTrabalhadores', e.target.value)}
                            className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border font-medium text-slate-700 transition-all"
                        />
                    </div>
                </div>
            )}

            <div className="pt-4 border-t border-slate-200">
                <label htmlFor="responsavel-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Responsável Técnico / Operador</label>
                <input
                    id="responsavel-input"
                    type="text"
                    value={draft.responsavel}
                    onChange={e => updateDraft('responsavel', e.target.value)}
                    placeholder="Quem realizou a atividade?"
                    className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border font-medium text-slate-700 transition-all"
                />
            </div>
        </div>
    );
};

export default ManejoTab;
