/**
 * @file pmoTypes.ts
 * @description Tipos puros para o domínio PMO (Plano de Manejo Orgânico).
 * 
 * ⚠️ REGRA ARQUITETURAL: Este arquivo NÃO deve ter dependências de:
 *    - React (useState, useEffect, etc.)
 *    - Supabase
 *    - Material UI
 * 
 * Isso garante que os tipos sejam reutilizáveis em React Native.
 */

// ==================================================================
// ||                    FORM DATA TYPES                           ||
// ==================================================================

export interface PMOFormData {
    id?: string;
    secao_1_descricao_propriedade: {
        dados_cadastrais: {
            nome_produtor: string;
            cpf: string;
            identidade: string;
            dap: string;
            nome_representante_legal: string;
            endereco_propriedade_base_fisica_produtiva: string;
            endereco_correspondencia: string;
            telefone: string;
            email: string;
            responsavel_preenchimento: string;
            data_preenchimento: string;
        };
        roteiro_acesso_propriedade: { roteiro_acesso: string };
        mapa_propriedade_croqui: { mapa_croqui: string };
        coordenadas_geograficas: { latitude: string; longitude: string };
        area_propriedade: {
            area_producao_organica_hectares: number;
            area_producao_nao_organica_hectares: number;
            area_producao_em_conversao_hectares: number;
            areas_protegidas_hectares: number;
            area_ocupada_instalacoes_benfeitorias_hectares: number;
            area_total_propriedade_hectares: number;
        };
        historico_propriedade_producao_organica: { historico_propriedade_producao_organica: string };
        situacao_propriedade_relacao_producao_organica: { situacao_propriedade_producao_organica: string };
        separacao_areas_producao_paralela: {
            descricao_separacao_areas_producao_paralela: string;
            descricao_separacao_areas_producao_paralela_outros: string;
        };
    };

    secao_2_atividades_produtivas_organicas: {
        s2_1_producao_primaria_vegetal: Array<{
            produto: string;
            talhoes_canteiros: string;
            area_plantada_valor: string | number;
            area_plantada_unidade: string;
            producao_esperada_ano_valor: string | number;
            producao_esperada_ano_unidade: string;
        }>;
        producao_primaria_animal: {
            animais_primaria_animal: any[];
        };
        processamento_produtos_origem_vegetal: {
            produtos_processamento_vegetal: any[];
        };
        processamento_produtos_origem_animal: {
            produtos_processamento_animal: any[];
        };
    };

    secao_3_atividades_produtivas_nao_organicas: {
        produtos_nao_certificados: string;
        producao_primaria_vegetal_nao_organica: { produtos_primaria_vegetal_nao_organica: any[] };
        producao_primaria_animal_nao_organica: { animais_primaria_animal_nao_organica: any[] };
        processamento_produtos_origem_vegetal_nao_organico: { produtos_processamento_vegetal_nao_organico: any[] };
        processamento_produtos_origem_animal_nao_organico: { produtos_processamento_animal_nao_organico: any[] };
    };

    secao_4_animais_servico_subsistencia_companhia: {
        ha_animais_servico_subsistencia_companhia: { ha_animais_servico_subsistencia_companhia: boolean };
        animais_servico: { descricao_animais_servico: string };
        animais_subsistencia_companhia_ornamentais: { descricao_animais_subsistencia_companhia_ornamentais: string };
    };

    secao_5_producao_terceirizada: {
        aquisicao_produtos_terceiros: { produtos_terceirizados: any[] };
    };

    secao_6_aspectos_ambientais: {
        promocao_biodiversidade: string;
        fonte_agua: string;
        fonte_agua_subterranea_especificacao: string;
        controle_uso_agua: string;
        ha_risco_contaminacao_agua: boolean | null;
        qual_risco_contaminacao_agua: string;
        riscos_contaminacao_unidade_producao: string;
        medidas_minimizar_riscos_contaminacao: string;
        praticas_manejo_residuos_organicos: string;
        compostagem: string;
        tratamento_lixo: string;
    };

    secao_7_aspectos_sociais: {
        membros_familia_producao: Array<{ nome: string; parentesco: string; funcao: string }>;
        ha_mao_de_obra_nao_familiar: boolean | null;
        quantidade_mao_de_obra: string;
        relacao_trabalhista: string;
        incentivo_atividades_educativas: string;
        incentivo_atividades_outros: string;
        relacionamento_outros_produtores: string;
    };

    secao_8_insumos_equipamentos: {
        insumos_melhorar_fertilidade: any[];
        insumos_producao_nao_organica: { insumos_producao_nao_organica: string };
        controle_insumos_producao_paralela: { controle_insumos_producao_paralela: string };
    };

