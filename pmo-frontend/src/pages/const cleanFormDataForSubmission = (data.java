const cleanFormDataForSubmission = (data) => {
  const cleanedData = deepMerge({}, data);

 // --- Funções Auxiliares ---
  const parseToFloatOrNull = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseFloat(String(value).replace(',', '.'));
    return isNaN(num) ? null : num;
  };

  const parseToIntOrNull = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  };
 // NOVA FUNÇÃO AUXILIAR: Verifica se todos os campos de um objeto estão vazios/nulos
  const isRowEmpty = (row) => {
    // Se o objeto não existir ou não for um objeto, considera-o vazio.
    if (!row || typeof row !== 'object') return true;
    // Retorna 'true' se TODOS os valores do objeto forem nulos, indefinidos ou strings vazias.
    return Object.values(row).every(value => value === null || value === undefined || value === '');
  };

  // --- Limpeza de Dados ---
  const secao2Data = cleanedData.secao_2_atividades_produtivas_organicas;
  if (secao2Data) {
    const ppv = secao2Data.producao_primaria_vegetal?.produtos_primaria_vegetal;
    if (ppv) {
      ppv.forEach(item => {
        item.area_plantada = parseToFloatOrNull(item.area_plantada);
        item.producao_esperada_ano = parseToFloatOrNull(item.producao_esperada_ano);
      });
    }

    const ppa = secao2Data.producao_primaria_animal?.animais_primaria_animal;
    if (ppa) {
      ppa.forEach(item => {
        item.n_de_animais = parseToIntOrNull(item.n_de_animais);
        item.area_externa = parseToFloatOrNull(item.area_externa);
        item.area_interna_instalacoes = parseToFloatOrNull(item.area_interna_instalacoes);
        item.media_de_peso_vivo = parseToFloatOrNull(item.media_de_peso_vivo);
      });
    }
  }

  const avaliacao = cleanedData.secao_avaliacao_plano_manejo;
  if (avaliacao) {
    if (avaliacao.espaco_oac && (avaliacao.espaco_oac.data_recebimento_plano_manejo === '' || avaliacao.espaco_oac.data_recebimento_plano_manejo === 'null')) {
      avaliacao.espaco_oac.data_recebimento_plano_manejo = null;
    }
    if (avaliacao.status_documento && (avaliacao.status_documento.data_analise === '' || avaliacao.status_documento.data_analise === 'null')) {
      avaliacao.status_documento.data_analise = null;
    }
  }

  return cleanedData;
};