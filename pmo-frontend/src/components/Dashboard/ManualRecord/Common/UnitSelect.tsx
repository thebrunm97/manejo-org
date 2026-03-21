import React from 'react';
import { ChevronDown } from 'lucide-react';
import { UnitType } from '../../../types/CadernoTypes';

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
            <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
            <div className="relative">
                <select
                    id={id}
                    value={safeValue}
                    onChange={e => onChange(fieldName, e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-3 py-2 border bg-white appearance-none pr-8"
                >
                    {effectiveOptions.map(opt => (
                        <option key={opt} value={opt}>
                            {opt === value && isCustomValue ? `${opt} (Legado)` : opt}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                    <ChevronDown size={14} />
                </div>
            </div>
        </div>
    );
};

export default UnitSelect;
