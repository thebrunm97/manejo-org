import React from 'react';
import { UnitType } from '../../../../types/CadernoTypes';
import { VendasDraft } from '../../../../hooks/manual-record';
import { ShoppingCart, User, DollarSign, FileText, Package } from 'lucide-react';

interface VendasTabProps {
    draft: VendasDraft;
    updateDraft: (field: string, value: any) => void;
}

const VendasTab: React.FC<VendasTabProps> = ({ draft, updateDraft }) => {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Seção 1: Volume */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-green-100 rounded-lg">
                        <Package size={18} className="text-green-700" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Volume e Identificação</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                            Quantidade
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            value={draft.quantidade || ''}
                            onChange={(e) => updateDraft('quantidade', e.target.value)}
                            className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border font-medium text-slate-700 transition-all"
                            placeholder="0.00"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                            Unidade
                        </label>
                        <select
                            value={draft.unidade || UnitType.KG}
                            onChange={(e) => updateDraft('unidade', e.target.value)}
                            className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 appearance-none transition-all"
                        >
                            {(Object.values(UnitType) as string[]).map((u) => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Seção 2: Destinação e Rastreabilidade */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                        <ShoppingCart size={18} className="text-emerald-700" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Destinação e Rastreabilidade</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                            Tipo de Destinação
                        </label>
                        <select
                            value={draft.destinacao || 'venda'}
                            onChange={(e) => updateDraft('destinacao', e.target.value)}
                            className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white font-medium text-slate-700 appearance-none transition-all"
                        >
                            <option value="venda">Venda (Comercialização)</option>
                            <option value="doacao">Doação</option>
                            <option value="consumo proprio">Consumo Próprio</option>
                            <option value="processamento">Processamento / Agroindústria</option>
                            <option value="perda">Perda / Descarte</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                            Nota Fiscal / Recibo
                        </label>
                        <div className="relative">
                            <FileText size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={draft.nf || ''}
                                onChange={(e) => updateDraft('nf', e.target.value)}
                                className="block w-full h-12 pl-11 pr-4 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base py-2 border font-medium text-slate-700 transition-all placeholder:text-slate-400"
                                placeholder="Nº Documento"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Seção 3: Comercial */}
            <div className={`p-4 sm:p-5 rounded-xl border transition-all duration-300 ${
                draft.destinacao === 'venda' 
                    ? 'bg-blue-50 border-blue-100 shadow-sm' 
                    : 'bg-slate-50 border-slate-100 opacity-60 grayscale'
            }`}>
                <div className="flex items-center gap-2 mb-4">
                    <div className={`p-1.5 rounded-lg ${draft.destinacao === 'venda' ? 'bg-blue-100' : 'bg-slate-200'}`}>
                        <DollarSign size={18} className={draft.destinacao === 'venda' ? 'text-blue-700' : 'text-slate-500'} />
                    </div>
                    <h4 className={`text-sm font-bold uppercase tracking-tight ${draft.destinacao === 'venda' ? 'text-blue-900' : 'text-slate-500'}`}>
                        Dados Comerciais {draft.destinacao !== 'venda' && '(Opcional)'}
                    </h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className={`block text-sm font-semibold mb-1.5 ${draft.destinacao === 'venda' ? 'text-blue-900' : 'text-slate-500'}`}>
                            Comprador / Cliente
                        </label>
                        <div className="relative">
                            <User size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                            <input
                                type="text"
                                value={draft.cliente || ''}
                                onChange={(e) => updateDraft('cliente', e.target.value)}
                                disabled={draft.destinacao !== 'venda' && draft.destinacao !== 'doacao'}
                                className="block w-full h-12 pl-11 pr-4 rounded-xl border-slate-300 shadow-sm focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 sm:text-base py-2 border font-medium text-slate-700 transition-all disabled:bg-slate-100/50"
                                placeholder="Nome do comprador"
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-sm font-semibold mb-1.5 ${draft.destinacao === 'venda' ? 'text-blue-900' : 'text-slate-500'}`}>
                            Valor Unitário (R$)
                        </label>
                        <div className="relative">
                            <DollarSign size={18} className="absolute left-3.5 top-3.5 text-slate-400" />
                            <input
                                type="number"
                                step="0.01"
                                value={draft.valorUnitario || ''}
                                onChange={(e) => updateDraft('valorUnitario', e.target.value)}
                                disabled={draft.destinacao !== 'venda'}
                                className="block w-full h-12 pl-11 pr-4 rounded-xl border-slate-300 shadow-sm focus:border-blue-600 focus:ring-4 focus:ring-blue-500/20 sm:text-base py-2 border font-medium text-slate-700 transition-all disabled:bg-slate-100/50"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VendasTab;
