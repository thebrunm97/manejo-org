// src/components/PmoForm/CheckboxGroup_MUI.tsx
// MUI ERRADICADO — Tailwind + HTML nativo

import React, { ChangeEvent } from 'react';

interface CheckboxGroupMUIProps {
    title: string;
    options: string[];
    selectedString: string | null | undefined;
    onSelectionChange: (value: string) => void;
    otherOption?: string;
    otherValue?: string;
    onOtherChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    otherName?: string;
    otherPlaceholder?: string;
}

const CheckboxGroupMUI: React.FC<CheckboxGroupMUIProps> = ({
    title,
    options,
    selectedString,
    onSelectionChange,
    otherOption,
    otherValue,
    onOtherChange,
    otherName,
    otherPlaceholder = "Por favor, especifique..."
}) => {
    const guaranteedString = String(selectedString ?? '');
    const selectedOptions = guaranteedString.split('; ').filter(Boolean);

    const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        let newSelected = [...selectedOptions];

        if (checked && !newSelected.includes(value)) {
            newSelected.push(value);
        } else {
            newSelected = newSelected.filter(option => option !== value);
        }

        onSelectionChange(newSelected.join('; '));
    };

    const isOtherSelected = otherOption && selectedOptions.includes(otherOption);

    return (
        <fieldset className="w-full mt-3">
            {title && (
                <legend className="text-base font-semibold text-gray-800 mb-2">
                    {title}
                </legend>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {options.map((option) => (
                    <label
                        key={option}
                        className="flex items-start gap-2.5 py-1.5 cursor-pointer group"
                    >
                        <input
                            type="checkbox"
                            value={option}
                            checked={selectedOptions.includes(option)}
                            onChange={handleCheckboxChange}
                            className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500 focus:ring-offset-0 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 leading-snug group-hover:text-gray-900 select-none">
                            {option}
                        </span>
                    </label>
                ))}
            </div>

            {isOtherSelected && (
                <div className="mt-3 pl-6">
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                        {otherPlaceholder}
                    </label>
                    <textarea
                        name={otherName}
                        value={otherValue || ''}
                        onChange={onOtherChange as any}
                        rows={2}
                        className="w-full rounded-md border border-gray-300 shadow-sm px-3 py-2 text-sm
                                   focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none
                                   placeholder-gray-400 resize-y"
                        placeholder={otherPlaceholder}
                    />
                </div>
            )}
        </fieldset>
    );
};

export default CheckboxGroupMUI;
