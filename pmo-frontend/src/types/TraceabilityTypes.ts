export interface LoteRastreabilidade {
    id: string;
    caderno_campo_id: string;
    propriedade_id: number;
    codigo_lote: string;
    cultura: string;
    quantidade: number;
    data_colheita: string;
    qr_code_url?: string;
    created_at: string;
    user_id: string;
}

export interface TraceData {
    lote: LoteRastreabilidade;
    propriedade: {
        nome: string;
        cidade: string;
        uf: string;
        modalidade_predominante: string;
        car?: string;
    };
    organizacao?: {
        nome: string;
        tipo: string;
    };
    historico_manejo: {
        data: string;
        atividade: string;
        produto: string;
    }[];
}
