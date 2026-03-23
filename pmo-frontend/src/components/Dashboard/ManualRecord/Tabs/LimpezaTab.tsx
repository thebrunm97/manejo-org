import React from 'react';
import { Sparkles } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { LimpezaDraft } from '../../../../hooks/manual-record';

const LimpezaTab: React.FC<ManualRecordTabProps<LimpezaDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-100 space-y-4 shadow-sm">
            <h4 className="text-sm font-bold text-cyan-800 uppercase tracking-wide flex items-center gap-2">
                <Sparkles size={16} /> Controle de Limpeza (Form. 04)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="item-area-input" className="block text-sm font-medium text-gray-700 mb-1">Item ou Área Higienizada</label>
                    <input
                        id="item-area-input"
                        type="text"
                        list="item-area-suggestions"
                        value={draft.itemArea}
                        onChange={e => updateDraft('itemArea', e.target.value)}
                        placeholder="Ex: Trator, Galpão, Caixa d'água"
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                            ${errors.itemArea ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'}
                        `}
                    />
                    <datalist id="item-area-suggestions">
                        <option value="Trator" />
                        <option value="Pulverizador" />
                        <option value="Caixas de Colheita" />
                        <option value="Galpão de Insumos" />
                        <option value="Ferramentas Manuais" />
                        <option value="Caminhão / Veículo" />
                        <option value="Instalações (Banheiros/Copa)" />
                    </datalist>
                    {errors.itemArea && <p className="mt-1 text-xs text-red-600">{errors.itemArea}</p>}
                </div>
                <div>
                    <label htmlFor="tipo-limpeza-select" className="block text-sm font-medium text-gray-700 mb-1">Tipo de Limpeza</label>
                    <select
                        id="tipo-limpeza-select"
                        value={draft.tipoLimpeza}
                        onChange={e => updateDraft('tipoLimpeza', e.target.value)}
                        className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border bg-white
                            ${errors.tipoLimpeza ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'}
                        `}
                    >
                        <option value="">Selecione...</option>
                        <option value="Seca / Varrição">Seca / Varrição</option>
                        <option value="Úmida / Lavagem">Úmida / Lavagem</option>
                        <option value="Desinfecção">Desinfecção</option>
                    </select>
                    {errors.tipoLimpeza && <p className="mt-1 text-xs text-red-600">{errors.tipoLimpeza}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="produto-limpeza-input" className="block text-sm font-medium text-gray-700 mb-1">Produto Utilizado</label>
                    <input
                        id="produto-limpeza-input"
                        type="text"
                        value={draft.produtoUtilizado}
                        onChange={e => updateDraft('produtoUtilizado', e.target.value)}
                        placeholder="Ex: Sabão Neutro, Cloro, Água"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    />
                </div>
                <div>
                    <label htmlFor="dosagem-limpeza-input" className="block text-sm font-medium text-gray-700 mb-1">Dosagem</label>
                    <input
                        id="dosagem-limpeza-input"
                        type="text"
                        value={draft.dosagem}
                        onChange={e => updateDraft('dosagem', e.target.value)}
                        placeholder="Ex: 10ml / Litro ou 'Puro'"
                        className="mt-1 block v-full rounded-md border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 sm:text-sm px-3 py-2 border"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="responsavel-limpeza-input" className="block text-sm font-medium text-gray-700 mb-1">Responsável (Assinatura)</label>
                <input
                    id="responsavel-limpeza-input"
                    type="text"
                    value={draft.responsavel}
                    onChange={e => updateDraft('responsavel', e.target.value)}
                    placeholder="Nome de quem executou"
                    className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                        ${errors.responsavel ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-cyan-500 focus:ring-cyan-500'}
                    `}
                />
                {errors.responsavel && <p className="mt-1 text-xs text-red-600">{errors.responsavel}</p>}
            </div>
        </div>
    );
};

export default LimpezaTab;
