/**
 * Símbolo de moeda usado na UI. Configurável via VITE_CURRENCY_SYMBOL, com
 * "R$" como padrão — zero mudança de comportamento até a env ser setada.
 *
 * Existe para internacionalização (ex.: expansão para Moçambique, Metical
 * "MT"): antes disto, o símbolo estava hardcoded em ~9 componentes
 * diferentes. Trocar de moeda hoje é só essa env var. Quando o produto
 * precisar de moeda por propriedade/conta (decisão de produto ainda
 * pendente), este é o único ponto que muda para ler de lá em vez do
 * ambiente — os componentes que usam CURRENCY_SYMBOL/formatCurrency
 * continuam iguais.
 */
export const CURRENCY_SYMBOL: string =
    (import.meta.env.VITE_CURRENCY_SYMBOL as string | undefined)?.trim() || 'R$';

/** Formata um valor monetário com o símbolo configurado, ex.: "R$ 1.234,56". */
export function formatCurrency(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || Number.isNaN(value)) return '---';
    return `${CURRENCY_SYMBOL} ${value.toFixed(decimals)}`;
}
