import React from 'react';
import { ChevronDown } from 'lucide-react';
import { UnitType } from '../../../../types/CadernoTypes';

interface UnitSelectProps {
    value: UnitType | string;
    fieldName: string;
    options: (UnitType | string)[];
    label?: string;
    id?: string;
    onChange: (field: string, value: any) => void;
}

const UnitSelect: React.FC<UnitSelectProps> = ({
    value,
    fieldName,
    options,
    label = "Unid",
    id,
    onChange
}) => {
    const isCustomValue = value && !options.includes(value as UnitType);
    const effectiveOptions = isCustomValue ? [value, ...options] : options;
    const safeValue = value || '';

    return (
        <div className="min-w-[100px]">
            <label htmlFor={id} className="block text-sm font-semibold text-slate-900 mb-1.5">{label}</label>
            <div className="relative">
                <select
                    id={id}
                    value={safeValue}
                    onChange={e => onChange(fieldName, e.target.value)}
                    className="block w-full h-12 rounded-xl border-slate-300 shadow-sm focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/20 sm:text-base px-4 py-2 border bg-white appearance-none pr-10 transition-all font-medium text-slate-700"
                >
                    {effectiveOptions.map(opt => (
                        <option key={opt} value={opt}>
                            {opt === value && isCustomValue ? `${opt} (Legado)` : opt}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <ChevronDown size={18} />
                </div>
            </div>
        </div>
    );
};

export default UnitSelect;
