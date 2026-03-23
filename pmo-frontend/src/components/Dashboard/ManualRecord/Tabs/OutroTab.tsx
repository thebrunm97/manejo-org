import React from 'react';
import { Package } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { OutroDraft } from '../../../../hooks/manual-record';
import { UnitType } from '../../../../types/CadernoTypes';
import UnitSelect from '../Common/UnitSelect';

const OutroTab: React.FC<ManualRecordTabProps<OutroDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <Package size={16} /> Tipo de Registro Outro
            </h4>

            <div>
                <label htmlFor="tipo-outro-select" className="block text-sm font-medium text-gray-700 mb-1">Subtipo</label>
                <select
                    id="tipo-outro-select"
                    value={draft.tipoOutro}
                    onChange={e => updateDraft('tipoOutro', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border bg-white"
                >
                    <option value="outro">Genérico / Outro</option>
                    <option value="compra">Compra de Insumo/Produto</option>
                    <option value="venda">Venda / Saída</option>
                </select>
            </div>

            {draft.tipoOutro === 'compra' && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="qtd-outro-compra" className="block text-sm font-medium text-gray-700 mb-1">Quantidade</label>
                            <input
                                id="qtd-outro-compra"
                                type="number"
                                value={draft.quantidade}
                                onChange={e => updateDraft('quantidade', e.target.value)}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                    ${errors.quantidade ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                                `}
                            />
                            {errors.quantidade && <p className="mt-1 text-xs text-red-600">{errors.quantidade}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidade}
                                fieldName="unidade"
                                options={[UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON] as any[]}
                                label="Unid."
                                id="unidade-outro-select"
                                onChange={updateDraft}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="fornecedor-input" className="block text-sm font-medium text-gray-700 mb-1">Fornecedor</label>
                        <input
                            id="fornecedor-input"
                            type="text"
                            value={draft.fornecedor}
                            onChange={e => updateDraft('fornecedor', e.target.value)}
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                ${errors.fornecedor ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                            `}
                        />
                        {errors.fornecedor && <p className="mt-1 text-xs text-red-600">{errors.fornecedor}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="tipo-origem-select" className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                            <select
                                id="tipo-origem-select"
                                value={draft.tipoOrigem}
                                onChange={e => updateDraft('tipoOrigem', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border bg-white"
                            >
                                <option value="compra">Compra</option>
                                <option value="doação">Doação</option>
                                <option value="produção própria">Produção Própria</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="numero-documento-compra-input" className="block text-sm font-medium text-gray-700 mb-1">Nº. Documento / NF</label>
                            <input
                                id="numero-documento-compra-input"
                                type="text"
                                value={draft.numeroDocumento}
                                onChange={e => updateDraft('numeroDocumento', e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border"
                            />
                        </div>
                    </div>
                </>
            )}

            {draft.tipoOutro === 'venda' && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="qtd-outro-venda" className="block text-sm font-medium text-gray-700 mb-1">Quantidade Vendida</label>
                            <input
                                id="qtd-outro-venda"
                                type="number"
                                value={draft.quantidade}
                                onChange={e => updateDraft('quantidade', e.target.value)}
                                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                    ${errors.quantidade ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                                `}
                            />
                            {errors.quantidade && <p className="mt-1 text-xs text-red-600">{errors.quantidade}</p>}
                        </div>
                        <div>
                            <UnitSelect
                                value={draft.unidade}
                                fieldName="unidade"
                                options={[UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON] as any[]}
                                label="Unid."
                                id="unidade-outro-venda-select"
                                onChange={updateDraft}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="destino-venda-input" className="block text-sm font-medium text-gray-700 mb-1">Destino / Cliente</label>
                        <input
                            id="destino-venda-input"
                            type="text"
                            value={draft.destinoVenda}
                            onChange={e => updateDraft('destinoVenda', e.target.value)}
                            className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                ${errors.destinoVenda ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-gray-500 focus:ring-gray-500'}
                            `}
                        />
                        {errors.destinoVenda && <p className="mt-1 text-xs text-red-600">{errors.destinoVenda}</p>}
                    </div>
                    <div>
                        <label htmlFor="numero-documento-venda-input" className="block text-sm font-medium text-gray-700 mb-1">Nº. Documento / NF</label>
                        <input
                            id="numero-documento-venda-input"
                            type="text"
                            value={draft.numeroDocumento}
                            onChange={e => updateDraft('numeroDocumento', e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500 sm:text-sm px-3 py-2 border"
                        />
                    </div>
                </>
            )}
        </div>
    );
};

export default OutroTab;
