import React from 'react';
import { MapPin, X } from 'lucide-react';
import { ColheitaDraft, ValidationErrors } from '../../../../hooks/manual-record';
import ColheitaTab from '../Tabs/ColheitaTab';
import ValorTotalInput from './ValorTotalInput';

interface ColheitaFormProps {
    formData: ColheitaDraft;
    updateForm: (field: string, value: any) => void;
    errors: ValidationErrors;
    isEditMode: boolean;
    onOpenLocation: () => void;
    clearError: (field: string) => void;
}

const ColheitaForm: React.FC<ColheitaFormProps> = ({
    formData,
    updateForm,
    errors,
    isEditMode,
    onOpenLocation,
    clearError
}) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            {/* Informações do Registro Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-5">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                        <MapPin size={18} className="text-emerald-700" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Informações do Registro</h4>
                </div>

                {/* Data & Produto */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                        <label htmlFor="data-hora-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Data e Hora</label>
                        <input
                            id="data-hora-input"
                            type="datetime-local"
                            value={formData.dataHora}
                            onChange={e => updateForm('dataHora', e.target.value)}
                            className={`mt-1 block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all
                                ${errors.data ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                            `}
                        />
                        {errors.data && <p className="mt-1 text-xs text-red-600 font-medium">{errors.data}</p>}
                    </div>

                    <div>
                        <label htmlFor="produto-input" className="block text-sm font-semibold text-slate-900 mb-1.5">Cultura/Produto</label>
                        <input
                            id="produto-input"
                            type="text"
                            value={formData.produto}
                            onChange={e => updateForm('produto', e.target.value)}
                            placeholder="Ex: Alface Americana"
                            className={`mt-1 block w-full h-12 rounded-xl shadow-sm sm:text-base px-4 py-2 border transition-all
                                 ${errors.produto ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                             `}
                        />
                        {errors.produto && <p className="mt-1 text-xs text-red-600 font-medium">{errors.produto}</p>}
                    </div>
                </div>

                {/* Location Selector */}
                <div>
                    <label className={`block text-sm font-semibold mb-1.5 ${errors.locais ? 'text-red-600' : 'text-slate-900'}`}>
                        Talhões / Canteiros {errors.locais && `(${errors.locais})`}
                    </label>
                    <div
                        onClick={() => {
                            onOpenLocation();
                            if (errors.locais) clearError('locais');
                        }}
                        className={`
                            flex flex-wrap gap-2 p-4 border border-dashed rounded-xl min-h-[64px] items-center cursor-pointer transition-all
                            ${errors.locais ? 'border-red-300 bg-red-50' : 'border-slate-300 hover:bg-white hover:border-emerald-500 hover:shadow-md'}
                        `}
                    >
                        {formData.locais.length === 0 && (
                            <div className="flex items-center text-slate-500 text-sm pl-1">
                                <MapPin size={20} className={`mr-2 ${errors.locais ? 'text-red-500' : 'text-slate-400'}`} />
                                <span>Toque para selecionar Talhões ou Canteiros...</span>
                            </div>
                        )}
                        {formData.locais.map(l => (
                            <span key={l} className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                {l}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        updateForm('locais', formData.locais.filter(x => x !== l));
                                    }}
                                    className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full text-emerald-400 hover:bg-emerald-200 hover:text-emerald-700 focus:outline-none"
                                >
                                    <span className="sr-only">Remover</span>
                                    <X size={14} />
                                </button>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Specific Colheita Content */}
            <ColheitaTab
                draft={formData}
                updateDraft={updateForm}
                errors={errors}
                isEditMode={isEditMode}
            />

            {/* Custo da Operação (Integração Financeira Híbrida) */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 sm:p-5">
                <ValorTotalInput
                    id="colheita-valor-total"
                    value={formData.valor_total}
                    onChange={(v) => updateForm('valor_total', v)}
                    hint="Ex: custo com mão de obra, fretes ou embalagens desta colheita."
                />
            </div>

            {/* Campo de Observação Geral */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5">
                <label htmlFor="obs-geral" className="block text-sm font-semibold text-slate-900 mb-1.5">Observações Adicionais</label>
                <textarea
                    id="obs-geral"
                    value={formData.observacao}
                    onChange={e => updateForm('observacao', e.target.value)}
                    rows={3}
                    placeholder="Algum detalhe extra relevante?"
                    className={`mt-1 block w-full rounded-xl shadow-sm sm:text-base px-4 py-3 border transition-all
                         ${errors.observacao ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10' : 'border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20'}
                     `}
                />
                {errors.observacao && <p className="mt-1 text-xs text-red-600 font-medium">{errors.observacao}</p>}
            </div>
        </div>
    );
};

export default ColheitaForm;
