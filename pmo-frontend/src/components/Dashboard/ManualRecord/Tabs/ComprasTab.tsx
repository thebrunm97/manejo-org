import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { ComprasDraft } from '../../../../hooks/manual-record/useRecordValidation';
import { UnitType } from '../../../../types/CadernoTypes';

const ComprasTab: React.FC<ManualRecordTabProps<ComprasDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-2">
                <ShoppingCart size={16} /> Registro de Compra (Form. 06)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="fornecedor-input" className="block text-sm font-medium text-gray-700 mb-1">Fornecedor / Loja</label>
                    <input
                        id="fornecedor-input"
                        type="text"
                        value={draft.fornecedor}
                        onChange={e => updateDraft('fornecedor', e.target.value)}
                        placeholder="Ex: Agropecuária São João"
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                            ${errors.fornecedor ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}
                        `}
                    />
                    {errors.fornecedor && <p className="mt-1 text-xs text-red-600">{errors.fornecedor}</p>}
                </div>
                <div>
                    <label htmlFor="nf-recibo-input" className="block text-sm font-medium text-gray-700 mb-1">NF / Recibo (Opcional)</label>
                    <input
                        id="nf-recibo-input"
                        type="text"
                        value={draft.nfRecibo}
                        onChange={e => updateDraft('nfRecibo', e.target.value)}
                        placeholder="Ex: NF 12345"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="quantidade-input" className="block text-sm font-medium text-gray-700 mb-1">Quantidade Adquirida</label>
                    <input
                        id="quantidade-input"
                        type="number"
                        min="0"
                        step="any"
                        value={draft.quantidade}
                        onChange={e => updateDraft('quantidade', e.target.value)}
                        placeholder="Ex: 10"
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                            ${errors.quantidade ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}
                        `}
                    />
                    {errors.quantidade && <p className="mt-1 text-xs text-red-600">{errors.quantidade}</p>}
                </div>
                <div>
                    <label htmlFor="unidade-select" className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                    <select
                        id="unidade-select"
                        value={draft.unidade}
                        onChange={e => updateDraft('unidade', e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm px-3 py-2 border bg-white"
                    >
                        <optgroup label="Volume/Massa">
                            <option value={UnitType.KG}>Quilogramas (kg)</option>
                            <option value={UnitType.G}>Gramas (g)</option>
                            <option value={UnitType.L}>Litros (L)</option>
                            <option value={UnitType.ML}>Mililitros (ml)</option>
                            <option value={UnitType.TON}>Toneladas (ton)</option>
                        </optgroup>
                        <optgroup label="Unidades">
                            <option value={UnitType.UNID}>Unidade(s)</option>
                            <option value={UnitType.CX}>Caixa(s)</option>
                            <option value={UnitType.MACO}>Maço(s)</option>
                            <option value="sacos">Saco(s)</option>
                            <option value="mudas">Muda(s)</option>
                        </optgroup>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default ComprasTab;