    secao_9_propagacao_vegetal: {
        origem_sementes_mudas_organicas: { sementes_mudas_organicas: any[] };
        tratamento_sementes_mudas: { tratamento_sementes_mudas: string };
        manejo_producao_propria: { manejo_producao_propria: string };
        origem_sementes_mudas_nao_organicas: { sementes_mudas_nao_organicas: any[] };
        postura_uso_materiais_transgenicos_organica: { postura_uso_materiais_transgenicos_organica: string };
        cuidados_uso_materiais_transgenicos_nao_organica: { cuidados_uso_materiais_transgenicos_nao_organica: string };
    };

    secao_10_fitossanidade: {
        controle_pragas_doencas: any[];
        manejo_plantas_daninhas: string;
        manejo_plantas_daninhas_outros: string;
    };

    secao_11_colheita: {
        controle_colheita_organicos: { controle_colheita_organicos: string };
        controle_colheita_nao_organicos: { controle_colheita_nao_organicos: string };
    };

    secao_12_pos_colheita: {
        higienizacao_produtos_organicos: { higienizacao_produtos_organicos: string };
        ha_processamento_producao_organica: boolean | null;
        descricao_processamento_producao_organica: { descricao_processamento_producao_organica: string };
        ha_processamento_producao_paralela: boolean | null;
        descricao_processamento_producao_paralela: { descricao_processamento_producao_paralela: string };
        higienizacao_equipamentos_instalacoes: { higienizacao_equipamentos_instalacoes: string };
        acondicionamento_produtos: {
            embalados_envasados_produtos: string;
            embalados_envasados_descricao: string;
            granel_produtos: string;
            granel_descricao: string;
        };
        produtos_sao_rotulados: boolean | null;
        descricao_rotulagem: { descricao_rotulagem: string };
        procedimentos_armazenamento: string;
        procedimentos_armazenamento_outros: string;
        controle_pragas_instalacoes: { controle_pragas_instalacoes: string };
        transporte_produtos_organicos: { transporte_produtos_organicos: string };
    };

    secao_13_producao_animal: {
        tecnicas_melhoria_pastos: string;
        tecnicas_melhoria_pastos_outros: string;
        reproducao_animais: string;
        reproducao_animais_monta_natural_detalhes: string;
        reproducao_animais_metodos_artificiais_detalhes: string;
        reproducao_animais_outros: string;
        aquisicao_animais: {
            sistema_producao_aquisicao: string;
            especificacao_aquisicao_animais: { especificacao_aquisicao_animais: string }
        };
        evolucao_plantel: any[];
        nutricao_animal: any[];
        plano_anual_alimentacao_animal: Array<{
            alimento: string; Jan: boolean; Fev: boolean; Mar: boolean; Abr: boolean;
            Mai: boolean; Jun: boolean; Jul: boolean; Ago: boolean; Set: boolean;
            Out: boolean; Nov: boolean; Dez: boolean;
        }>;
        alimentacao_mamiferos_jovens: { alimentacao_mamiferos_jovens: string };
        bem_estar_animais: string;
        bem_estar_animais_manejo_cama: string;
        bem_estar_animais_outras_formas: string;
        manejo_sanitario_animal: {
            promocao_saude_animal: { promocao_saude_animal: string };
            controle_vermes_parasitas: { controle_vermes_parasitas: string };
            tratamento_animais_doentes: any[];
            castracao_animais: { castracao_animais: string };
            corte_chifres_mochamento_marcacoes: { corte_chifres_mochamento_marcacoes: string };
            vacinacao_animais: { vacinacao_animais: string };
        };
    };

    secao_14_comercializacao: {
        canais_comercializacao: string;
        canais_atacadistas_quais: string;
        canais_feiras_quais: string;
        canais_cooperativas_quais: string;
        canais_outros_quais: string;
    };

    secao_15_rastreabilidade: {
        registros_rastreabilidade: { registros_rastreabilidade: string };
        frequencia_registros_anotacoes: string;
        frequencia_registros_anotacoes_outros: string;
    };

    secao_16_sac: {
        formas_reclamacoes_criticas: { formas_reclamacoes_criticas: string };
        tratamento_reclamacoes_criticas: { tratamento_reclamacoes_criticas: string };
    };

    secao_17_opiniao: {
        principais_problemas_producao_organica: { principais_problemas_producao_organica: string };
        principais_vantagens_producao_organica: { principais_vantagens_producao_organica: string };
        outras_informacoes_necessarias: { outras_informacoes_necessarias: string };
    };

    secao_18_anexos: {
        lista_anexos: any[];
    };

    secao_avaliacao_plano_manejo: {
        espaco_oac: { data_recebimento_plano_manejo: string };
        riscos_potenciais: { riscos_potenciais_unidade_produtiva: string };
        conclusao_analise: { conclusao_analise: string };
        status_documento: {
            status_documento: string;
            responsavel_analise_conclusao: string;
            assinatura_responsavel: string;
            data_analise: string;
        };
    };
}

