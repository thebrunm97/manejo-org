// src/hooks/useDebounce.js

import { useState, useEffect } from 'react';

/**
 * Hook customizado que adia a atualização de um valor.
 * @param {any} value O valor a ser "debounced".
 * @param {number} delay O tempo de espera em milissegundos.
 * @returns {any} O valor "debounced".
 */
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

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