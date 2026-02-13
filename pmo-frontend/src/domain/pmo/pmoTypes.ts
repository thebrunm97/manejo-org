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

/**
 * Estrutura genérica do form_data do PMO.
 * Cada seção é identificada por uma chave (ex: 'secao_1_descricao_propriedade').
 */
export interface PmoFormData {
    [sectionKey: string]: unknown;
}

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
    form_data: PmoFormData;
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
    pmo_ativo_id: string | null;
    telefone?: string;
    role?: 'user' | 'admin'; // Role based access control
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
 * Compatível com DesktopStepperMUI e SectionsModal.
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
