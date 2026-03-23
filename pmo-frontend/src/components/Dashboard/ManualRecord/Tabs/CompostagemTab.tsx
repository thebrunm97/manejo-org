import React from 'react';
import { CompostagemDraft } from '../../../../hooks/manual-record';
import { ManualRecordTabProps } from '../types';

const CompostagemTab: React.FC<ManualRecordTabProps<CompostagemDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Identificador da Pilha</label>
                    <input
                        type="text"
                        value={draft.nPilha}
                        onChange={(e) => updateDraft('nPilha', e.target.value)}
                        placeholder="Ex: Pilha 01"
                        className={`block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                            ${errors.nPilha ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'}
                        `}
                    />
                    {errors.nPilha && <p className="mt-1 text-xs text-red-600">{errors.nPilha}</p>}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ação Realizada</label>
                    <select
                        value={draft.acao}
                        onChange={(e) => updateDraft('acao', e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border"
                    >
                        <option value="Nova Pilha">Nova Pilha (Montagem)</option>
                        <option value="Revirada">Revirada</option>
                        <option value="Temperatura">Controle de Temperatura</option>
                        <option value="Agua">Adição de Água</option>
                        <option value="Uso">Uso / Ensaque</option>
                    </select>
                </div>
            </div>

            {draft.acao === 'Nova Pilha' && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ingredientes / Materiais</label>
                    <textarea
                        value={draft.ingredientes}
                        onChange={(e) => updateDraft('ingredientes', e.target.value)}
                        placeholder="Ex: Esterco bovino, palhada, restos de hortaliças..."
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border"
                        rows={3}
                    />
                </div>
            )}

            {draft.acao === 'Temperatura' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-1 duration-200">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Temperatura (ºC)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={draft.temperatura}
                            onChange={(e) => updateDraft('temperatura', e.target.value)}
                            placeholder="Ex: 55.5"
                            className={`block w-full rounded-md shadow-sm sm:text-sm px-3 py-2 border 
                                ${errors.temperatura ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-green-500 focus:ring-green-500'}
                            `}
                        />
                        {errors.temperatura && <p className="mt-1 text-xs text-red-600">{errors.temperatura}</p>}
                    </div>
                </div>
            )}

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                <input
                    type="text"
                    value={draft.responsavel}
                    onChange={(e) => updateDraft('responsavel', e.target.value)}
                    placeholder="Nome do responsável"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border"
                />
            </div>
        </div>
    );
};

export default CompostagemTab;
