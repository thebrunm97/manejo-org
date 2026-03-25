import React from 'react';
import { FileText, ShoppingCart, Package, User } from 'lucide-react';
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Seletor de Subtipo */}
            <div className="bg-slate-100/50 p-2 rounded-xl border border-slate-200 flex flex-wrap gap-2">
                <button
                    onClick={() => updateDraft('tipoOutro', 'outro')}
                    className={`flex-1 min-w-[120px] h-11 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        draft.tipoOutro === 'outro' 
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                            : 'text-slate-500 hover:bg-white/50'
                    }`}
                >
                    <FileText size={16} /> Genérico
                </button>
                <button
                    onClick={() => updateDraft('tipoOutro', 'compra')}
                    className={`flex-1 min-w-[120px] h-11 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        draft.tipoOutro === 'compra' 
                            ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100' 
                            : 'text-slate-500 hover:bg-white/50'
                    }`}
                >
                    <Package size={16} /> Compra
                </button>
                <button
                    onClick={() => updateDraft('tipoOutro', 'venda')}
                    className={`flex-1 min-w-[120px] h-11 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        draft.tipoOutro === 'venda' 
                            ? 'bg-white text-blue-700 shadow-sm border border-blue-100' 
                            : 'text-slate-500 hover:bg-white/50'
                    }`}
                >
                    <ShoppingCart size={16} /> Venda
                </button>
            </div>

            {/* Conteúdo Dinâmico */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-4">
                {draft.tipoOutro === 'compra' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                         <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-emerald-100 rounded-lg">
                                <Package size={18} className="text-emerald-700" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Registro de Compra</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Fornecedor</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={draft.fornecedor || ''}
                                        onChange={e => updateDraft('fornecedor', e.target.value)}
                                        className={`block w-full h-12 pl-11 pr-4 rounded-xl shadow-sm sm:text-base border transition-all font-medium text-slate-700
                                            ${errors.fornecedor ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                        `}
                                        placeholder="Nome do fornecedor"
                                    />
                                </div>
                                {errors.fornecedor && <p className="mt-1 text-xs text-red-600 font-medium">{errors.fornecedor}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Quantidade</label>
                                    <input
                                        type="number"
                                        value={draft.quantidade || ''}
                                        onChange={e => updateDraft('quantidade', e.target.value)}
                                        className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 border transition-all font-medium text-slate-700
                                            ${errors.quantidade ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                        `}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <UnitSelect
                                        value={draft.unidade || UnitType.UNID}
                                        fieldName="unidade"
                                        options={[UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON] as any[]}
                                        id="unidade-outro-select"
                                        onChange={updateDraft}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nº Documento / NF</label>
                                <input
                                    type="text"
                                    value={draft.numeroDocumento || ''}
                                    onChange={e => updateDraft('numeroDocumento', e.target.value)}
                                    className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 border font-medium text-slate-700 transition-all"
                                    placeholder="Nº NF"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Origem</label>
                                <select
                                    value={draft.tipoOrigem || 'compra'}
                                    onChange={e => updateDraft('tipoOrigem', e.target.value)}
                                    className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 border bg-white font-medium text-slate-700 appearance-none transition-all"
                                >
                                    <option value="compra">Compra</option>
                                    <option value="doação">Doação</option>
                                    <option value="produção própria">Produção Própria</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                {draft.tipoOutro === 'venda' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-blue-100 rounded-lg">
                                <ShoppingCart size={18} className="text-blue-700" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Registro de Venda</h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Destino / Cliente</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={draft.destinoVenda || ''}
                                        onChange={e => updateDraft('destinoVenda', e.target.value)}
                                        className={`block w-full h-12 pl-11 pr-4 rounded-xl shadow-sm sm:text-base border transition-all font-medium text-slate-700
                                            ${errors.destinoVenda ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20'}
                                        `}
                                        placeholder="Nome do cliente"
                                    />
                                </div>
                                {errors.destinoVenda && <p className="mt-1 text-xs text-red-600 font-medium">{errors.destinoVenda}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Quantidade</label>
                                    <input
                                        type="number"
                                        value={draft.quantidade || ''}
                                        onChange={e => updateDraft('quantidade', e.target.value)}
                                        className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 border transition-all font-medium text-slate-700
                                            ${errors.quantidade ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20'}
                                        `}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <UnitSelect
                                        value={draft.unidade || UnitType.UNID}
                                        fieldName="unidade"
                                        options={[UnitType.UNID, UnitType.L, UnitType.KG, UnitType.CX, UnitType.MACO, UnitType.TON] as any[]}
                                        id="unidade-outro-venda-select"
                                        onChange={updateDraft}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nº Documento / NF</label>
                                <input
                                    type="text"
                                    value={draft.numeroDocumento || ''}
                                    onChange={e => updateDraft('numeroDocumento', e.target.value)}
                                    className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 sm:text-base px-4 border font-medium text-slate-700 transition-all"
                                    placeholder="Nº NF"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {draft.tipoOutro === 'outro' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-slate-200 rounded-lg">
                                <FileText size={18} className="text-slate-700" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Outros Registros</h4>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Título / Atividade</label>
                            <input
                                type="text"
                                value={draft.produto || ''}
                                onChange={e => updateDraft('produto', e.target.value)}
                                className={`block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 border transition-all font-medium text-slate-700
                                    ${errors.produto ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                                `}
                                placeholder="Do que se trata este registro?"
                            />
                            {errors.produto && <p className="mt-1 text-xs text-red-600 font-medium">{errors.produto}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-900 mb-1.5">Descrição / Detalhes</label>
                            <textarea
                                value={draft.observacao || ''}
                                onChange={e => updateDraft('observacao', e.target.value)}
                                className="block w-full rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-3 border font-medium text-slate-700 transition-all"
                                placeholder="Descreva os detalhes importantes..."
                                rows={4}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Responsável (Geral) */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5">
                <label className="block text-sm font-semibold text-slate-900 mb-1.5">Responsável pelo Registro</label>
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
