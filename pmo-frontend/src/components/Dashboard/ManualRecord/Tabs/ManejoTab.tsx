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
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-blue-800 uppercase tracking-wide flex items-center gap-2">
                <FlaskConical size={16} /> Operação de Manejo
            </h4>

            <div>
                <label htmlFor="subtipo-manejo-select" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Operação</label>
                <select
                    id="subtipo-manejo-select"
                    value={draft.subtipoManejo}
                    onChange={(e) => updateDraft('subtipoManejo', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white"
                    disabled={isEditMode}
                >
                    <option value={ManejoSubtype.MANEJO_CULTURAL}>Manejo Cultural</option>
                    <option value={ManejoSubtype.APLICACAO_INSUMO}>Aplicação de Insumos</option>
                    <option value={ManejoSubtype.HIGIENIZACAO}>Higienização</option>
                </select>
            </div>

            <p className="text-xs text-gray-500 italic border-l-2 border-blue-200 pl-2">
                Preencha os dados abaixo conforme a operação:
            </p>

            {draft.subtipoManejo === ManejoSubtype.APLICACAO_INSUMO && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="insumo-input" className="block text-sm font-medium text-gray-700 mb-1">Insumo Utilizado</label>
                            <input
                                id="insumo-input"
                                type="text"
                                value={draft.insumo}
                                onChange={e => {
                                    updateDraft('insumo', e.target.value);
                                    if (checkInsumoOrganico) checkInsumoOrganico(e.target.value);
                                }}
                                placeholder="Ex: Bokashi, Calda Bordalesa"
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                     ${errors.insumo ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                                 `}
                            />
                            {errors.insumo && <p className="mt-1 text-xs text-red-600">{errors.insumo}</p>}
                        </div>
                        <div>
                            <label htmlFor="equipamento-input" className="block text-sm font-medium text-gray-700 mb-1">Equipamento</label>
                            <input
                                id="equipamento-input"
                                type="text"
                                value={draft.equipamento}
                                onChange={e => updateDraft('equipamento', e.target.value)}
                                placeholder="Ex: Pulverizador Costal"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                            />
                        </div>
                    </div>

                    {organicWarning && (
                        <div className="bg-amber-50 border-l-4 border-amber-400 p-2 rounded-r-md">
                            <p className="text-xs text-amber-700">{organicWarning.msg}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                        <div>
                            <label htmlFor="dosagem-input" className="block text-sm font-medium text-gray-700 mb-1">Dosagem</label>
                            <input
                                id="dosagem-input"
                                type="text"
                                value={draft.dosagem}
                                onChange={e => updateDraft('dosagem', e.target.value)}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                    ${errors.dosagem ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                                `}
                            />
                            {errors.dosagem && <p className="mt-1 text-xs text-red-600">{errors.dosagem}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidadeDosagem}
                                fieldName="unidadeDosagem"
                                options={UNIDADES_MANEJO}
                                label="Unid."
                                id="unidade-dosagem-manejo-select"
                                onChange={updateDraft}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="tipo-manejo-select" className="block text-sm font-medium text-gray-700 mb-1">Categoria (Opcional)</label>
                        <select
                            id="tipo-manejo-select"
                            value={draft.tipoManejo}
                            onChange={e => updateDraft('tipoManejo', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border bg-white"
                        >
                            <option value="Adubação">Adubação</option>
                            <option value="Fitossanitário">Fitossanitário</option>
                            <option value="Irrigação">Irrigação</option>
                            <option value="Outro">Outro</option>
                        </select>
                    </div>
                </>
            )}

            {draft.subtipoManejo === ManejoSubtype.HIGIENIZACAO && (
                <>
                    <div>
                        <label htmlFor="item-higienizado-input" className="block text-sm font-medium text-gray-700 mb-1">Item Higienizado</label>
                        <input
                            id="item-higienizado-input"
                            type="text"
                            value={draft.itemHigienizado}
                            onChange={e => updateDraft('itemHigienizado', e.target.value)}
                            placeholder="Ex: Caixas Colheita, Ferramentas"
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                ${errors.itemHigienizado ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                            `}
                        />
                        {errors.itemHigienizado && <p className="mt-1 text-xs text-red-600">{errors.itemHigienizado}</p>}
                    </div>
                    <div>
                        <label htmlFor="produto-utilizado-input" className="block text-sm font-medium text-gray-700 mb-1">Produto Utilizado</label>
                        <input
                            id="produto-utilizado-input"
                            type="text"
                            value={draft.produtoUtilizado}
                            onChange={e => updateDraft('produtoUtilizado', e.target.value)}
                            placeholder="Ex: Hipoclorito, Detergente neutro"
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                ${errors.produtoUtilizado ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                            `}
                        />
                        {errors.produtoUtilizado && <p className="mt-1 text-xs text-red-600">{errors.produtoUtilizado}</p>}
                    </div>
                </>
            )}

            {draft.subtipoManejo === ManejoSubtype.MANEJO_CULTURAL && (
                <>
                    <div>
                        <label htmlFor="atividade-cultural-input" className="block text-sm font-medium text-gray-700 mb-1">Atividade Realizada</label>
                        <input
                            id="atividade-cultural-input"
                            type="text"
                            value={draft.atividadeCultural}
                            onChange={e => updateDraft('atividadeCultural', e.target.value)}
                            placeholder="Ex: Capina, Poda, Desbaste"
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                ${errors.atividadeCultural ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'}
                            `}
                        />
                        {errors.atividadeCultural && <p className="mt-1 text-xs text-red-600">{errors.atividadeCultural}</p>}
                    </div>
                    <div>
                        <label htmlFor="qtd-trabalhadores-input" className="block text-sm font-medium text-gray-700 mb-1">Qtd. Trabalhadores</label>
                        <input
                            id="qtd-trabalhadores-input"
                            type="number"
                            value={draft.qtdTrabalhadores}
                            onChange={e => updateDraft('qtdTrabalhadores', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>
                </>
            )}

            <div>
                <label htmlFor="responsavel-input" className="block text-sm font-medium text-gray-700 mb-1">Responsável Técnico / Operador</label>
                <input
                    id="responsavel-input"
                    type="text"
                    value={draft.responsavel}
                    onChange={e => updateDraft('responsavel', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                />
            </div>
        </div>
    );
};

export default ManejoTab;