export type PmoFormData = PMOFormData;

/**
 * Status possíveis de um PMO no sistema.
 */
export type PmoStatus = 'RASCUNHO' | 'CONCLUÍDO' | 'APROVADO' | 'REPROVADO';

/**
 * Payload completo de um PMO para persistência.
 */
export interface PmoPayload {
    id: string;
    nome_identificador: string;
    form_data: PMOFormData;
    status: PmoStatus;
}

/**
 * Dados do PMO retornados do banco (inclui campos de auditoria).
 */
export interface PmoRecord extends PmoPayload {
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    version?: string;
}

// ==================================================================
// ||                 LIGHTWEIGHT LIST TYPES                       ||
// ==================================================================

/**
 * PMO resumido para listagem (SEM form_data).
 * Otimizado para performance em listas grandes.
 */
export interface PmoListItem {
    id: string;
    nome_identificador: string;
    status: PmoStatus;
    version?: string;
    created_at: string;
    updated_at?: string;
}

/**
 * Perfil do usuário com PMO ativo.
 */
export interface UserProfile {
    id: string;
    nome?: string;
    pmo_ativo_id: string | null;
    telefone?: string;
    role?: 'user' | 'admin'; // Role based access control
    plan_tier?: string; // Plan tier (e.g., 'free', 'pro')
}

// ==================================================================
// ||                   RELATED TABLES TYPES                       ||
// ==================================================================

/**
 * Cultura anual extraída da Seção 2 para tabela `culturas_anuais`.
 */
export interface CulturaAnual {
    pmo_id: string;
    produto: string;
    area_plantada: number;
    unidade_area: string;
    producao_estimada: number;
    unidade_producao: string;
    data_plantio: string | null;
    previsao_colheita: string | null;
}

/**
 * Insumo de manejo extraído da Seção 8 para tabela `pmo_manejo`.
 */
export interface ManejoInsumo {
    id?: string;
    pmo_id: string;
    insumo: string;
    fonte: string;
    quantidade: string;
    dose_valor?: number; // Nova coluna para valor numérico
    dose_unidade?: string; // Nova coluna para unidade
    metodo_aplicacao: string;
    talhoes_aplicados: { local: string } | null;
    data_aplicacao: string | null;
}

// ==================================================================
// ||                    OPERATION RESULTS                         ||
// ==================================================================

/**
 * Resultado de operações de salvamento.
 */
export interface SaveResult {
    success: boolean;
    pmoId?: string;
    error?: string;
    isOffline?: boolean;
}

/**
 * Resultado de operações de fetch.
 */
export interface FetchResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}

// ==================================================================
// ||                 SECTION STATUS TYPES                         ||
// ==================================================================

/**
 * Status de preenchimento de uma seção do formulário.
 * Valores em português para compatibilidade com componentes existentes.
 */
export type SectionStatusValue = 'completo' | 'em-progresso' | 'pendente' | undefined;

/**
 * Mapa de status por chave de seção (string).
 * Compatível com DesktopStepper e SectionsModal.
 */
export type SectionStatusMap = Record<string, SectionStatusValue>;

// ==================================================================
// ||                   TABLE ROW TYPES                            ||
// ==================================================================

/**
 * Configuração para processar tabelas dentro do form_data.
 * Usado pelo cleanFormDataForSubmission.
 */
export interface TableConfig {
    /** Caminho para a tabela no form_data (ex: ['producao_primaria_vegetal', 'produtos_primaria_vegetal']) */
    path: string[];
    /** Conversões numéricas a aplicar em cada campo */
    conversions: FieldConversion[];
}

/**
 * Conversão de campo para número.
 */
export interface FieldConversion {
    field: string;
    parser: (value: unknown) => number | null;
}

// ==================================================================
// ||                   FORM ERRORS                                ||
// ==================================================================

/**
 * Estrutura de erros do formulário.
 */
export interface FormErrors {
    /** Erro global (ex: "Nome identificador obrigatório") */
    global?: string;
    /** Erros por seção */
    [sectionKey: string]: unknown;
}

// ==================================================================
// ||                   SECTION 2 TYPES                            ||
// ==================================================================

export interface TableRowBase {
    id: string | number;
    [key: string]: any;
}

export interface VegetalItem extends TableRowBase {
    produto?: string;
    talhoes_canteiros?: string | any; // Aceita string ou objeto complexo
    area_plantada?: number;
    area_plantada_unidade?: string;
    producao_esperada_ano?: number;
    producao_unidade?: string;
    data_plantio_temp?: string; // Campo opcional para importação
}
