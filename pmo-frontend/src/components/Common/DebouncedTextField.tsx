// src/components/Common/DebouncedTextField.tsx

import React, { useState, useEffect, ChangeEvent } from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import useDebounce from '../../hooks/useDebounce';

interface DebouncedTextFieldProps extends Omit<TextFieldProps, 'onChange' | 'value'> {
    value: string;
    onChange: (value: string) => void;
    delay?: number;
}

/**
 * TextField com debounce para evitar atualizações excessivas de estado global.
 */
const DebouncedTextField: React.FC<DebouncedTextFieldProps> = ({
    value,
    onChange,
    delay = 500,
    ...props
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

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    return (
        <TextField
            {...props}
            value={localValue}
            onChange={handleChange}
        />
    );
};

export default DebouncedTextField;
