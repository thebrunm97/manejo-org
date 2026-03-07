/**
 * Função auxiliar para fusão profunda de objetos
 */
export function deepMerge<T extends object, S extends object>(target: T, source: S): T & S {
    const output = { ...target } as any;

    if (target && typeof target === 'object' && source && typeof source === 'object') {
        Object.keys(source).forEach(key => {
            const sValue = (source as any)[key];
            const tValue = (target as any)[key];

            if (
                sValue && typeof sValue === 'object' && !Array.isArray(sValue) &&
                tValue && typeof tValue === 'object' && !Array.isArray(tValue)
            ) {
                output[key] = deepMerge(tValue, sValue);
            } else {
                // Se a chave existe no target e o valor é 'null' ou 'undefined' no source,
                // ou se o valor é um array, use o valor do source se for definido
                // caso contrário, mantenha o do target.
                // Se a chave não existe no target, adiciona do source.
                output[key] = sValue !== undefined ? sValue : tValue;
            }
        });
    }
    return output as T & S;
}
