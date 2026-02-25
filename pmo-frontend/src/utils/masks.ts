/**
 * Aplica a máscara (99) 99999-9999 a uma string de telefone.
 * Aceita e formata corretamente se houver código de país "55" copiado/digitado.
 * @param value - String de entrada (pode conter caracteres não numéricos)
 * @returns String formatada
 */
export const formatPhoneBR = (value: string): string => {
    if (!value) return '';

    // Remove tudo que não é número
    let numbers = value.replace(/\D/g, '');

    // Se começa com 55 e tem 12 ou mais dígitos, trata o 55 como DDI
    let prefix = '';
    if (numbers.startsWith('55') && numbers.length >= 12) {
        prefix = '+55 ';
        numbers = numbers.substring(2);
    }

    // Limita o resto a 11 dígitos
    const limitedDigits = numbers.slice(0, 11);

    if (limitedDigits.length === 0) return prefix.trim();

    // Aplica a máscara progressivamente
    if (limitedDigits.length <= 2) {
        return prefix + `(${limitedDigits}`;
    }
    if (limitedDigits.length <= 6) {
        return prefix + `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2)}`;
    }
    if (limitedDigits.length <= 10) {
        return prefix + `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 6)}-${limitedDigits.slice(6)}`;
    }
    return prefix + `(${limitedDigits.slice(0, 2)}) ${limitedDigits.slice(2, 7)}-${limitedDigits.slice(7)}`;
};
