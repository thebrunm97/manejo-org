/**
 * Aplica a máscara (99) 99999-9999 a uma string de telefone.
 * @param value - String de entrada (pode conter caracteres não numéricos)
 * @returns String formatada
 */
export const formatPhoneBR = (value: string): string => {
    if (!value) return '';

    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '');

    // Limita a 11 dígitos
    const limitedDigits = numbers.slice(0, 11);

    // Aplica a máscara progressivamente
    if (limitedDigits.length <= 2) {
        return limitedDigits.length > 0 ? `(${limitedDigits}` : '';
    }
    if (limitedDigits.length <= 7) {
        return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
    }
    return `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 7)}-${limitedDigits.slice(7)}`;
};
