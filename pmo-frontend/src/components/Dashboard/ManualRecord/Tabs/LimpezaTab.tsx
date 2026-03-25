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
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2 mb-2">
                 <div className="p-1.5 bg-cyan-100 rounded-lg">
                    <Sparkles size={18} className="text-cyan-700" />
                 </div>
                 <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Controle de Limpeza (Form. 04)</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                    <label htmlFor="item-area-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Item ou Área Higienizada</label>
                    <input
                        id="item-area-input"
                        type="text"
                        list="item-area-suggestions"
                        value={draft.itemArea}
                        onChange={e => updateDraft('itemArea', e.target.value)}
                        placeholder="Ex: Trator, Galpão, Caixa d'água"
                        className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                            ${errors.itemArea ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
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
                    {errors.itemArea && <p className="mt-1 text-xs text-red-600 font-medium">{errors.itemArea}</p>}
                </div>
                
                <div>
                    <label htmlFor="tipo-limpeza-select" className="block text-sm font-semibold text-slate-900 mb-1.5">Tipo de Limpeza</label>
                    <select
                        id="tipo-limpeza-select"
                        value={draft.tipoLimpeza}
                        onChange={e => updateDraft('tipoLimpeza', e.target.value)}
                        className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border bg-white appearance-none transition-all font-medium text-slate-700
                            ${errors.tipoLimpeza ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                        `}
                    >
                        <option value="">Selecione...</option>
                        <option value="Seca / Varrição">Seca / Varrição</option>
                        <option value="Úmida / Lavagem">Úmida / Lavagem</option>
                        <option value="Desinfecção">Desinfecção</option>
                    </select>
                    {errors.tipoLimpeza && <p className="mt-1 text-xs text-red-600 font-medium">{errors.tipoLimpeza}</p>}
                </div>

                <div>
                    <label htmlFor="responsavel-limpeza-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Responsável</label>
                    <input
                        id="responsavel-limpeza-input"
                        type="text"
                        value={draft.responsavel}
                        onChange={e => updateDraft('responsavel', e.target.value)}
                        placeholder="Quem executou?"
                        className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all font-medium text-slate-700
                            ${errors.responsavel ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                        `}
                    />
                    {errors.responsavel && <p className="mt-1 text-xs text-red-600 font-medium">{errors.responsavel}</p>}
                </div>
            </div>

            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label htmlFor="produto-limpeza-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Produto Utilizado</label>
                    <input
                        id="produto-limpeza-input"
                        type="text"
                        value={draft.produtoUtilizado}
                        onChange={e => updateDraft('produtoUtilizado', e.target.value)}
                        placeholder="Ex: Sabão Neutro, Cloro"
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border font-medium text-slate-700 transition-all"
                    />
                </div>
                <div>
                    <label htmlFor="dosagem-limpeza-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Dosagem</label>
                    <input
                        id="dosagem-limpeza-input"
                        type="text"
                        value={draft.dosagem}
                        onChange={e => updateDraft('dosagem', e.target.value)}
                        placeholder="Ex: 10ml / Litro"
                        className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border font-medium text-slate-700 transition-all"
                    />
                </div>
            </div>
        </div>
    );
};

export default LimpezaTab;
