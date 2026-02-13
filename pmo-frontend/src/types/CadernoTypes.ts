import { z } from 'zod';

// ==================================================================
// ||                          ENUMS                               ||
// ==================================================================

export enum ActivityType {
    PLANTIO = 'Plantio',
    MANEJO = 'Manejo',
    COLHEITA = 'Colheita',
    INSUMO = 'Insumo',
    OUTRO = 'Outro',
    CANCELADO = 'CANCELADO'
}

export enum UnitType {
    // Massa / Volume
    KG = 'kg',
    G = 'g',
    TON = 'ton',
    L = 'L',
    ML = 'ml',

    // Contagem
    UNID = 'unid',
    MACO = 'maço',
    CX = 'cx',

    // Agrícola / Taxa
    M2 = 'm2',
    L_HA = 'L/ha',
    KG_HA = 'kg/ha',
    G_PLANTA = 'g/planta',
    ML_PLANTA = 'ml/planta',
    ML_L = 'ml/L'
}

// ==================================================================
// ||                       ZOD SCHEMAS                            ||
// ==================================================================

// --- Detalhes Plantio ---
export const DetalhesPlantioSchema = z.object({
    metodo_propagacao: z.enum(['Semente', 'Muda', 'Estaca', 'Bulbo', 'Outro']).optional(),
    qtd_utilizada: z.number().optional(),
    unidade_medida: z.nativeEnum(UnitType).or(z.string()).optional(), // Permite string legado por segurança
    espacamento: z.string().optional(),
    profundidade: z.string().optional(),
    lote_semente: z.string().optional()
});

// --- SUBSYPES MANEJO ---
export enum ManejoSubtype {
    MANEJO_CULTURAL = 'MANEJO_CULTURAL',
    APLICACAO_INSUMO = 'APLICACAO_INSUMO',
    HIGIENIZACAO = 'HIGIENIZACAO'
}

// --- Detalhes Manejo ---
export const DetalhesManejoSchema = z.object({
    // Campo discriminador do subtipo (opcional pois registros antigos não têm)
    subtipo: z.nativeEnum(ManejoSubtype).or(z.string()).optional(),

    // Campos comuns / Legados
    tipo_manejo: z.string().optional(), // 'Adubação', 'Fitossanitário', etc. (Legado ou complementar)
    responsavel: z.string().optional(),
    periodo_carencia: z.string().optional(),

    // Campos APLICACAO_INSUMO
    insumo: z.string().optional(),
    nome_insumo: z.string().optional(), // Alias legado
    dosagem: z.union([z.number(), z.string()]).optional(),
    unidade_dosagem: z.nativeEnum(UnitType).or(z.string()).optional(),
    equipamento: z.string().optional(),
    metodo_aplicacao: z.string().optional(), // ex: 'Pulverização', 'Fertirrigação', 'Aplicação manual'

    // Campos HIGIENIZACAO
    item_higienizado: z.string().optional(),
    produto_utilizado: z.string().optional(),

    // Campos MANEJO_CULTURAL
    atividade: z.string().optional(), // ex: Capina, Poda
    qtd_trabalhadores: z.number().optional()
});

// --- Detalhes Colheita ---
export const DetalhesColheitaSchema = z.object({
    lote: z.string().optional(),
    destino: z.string().optional(),
    classificacao: z.string().optional(),
    qtd: z.number().optional(),
    unidade: z.nativeEnum(UnitType).or(z.string()).optional()
});

// --- Detalhes Genéricos (Para 'Outro' ou legado) ---
export const DetalhesGenericoSchema = z.record(z.string(), z.any());

// ==================================================================
// ||                     TYPESCRIPT TYPES                         ||
// ==================================================================

export type DetalhesPlantio = z.infer<typeof DetalhesPlantioSchema>;
export type DetalhesManejo = z.infer<typeof DetalhesManejoSchema>;
export type DetalhesColheita = z.infer<typeof DetalhesColheitaSchema>;
export type DetalhesGenerico = z.infer<typeof DetalhesGenericoSchema>;

// Discriminated Unions para Runtime Check seguro
export type DetalhesTecnicos =
    | DetalhesPlantio
    | DetalhesManejo
    | DetalhesColheita
    | DetalhesGenerico;

export interface BaseRegistro {
    id: string;
    pmo_id: number;
    created_at?: string;
    data_registro: string;
    talhao_canteiro?: string;
    produto?: string;
    observacao_original?: string;

    // Quantitativos Macro (Denormalized for legacy compatibility)
    quantidade_valor?: number;
    quantidade_unidade?: string;

    // Multi-culture support (new fields)
    atividades?: AtividadeItemLite[];
    sistema?: 'monocultura' | 'consorcio' | 'saf';
    status?: 'pendente' | 'realizado' | 'cancelado';

    // Audio audit trail (WhatsApp voice messages)
    audio_url?: string | null;

    // Discards / Waste (Dedicated Columns)
    houve_descartes?: boolean;
    qtd_descartes?: number;
    unidade_descartes?: string;
    caderno_campo_canteiros?: { canteiros: { id: number; nome: string } }[];
}

// Lite version of AtividadeItem for embedding in CadernoEntry
// Full version is in AtividadeTypes.ts
export interface AtividadeItemLite {
    produto: string;
    quantidade: number;
    unidade: string;
    local: {
        talhao: string;
        canteiro?: string;
        linha?: string;
        talhao_id?: number;
    };
    papel?: 'principal' | 'secundario' | 'cobertura';
    estrato?: 'emergente' | 'alto' | 'medio' | 'baixo';
    lote?: string;
    origem?: string;
    variedade?: string;
}


// --- UNION TYPE PRINCIPAL ---
export interface RegistroPlantio extends BaseRegistro {
    tipo_atividade: ActivityType.PLANTIO | 'Plantio';
    detalhes_tecnicos: DetalhesPlantio;
}

export interface RegistroManejo extends BaseRegistro {
    tipo_atividade: ActivityType.MANEJO | 'Manejo';
    detalhes_tecnicos: DetalhesManejo;
}

export interface RegistroColheita extends BaseRegistro {
    tipo_atividade: ActivityType.COLHEITA | 'Colheita';
    detalhes_tecnicos: DetalhesColheita;
}

export interface RegistroOutro extends BaseRegistro {
    tipo_atividade: ActivityType.OUTRO | ActivityType.INSUMO | ActivityType.CANCELADO | string;
    detalhes_tecnicos: DetalhesGenerico;
}

export type CadernoEntry = RegistroPlantio | RegistroManejo | RegistroColheita | RegistroOutro;

// Alias para compatibilidade com código existente
export type CadernoRegistro = CadernoEntry;
export type CadernoCampoRecord = CadernoEntry;
