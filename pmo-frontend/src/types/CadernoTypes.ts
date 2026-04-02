import { z } from 'zod';

// ==================================================================
// ||                          ENUMS                               ||
// ==================================================================

export enum ActivityType {
    PLANTIO = 'Plantio',
    MANEJO = 'Manejo',
    COLHEITA = 'Colheita',
    VENDA = 'Venda',
    INSUMO = 'Insumo',
    COMPOSTAGEM = 'Compostagem',
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
    ML_L = 'ml/L',
    L_M2 = 'l/m²',
    KG_M2 = 'kg/m²'
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
    insumo_aplicado: z.string().optional(), // Padronização Sprint 1
    insumo: z.string().optional(), // Alias legado
    nome_insumo: z.string().optional(), // Alias legado
    dosagem: z.union([z.number(), z.string()]).optional(),
    unidade_dosagem: z.nativeEnum(UnitType).or(z.string()).optional(),
    equipamento: z.string().optional(),
    metodo_aplicacao: z.string().optional(), // ex: 'Pulverização', 'Fertirrigação', 'Aplicação manual'
    nota_fiscal_insumo: z.string().optional(), // Compliance SEBRAE
    cultura_alvo: z.string().optional(), // Compliance SEBRAE

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
    destino_inicial: z.string().optional(),
    classificacao: z.string().optional(),
    qtd: z.number().optional(),
    unidade: z.nativeEnum(UnitType).or(z.string()).optional()
});

// --- Detalhes Venda ---
export const DetalhesVendaSchema = z.object({
    destinacao: z.enum(['venda', 'doacao', 'perda', 'processamento', 'consumo proprio']).optional(),
    valor_unitario: z.number().optional(),
    cliente: z.string().optional(),
    nf_recibo: z.string().optional(),
    qtd: z.number().optional(),
    unidade: z.nativeEnum(UnitType).or(z.string()).optional()
});

// --- Detalhes Compostagem ---
export const DetalhesCompostagemSchema = z.object({
    acao: z.enum(['Nova Pilha', 'Revirada', 'Temperatura', 'Agua', 'Uso']).optional(),
    n_pilha: z.string().optional(),
    ingredientes: z.string().optional(),
    temperatura: z.number().optional(),
    responsavel: z.string().optional()
});

// --- Detalhes Genéricos (Para 'Outro' ou legado) ---
export const DetalhesGenericoSchema = z.record(z.string(), z.any());

// ==================================================================
// ||                     TYPESCRIPT TYPES                         ||
// ==================================================================

export type DetalhesPlantio = z.infer<typeof DetalhesPlantioSchema>;
export type DetalhesManejo = z.infer<typeof DetalhesManejoSchema>;
export type DetalhesColheita = z.infer<typeof DetalhesColheitaSchema>;
export type DetalhesVenda = z.infer<typeof DetalhesVendaSchema>;
export type DetalhesCompostagem = z.infer<typeof DetalhesCompostagemSchema>;
export type DetalhesGenerico = z.infer<typeof DetalhesGenericoSchema>;

// Discriminated Unions para Runtime Check seguro
export type DetalhesTecnicos =
    | DetalhesPlantio
    | DetalhesManejo
    | DetalhesColheita
    | DetalhesVenda
    | DetalhesCompostagem
    | DetalhesGenerico;

export interface BaseRegistro {
    id: string;
    pmo_id: number;
    propriedade_id?: any;
    user_id?: string;
    created_at?: string;
    data_registro: string;
    talhao_canteiro?: string;
    produto?: string;
    observacao_original?: string;
    fornecedor?: string; // Sprint 1: Coluna nativa
    nota_fiscal?: string; // Sprint 1: Coluna nativa

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

export interface RegistroLimpeza extends BaseRegistro {
    tipo_atividade: ActivityType.OUTRO | 'Limpeza'; // Usaremos 'outro' com subtipo ou nova categoria
    data_limpeza: string;
    item_area: string;
    tipo_limpeza: string;
    produto_utilizado?: string;
    dosagem?: string;
    responsavel: string;
    observacao?: string;
    // Campo opcional para satisfazer restrições de união em CadernoEntry se necessário
    detalhes_tecnicos?: null; 
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

export interface RegistroVenda extends BaseRegistro {
    tipo_atividade: ActivityType.VENDA | 'Venda';
    detalhes_tecnicos: DetalhesVenda;
}

export interface RegistroCompostagem extends BaseRegistro {
    tipo_atividade: ActivityType.COMPOSTAGEM | 'Compostagem';
    detalhes_tecnicos: DetalhesCompostagem;
}

export interface RegistroOutro extends BaseRegistro {
    tipo_atividade: ActivityType.OUTRO | ActivityType.INSUMO | ActivityType.CANCELADO | string;
    detalhes_tecnicos: DetalhesGenerico;
}

export type CadernoEntry = RegistroPlantio | RegistroManejo | RegistroColheita | RegistroVenda | RegistroCompostagem | RegistroLimpeza | RegistroOutro;

// Alias para compatibilidade com código existente
export type CadernoRegistro = CadernoEntry;
export type CadernoCampoRecord = CadernoEntry;
