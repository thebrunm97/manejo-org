// src/utils/deepMerge.js

// Função auxiliar para fusão profunda de objetos
export function deepMerge(target, source) {
  const output = { ...target };

  if (target && typeof target === 'object' && source && typeof source === 'object') {
    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        output[key] = deepMerge(target[key], source[key]);
      } else {
        // Se a chave existe no target e o valor é 'null' ou 'undefined' no source,
        // ou se o valor é um array, use o valor do source se for definido
        // caso contrário, mantenha o do target.
        // Se a chave não existe no target, adiciona do source.
        output[key] = source[key] !== undefined ? source[key] : target[key];
      }
    });
  }
  return output;
}