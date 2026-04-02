import React from 'react';
import { Package } from 'lucide-react';
import { OutroDraft, ValidationErrors } from '../../../../hooks/manual-record';
import OutroTab from '../Tabs/OutroTab';

interface OutroFormProps {
    formData: OutroDraft;
    updateForm: (field: string, value: any) => void;
    errors: ValidationErrors;
    isEditMode: boolean;
}

const OutroForm: React.FC<OutroFormProps> = ({
    formData,
    updateForm,
    errors,
    isEditMode
}) => {
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
            {/* Informações do Registro Card */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 sm:p-5 space-y-5">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-emerald-100 rounded-lg">
                        <Package size={18} className="text-emerald-700" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Informações do Registro</h4>
                </div>

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
            </div>

            <OutroTab
                draft={formData}
                updateDraft={updateForm}
                errors={errors}
                isEditMode={isEditMode}
            />

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

export default OutroForm;
