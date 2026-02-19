// src/components/Common/DebouncedTextField.tsx

import React, { useState, useEffect, ChangeEvent } from 'react';
import useDebounce from '../../hooks/useDebounce';

interface DebouncedTextFieldProps {
    value: string;
    onChange: (value: string) => void;
    delay?: number;
    label?: string;
    name?: string;
    type?: string;
    required?: boolean;
    error?: boolean;
    helperText?: string;
    placeholder?: string;
    multiline?: boolean;
    rows?: number;
    className?: string;
    disabled?: boolean;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    // Legacy MUI props — accepted but ignored for compatibility during migration
    variant?: string;
    fullWidth?: boolean;
    InputLabelProps?: any;
    size?: string;
}

/**
 * TextField com debounce para evitar atualizações excessivas de estado global.
 * Versão nativa Tailwind (sem MUI).
 */
const DebouncedTextField: React.FC<DebouncedTextFieldProps> = ({
    value,
    onChange,
    delay = 500,
    label,
    name,
    type = 'text',
    required,
    error,
    helperText,
    placeholder,
    multiline,
    rows,
    className,
    disabled,
    inputProps,
    // Destructure legacy props so they don't get spread
    variant: _variant,
    fullWidth: _fullWidth,
    InputLabelProps: _inputLabelProps,
    size: _size,
    ...rest
}) => {
    // Estado local para feedback instantâneo enquanto digita
    const [localValue, setLocalValue] = useState(value || '');

    // Valor "atrasado" que sincroniza com o hook
    const debouncedValue = useDebounce(localValue, delay);

    // 1. Sincroniza estado local quando o pai muda (reset externo ou carregamento inicial)
    useEffect(() => {
        setLocalValue(value || '');
    }, [value]);

    // 2. Dispara o onChange do pai apenas quando o valor debounced muda
    useEffect(() => {
        // Evita disparar se o valor debounced ainda for igual ao value original
        if (debouncedValue !== value) {
            onChange(debouncedValue);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedValue]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setLocalValue(e.target.value);
    };

    const baseClasses = `w-full px-3 py-2 rounded-md border bg-white text-sm text-gray-900 
        placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-main/30 focus:border-primary-main 
        disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors
        ${error ? 'border-red-500 focus:ring-red-500/30 focus:border-red-500' : 'border-gray-300'}`;

    return (
        <div className={`flex flex-col gap-1 w-full ${className || ''}`}>
            {label && (
                <label
                    htmlFor={name}
                    className={`text-sm font-medium ${error ? 'text-red-600' : 'text-gray-700'}`}
                >
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
            )}
            {multiline ? (
                <textarea
                    id={name}
                    name={name}
                    value={localValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    rows={rows || 3}
                    disabled={disabled}
                    required={required}
                    className={baseClasses}
                />
            ) : (
                <input
                    id={name}
                    name={name}
                    type={type}
                    value={localValue}
                    onChange={handleChange}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={baseClasses}
                    {...inputProps}
                />
            )}
            {helperText && (
                <p className={`text-xs min-h-[1rem] ${error ? 'text-red-500' : 'text-gray-500'}`}>
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default DebouncedTextField;
