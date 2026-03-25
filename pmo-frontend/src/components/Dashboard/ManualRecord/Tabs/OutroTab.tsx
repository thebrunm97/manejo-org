import React from 'react';
import { FileText, User } from 'lucide-react';
import { ManualRecordTabProps } from '../types';
import { OutroDraft } from '../../../../hooks/manual-record';

const OutroTab: React.FC<ManualRecordTabProps<OutroDraft>> = ({
    draft,
    updateDraft,
    errors
}) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Header / Contexto da Atividade */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-slate-200 rounded-lg">
                        <FileText size={18} className="text-slate-700" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Atividade Geral de Manejo</h4>
                </div>

                <div className="space-y-4 animate-in fade-in duration-300">
                    <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Descrição da Atividade</label>
                        <input
                            type="text"
                            value={draft.produto || ''}
                            onChange={e => updateDraft('produto', e.target.value)}
                            className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 border transition-all font-medium text-slate-700
                                ${errors.produto ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                            `}
                            placeholder="Ex: Manutenção de cercas, Limpeza de canais..."
                        />
                        {errors.produto && <p className="mt-1 text-xs text-red-600 font-medium">{errors.produto}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">Observações de Campo</label>
                        <textarea
                            value={draft.observacao || ''}
                            onChange={e => updateDraft('observacao', e.target.value)}
                            className="block w-full rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-3 border font-medium text-slate-700 transition-all"
                            placeholder="Descreva os detalhes importantes para auditoria..."
                            rows={4}
                        />
                    </div>
                </div>
            </div>

            {/* Responsável (Geral) */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Responsável pela Atividade</label>
                <div className="relative">
                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                        type="text"
                        value={draft.responsavel || ''}
                        onChange={e => updateDraft('responsavel', e.target.value)}
                        className="block w-full h-12 pl-11 pr-4 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base py-2 border font-medium text-slate-700 transition-all"
                        placeholder="Nome do responsável"
                    />
                </div>
            </div>
        </div>
    );
};

export default OutroTab;
