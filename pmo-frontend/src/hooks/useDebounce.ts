import { useState, useEffect } from 'react';

/**
 * Hook customizado que adia a atualização de um valor.
 * @param {T} value O valor a ser "debounced".
 * @param {number} delay O tempo de espera em milissegundos.
 * @returns {T} O valor "debounced".
 */
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

export default useDebounce;
