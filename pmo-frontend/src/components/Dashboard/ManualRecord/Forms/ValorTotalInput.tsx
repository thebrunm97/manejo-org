import React from 'react';
import { DollarSign } from 'lucide-react';

interface ValorTotalInputProps {
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    id?: string;
    label?: string;
    hint?: string;
    disabled?: boolean;
}

/**
 * Reusable monetary input with R$ prefix for hybrid cost tracking.
 * Allows the user to optionally associate a cost with any field operation.
 * Sends undefined (not 0) when empty so the backend skips the financial ledger INSERT.
 */
const ValorTotalInput: React.FC<ValorTotalInputProps> = ({
    value,
    onChange,
    id = 'valor-total-input',
    label = 'Custo da Operação (opcional)',
    hint = 'Preencha se desejar registrar este gasto no módulo financeiro.',
    disabled = false,
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        if (raw === '' || raw === undefined) {
            onChange(undefined);
            return;
        }
        const parsed = parseFloat(raw);
        onChange(isNaN(parsed) ? undefined : parsed);
    };

    return (
        <div>
            <label htmlFor={id} className="block text-sm font-semibold text-slate-900 mb-1.5">
                {label}
            </label>
            <div className="relative flex items-center">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <DollarSign size={16} className="text-emerald-600" />
                    <span className="ml-1 text-sm font-bold text-emerald-700 select-none">R$</span>
                </div>
                <input
                    id={id}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={value ?? ''}
                    onChange={handleChange}
                    disabled={disabled}
                    className="block w-full h-12 rounded-xl shadow-sm sm:text-base pl-14 pr-4 py-2 border border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
            </div>
            {hint && (
                <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
            )}
        </div>
    );
};

export default ValorTotalInput;
