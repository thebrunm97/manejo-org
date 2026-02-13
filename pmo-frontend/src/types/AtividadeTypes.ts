import { z } from 'zod';

// ==================================================================
// ||            ATIVIDADE TYPES (Multi-Cultura / Multi-Local)     ||
// ==================================================================

// --- Enums ---
export const SistemaEnum = z.enum(['monocultura', 'consorcio', 'saf']);
export const PapelEnum = z.enum(['principal', 'secundario', 'cobertura']);
export const EstratoEnum = z.enum(['emergente', 'alto', 'medio', 'baixo']);
export const StatusAtividadeEnum = z.enum(['pendente', 'realizado', 'cancelado']);
export const FonteEnum = z.enum(['manual', 'whatsapp', 'importacao']);

// --- Local Estruturado ---
export const LocalEstruturadoSchema = z.object({
    talhao: z.string().min(1, 'Talhão é obrigatório'),
    talhao_id: z.number().optional(),
    canteiro: z.string().optional(),
    linha: z.string().optional()
});

// --- Atividade Item (cada cultura/local dentro de uma atividade) ---
export const AtividadeItemSchema = z.object({
    produto: z.string().min(1, 'Produto é obrigatório').transform(s => s.toUpperCase()),
    variedade: z.string().optional(),
    quantidade: z.number().positive('Quantidade deve ser maior que 0'),
    unidade: z.string().min(1, 'Unidade é obrigatória'),
    local: LocalEstruturadoSchema,

    // Consórcio/SAF
    papel: PapelEnum.optional(),
    estrato: EstratoEnum.optional(),

    // Rastreabilidade (Certificação Orgânica)
    lote: z.string().optional(),
    origem: z.string().optional(),
    lote_semente: z.string().optional()
});

// --- Atividade Campo (Registro Principal) ---
export const AtividadeCampoSchema = z.object({
    // Identificação
    id: z.string().uuid().optional(),
    pmo_id: z.number(),
    talhao_id: z.number().optional(),

    // Temporal
    data_registro: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de data inválido (YYYY-MM-DD)'),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),

    // Classificação
    tipo_atividade: z.enum(['Plantio', 'Manejo', 'Colheita', 'Insumo', 'Outro']),
    status: StatusAtividadeEnum.default('realizado'),
    sistema: SistemaEnum.optional(),

    // Multi-Cultura / Multi-Local
    atividades: z.array(AtividadeItemSchema).min(1, 'Pelo menos uma atividade é obrigatória').optional(),

    // Metadados
    observacao_original: z.string().optional(),
    fonte: FonteEnum.default('manual'),
    secao_origem: z.string().optional(),

    // Campos Legado (mantidos para compatibilidade)
    produto: z.string().optional(),
    talhao_canteiro: z.string().optional(),
    quantidade_valor: z.number().optional(),
    quantidade_unidade: z.string().optional(),
    detalhes_tecnicos: z.record(z.string(), z.any()).optional()
});

// --- Tipos Inferidos ---
export type Sistema = z.infer<typeof SistemaEnum>;
export type Papel = z.infer<typeof PapelEnum>;
export type Estrato = z.infer<typeof EstratoEnum>;
export type StatusAtividade = z.infer<typeof StatusAtividadeEnum>;
export type Fonte = z.infer<typeof FonteEnum>;
export type LocalEstruturado = z.infer<typeof LocalEstruturadoSchema>;
export type AtividadeItem = z.infer<typeof AtividadeItemSchema>;
export type AtividadeCampo = z.infer<typeof AtividadeCampoSchema>;

// --- Helpers para Consórcio e SAF ---
export const ESTRATOS_SAF = {
    emergente: 'Árvores altas (>15m): Ingá, Eucalipto',
    alto: 'Frutíferas médias (5-15m): Banana, Citros',
    medio: 'Arbustos (1-5m): Café, Cacau',
    baixo: 'Rasteiras (<1m): Hortaliças, Mandioca'
} as const;

export const ARRANJOS_CONSORCIO = {
    linhas_alternadas: 'Linhas alternadas',
    faixas: 'Faixas paralelas',
    misto: 'Plantio misto',
    outro: 'Outro arranjo'
} as const;

// --- Função de Validação ---
export function validateAtividadeCampo(data: unknown): {
    success: boolean;
    data?: AtividadeCampo;
    errors?: z.ZodError
} {
    const result = AtividadeCampoSchema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}

// --- Função para criar atividade vazia ---
export function createEmptyAtividadeItem(produto = ''): AtividadeItem {
    return {
        produto: produto.toUpperCase(),
        quantidade: 0,
        unidade: 'unid',
        local: { talhao: '' }
    };
}
