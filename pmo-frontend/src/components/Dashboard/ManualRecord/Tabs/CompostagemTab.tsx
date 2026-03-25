import React from 'react';
import { Recycle } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { CompostagemDraft } from '../../../../hooks/manual-record';

const CompostagemTab: React.FC<ManualRecordTabProps<CompostagemDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 mb-2">
                 <div className="p-1.5 bg-amber-100 rounded-lg">
                    <Recycle size={18} className="text-amber-700" />
                 </div>
                 <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Registro de Compostagem</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Identificador da Pilha</label>
                    <input
                        type="text"
                        value={draft.nPilha}
                        onChange={(e) => updateDraft('nPilha', e.target.value)}
                        placeholder="Ex: Pilha 01"
                        className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                            ${errors.nPilha ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                        `}
                    />
                    {errors.nPilha && <p className="mt-1 text-xs text-red-600 font-medium">{errors.nPilha}</p>}
                </div>

                <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Ação Realizada</label>
                    <select
                        value={draft.acao}
                        onChange={(e) => updateDraft('acao', e.target.value)}
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 appearance-none transition-all"
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
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Ingredientes / Materiais</label>
                    <textarea
                        value={draft.ingredientes}
                        onChange={(e) => updateDraft('ingredientes', e.target.value)}
                        placeholder="Ex: Esterco bovino, palhada, restos de hortaliças..."
                        className="block w-full rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-3 border font-medium text-slate-700 transition-all"
                        rows={3}
                    />
                </div>
            )}

            {draft.acao === 'Temperatura' && (
                <div className="animate-in fade-in slide-in-from-left-1 duration-200">
                    <div className="w-full sm:w-1/2">
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Temperatura (ºC)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={draft.temperatura}
                            onChange={(e) => updateDraft('temperatura', e.target.value)}
                            placeholder="Ex: 55.5"
                            className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                                ${errors.temperatura ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                            `}
                        />
                        {errors.temperatura && <p className="mt-1 text-xs text-red-600 font-medium">{errors.temperatura}</p>}
                    </div>
                </div>
            )}

            <div className="pt-4 border-t border-slate-200">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Responsável</label>
                <input
                    type="text"
                    value={draft.responsavel}
                    onChange={(e) => updateDraft('responsavel', e.target.value)}
                    placeholder="Nome do responsável"
                    className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border font-medium text-slate-700 transition-all"
                />
            </div>
        </div>
    );
};

export default CompostagemTab;
