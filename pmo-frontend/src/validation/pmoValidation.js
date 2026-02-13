// src/validation/pmoValidation.js (versão com validação completa para a Seção 1)

// Função para verificar se um objeto está realmente vazio ou apenas com valores vazios
function isDataEmpty(data) {
  if (!data) return true;
  return Object.values(data).every(value => {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && value !== null) return isObjectEmpty(value);
    return value === '' || value === null;
  });
}

function isObjectEmpty(obj) {
  if (!obj) return true;
  return Object.keys(obj).length === 0;
}

// Limpa as chaves de erro que não têm mensagens
function cleanErrors(errors) {
    Object.keys(errors).forEach(key => {
        if (isObjectEmpty(errors[key])) {
            delete errors[key];
        }
    });
    return errors;
}

// --- VALIDAÇÃO REAL E COMPLETA PARA A SEÇÃO 1 ---
export function validateSecao1(data) {
  const errors = {
    dados_cadastrais: {},
    roteiro_acesso_propriedade: {},
    mapa_propriedade_croqui: {},
    coordenadas_geograficas: {},
    area_propriedade: {},
    historico_propriedade_producao_organica: {},
    situacao_propriedade_relacao_producao_organica: {}
  };
  
  // Regras para Dados Cadastrais
  if (!data?.dados_cadastrais?.nome_produtor) errors.dados_cadastrais.nome_produtor = 'Campo obrigatório.';
  if (!data?.dados_cadastrais?.cpf) errors.dados_cadastrais.cpf = 'Campo obrigatório.';
  // ... adicione outras regras para dados cadastrais se necessário

  // Regra para Roteiro de Acesso
  if (!data?.roteiro_acesso_propriedade?.roteiro_acesso) errors.roteiro_acesso_propriedade.roteiro_acesso = 'Campo obrigatório.';

  // Regra para Mapa/Croqui
  if (!data?.mapa_propriedade_croqui?.mapa_croqui) errors.mapa_propriedade_croqui.mapa_croqui = 'Campo obrigatório.';
  
  // Regras para Coordenadas
  if (!data?.coordenadas_geograficas?.latitude) errors.coordenadas_geograficas.latitude = 'Latitude é obrigatória.';
  if (!data?.coordenadas_geograficas?.longitude) errors.coordenadas_geograficas.longitude = 'Longitude é obrigatória.';
  
  // Regras para Área da Propriedade
  if (!data?.area_propriedade?.area_total_propriedade_hectares) errors.area_propriedade.area_total_propriedade_hectares = 'A área total é obrigatória.';

  // Regras para Histórico e Situação
  if (!data?.historico_propriedade_producao_organica?.historico_propriedade_producao_organica) errors.historico_propriedade_producao_organica.historico_propriedade_producao_organica = 'Campo obrigatório.';
  if (!data?.situacao_propriedade_relacao_producao_organica?.situacao_propriedade_producao_organica) errors.situacao_propriedade_relacao_producao_organica.situacao_propriedade_producao_organica = 'Selecione uma situação.';


  return cleanErrors(errors);
}


// --- VALIDAÇÃO PADRÃO (PLACEHOLDER) ---
function validateGenericSection(data) {
    if (isDataEmpty(data)) {
        return { _generic: 'Seção não preenchida.' };
    }
    return {};
}

// Exportamos as funções, usando a genérica para as seções ainda não implementadas
export function validateSecao2(data) { return validateGenericSection(data); }
export function validateSecao3(data) { return validateGenericSection(data); }
export function validateSecao4(data) { return validateGenericSection(data); }
export function validateSecao5(data) { return validateGenericSection(data); }
export function validateSecao6(data) { return validateGenericSection(data); }
export function validateSecao7(data) { return validateGenericSection(data); }
export function validateSecao8(data) { return validateGenericSection(data); }
export function validateSecao9(data) { return validateGenericSection(data); }
export function validateSecao10(data) { return validateGenericSection(data); }
export function validateSecao11(data) { return validateGenericSection(data); }
export function validateSecao12(data) { return validateGenericSection(data); }
export function validateSecao13(data) { return validateGenericSection(data); }
export function validateSecao14(data) { return validateGenericSection(data); }
export function validateSecao15(data) { return validateGenericSection(data); }
export function validateSecao16(data) { return validateGenericSection(data); }
export function validateSecao17(data) { return validateGenericSection(data); }
export function validateSecao18(data) { return validateGenericSection(data); }