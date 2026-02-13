// src/utils/formData.js

export const initialFormData = {
  secao_1_descricao_propriedade: {
    dados_cadastrais: {
      nome_produtor: '',
      cpf: '',
      identidade: '',
      dap: '',
      nome_representante_legal: '',
      endereco_propriedade_base_fisica_produtiva: '',
      endereco_correspondencia: '',
      telefone: '',
      email: '',
      responsavel_preenchimento: '',
      data_preenchimento: '', // Formato 'YYYY-MM-DD' para data
    },
    roteiro_acesso_propriedade: { roteiro_acesso: '' },
    mapa_propriedade_croqui: { mapa_croqui: '' },
    coordenadas_geograficas: { latitude: '', longitude: '' },
    area_propriedade: {
      area_producao_organica_hectares: 0,
      area_producao_nao_organica_hectares: 0,
      area_producao_em_conversao_hectares: 0,
      areas_protegidas_hectares: 0,
      area_ocupada_instalacoes_benfeitorias_hectares: 0,
      area_total_propriedade_hectares: 0,
    },
    historico_propriedade_producao_organica: { historico_propriedade_producao_organica: '' },
    situacao_propriedade_relacao_producao_organica: { situacao_propriedade_producao_organica: '' },
    
    separacao_areas_producao_paralela: {
      descricao_separacao_areas_producao_paralela: '', // Para armazenar os checkboxes como string concatenada
      descricao_separacao_areas_producao_paralela_outros: '', // Para o campo 'Outros, citar'
    },
  },

  secao_2_atividades_produtivas_organicas: {
      s2_1_producao_primaria_vegetal: [
      // A estrutura do item da lista agora tem campos separados para valor e unidade
      { 
        produto: '', 
        talhoes_canteiros: '', 
        area_plantada_valor: '', 
        area_plantada_unidade: 'Ha', // Unidade padrão
        producao_esperada_ano_valor: '',
        producao_esperada_ano_unidade: 'Kg' // Unidade padrão
      }
    ],
    producao_primaria_animal: {
      animais_primaria_animal: [],
    },
    processamento_produtos_origem_vegetal: {
      produtos_processamento_vegetal: [],
    },
    processamento_produtos_origem_animal: {
      produtos_processamento_animal: [],
    },
  },
  secao_3_atividades_produtivas_nao_organicas: {
    produtos_nao_certificados: '',
    producao_primaria_vegetal_nao_organica: { produtos_primaria_vegetal_nao_organica: [] },
    producao_primaria_animal_nao_organica: { animais_primaria_animal_nao_organica: [] },
    processamento_produtos_origem_vegetal_nao_organico: { produtos_processamento_vegetal_nao_organico: [] },
    processamento_produtos_origem_animal_nao_organico: { produtos_processamento_animal_nao_organico: [] },
  },
  secao_4_animais_servico_subsistencia_companhia: {
    ha_animais_servico_subsistencia_companhia: { ha_animais_servico_subsistencia_companhia: false },
    animais_servico: { descricao_animais_servico: '' },
    animais_subsistencia_companhia_ornamentais: { descricao_animais_subsistencia_companhia_ornamentais: '' },
  },
  secao_5_producao_terceirizada: {
    aquisicao_produtos_terceiros: { produtos_terceirizados: [] },
  },
  // ================== SEÇÃO 6 ASPECTOS AMBIENTAIS ==================
  secao_6_aspectos_ambientais: {
    promocao_biodiversidade: '',
    fonte_agua: '',
    fonte_agua_subterranea_especificacao: '',
    controle_uso_agua: '',
    ha_risco_contaminacao_agua: null,
    qual_risco_contaminacao_agua: '',
    riscos_contaminacao_unidade_producao: '',
    medidas_minimizar_riscos_contaminacao: '',
    praticas_manejo_residuos_organicos: '',
    compostagem: '',
    tratamento_lixo: ''
  },

  // =================== FIM DA CORREÇÃO ====================
   secao_7_aspectos_sociais: {
    membros_familia_producao: [
      { nome: '', parentesco: '', funcao: '' } // Começa com uma linha vazia
    ],
    ha_mao_de_obra_nao_familiar: null, // null para não ter Sim/Não pré-selecionado
    quantidade_mao_de_obra: '',
    relacao_trabalhista: '', // Para os checkboxes de relação trabalhista
    incentivo_atividades_educativas: '', // Para os checkboxes de incentivo
    incentivo_atividades_outros: '', // Para o campo "Outras. Quais?"
    relacionamento_outros_produtores: '' // Para o último grupo de checkboxes
  
  },
  secao_8_insumos_equipamentos: {
    insumos_melhorar_fertilidade: [], // A tabela continua como um array
    insumos_producao_nao_organica: { insumos_producao_nao_organica: '' },
    controle_insumos_producao_paralela: { controle_insumos_producao_paralela: '' }
  
},
  secao_9_propagacao_vegetal: {
    origem_sementes_mudas_organicas: { sementes_mudas_organicas: [] },
    tratamento_sementes_mudas: { tratamento_sementes_mudas: '' },
    manejo_producao_propria: { manejo_producao_propria: '' },
    origem_sementes_mudas_nao_organicas: { sementes_mudas_nao_organicas: [] },
    postura_uso_materiais_transgenicos_organica: { postura_uso_materiais_transgenicos_organica: '' },
    cuidados_uso_materiais_transgenicos_nao_organica: { cuidados_uso_materiais_transgenicos_nao_organica: '' },
  },
  secao_10_fitossanidade: {
    // Para a Tabela 10.1 - INICIALIZADO COMO ARRAY
    controle_pragas_doencas: [],
    // Para o CheckboxGroup 10.2
    manejo_plantas_daninhas: '',
    manejo_plantas_daninhas_outros: ''
  },
  secao_11_colheita: {
    controle_colheita_organicos: { controle_colheita_organicos: '' },
    controle_colheita_nao_organicos: { controle_colheita_nao_organicos: '' },
  },

  // =================== SEÇÃO 12 PÓS-COLHEITA ==================
  secao_12_pos_colheita: {
    higienizacao_produtos_organicos: { higienizacao_produtos_organicos: '' },
    ha_processamento_producao_organica: null,
    descricao_processamento_producao_organica: { descricao_processamento_producao_organica: '' },
    ha_processamento_producao_paralela: null,
    descricao_processamento_producao_paralela: { descricao_processamento_producao_paralela: '' },
    higienizacao_equipamentos_instalacoes: { higienizacao_equipamentos_instalacoes: '' },
    acondicionamento_produtos: {
      embalados_envasados_produtos: '',
      embalados_envasados_descricao: '',
      granel_produtos: '',
      granel_descricao: '',
    },
    produtos_sao_rotulados: null,
    descricao_rotulagem: { descricao_rotulagem: '' },
    procedimentos_armazenamento: '',
    procedimentos_armazenamento_outros: '',
    controle_pragas_instalacoes: { controle_pragas_instalacoes: '' },
    transporte_produtos_organicos: { transporte_produtos_organicos: '' },
  },

  // =================== SEÇÃO 13 ====================
  secao_13_producao_animal: {
    tecnicas_melhoria_pastos: '',
    tecnicas_melhoria_pastos_outros: '',
    reproducao_animais: '',
    reproducao_animais_monta_natural_detalhes: '',
    reproducao_animais_metodos_artificiais_detalhes: '',
    reproducao_animais_outros: '',
    aquisicao_animais: {
      sistema_producao_aquisicao: '',
      especificacao_aquisicao_animais: { especificacao_aquisicao_animais: '' }
    },
    evolucao_plantel: [], // Tabela 13.4
    nutricao_animal: [],   // Tabela 13.5
    plano_anual_alimentacao_animal: [{
      alimento: '', Jan: false, Fev: false, Mar: false, Abr: false, 
      Mai: false, Jun: false, Jul: false, Ago: false, Set: false, 
      Out: false, Nov: false, Dez: false
    }],
    alimentacao_mamiferos_jovens: { alimentacao_mamiferos_jovens: '' },
    bem_estar_animais: '',
    bem_estar_animais_manejo_cama: '',
    bem_estar_animais_outras_formas: '',
    manejo_sanitario_animal: {
      promocao_saude_animal: { promocao_saude_animal: '' },
      controle_vermes_parasitas: { controle_vermes_parasitas: '' },
      tratamento_animais_doentes: [], // Tabela 13.9.3 (não mostrada nas imagens, mas presente no modelo de dados)
      castracao_animais: { castracao_animais: '' },
      corte_chifres_mochamento_marcacoes: { corte_chifres_mochamento_marcacoes: '' },
      vacinacao_animais: { vacinacao_animais: '' }
    }
  },

  secao_14_comercializacao: {
    canais_comercializacao: '', // Para guardar as opções de checkbox marcadas
    canais_atacadistas_quais: '',
    canais_feiras_quais: '',
    canais_cooperativas_quais: '',
    canais_outros_quais: ''
  },

  // =================== SEÇÃO 15 RASTREABILIDADE ==================
  secao_15_rastreabilidade: {
    // Para a pergunta 15.1, usando o padrão aninhado
    registros_rastreabilidade: { registros_rastreabilidade: '' },
    // Para o CheckboxGroup 15.2
    frequencia_registros_anotacoes: '',
    frequencia_registros_anotacoes_outros: ''
  },
  // =================== SEÇÃO 16 SAC ==================
  secao_16_sac: {
    formas_reclamacoes_criticas: { formas_reclamacoes_criticas: '' },
    tratamento_reclamacoes_criticas: { tratamento_reclamacoes_criticas: '' }
  },
  // =================== SEÇÃO 17 OPINIÃO ==================  
  secao_17_opiniao: {
    principais_problemas_producao_organica: { principais_problemas_producao_organica: '' },
    principais_vantagens_producao_organica: { principais_vantagens_producao_organica: '' },
    outras_informacoes_necessarias: { outras_informacoes_necessarias: '' }
  },
  // =================== SEÇÃO 18 ANEXOS ==================  
  secao_18_anexos: {
  // A lista de anexos, como previsto no PRD, começa como um array vazio
    lista_anexos: []
  },
  secao_avaliacao_plano_manejo: {
    espaco_oac: { data_recebimento_plano_manejo: 'null' },
    riscos_potenciais: { riscos_potenciais_unidade_produtiva: '' },
    conclusao_analise: { conclusao_analise: '' },
    status_documento: {
      status_documento: '',
      responsavel_analise_conclusao: '',
      assinatura_responsavel: '',
      data_analise: 'null',
    },
  },
};