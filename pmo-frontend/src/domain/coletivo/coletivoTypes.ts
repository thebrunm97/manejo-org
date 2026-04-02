// src/domain/coletivo/coletivoTypes.ts

export type DemandaStatus = 'aberta' | 'em_captacao' | 'fechada' | 'cancelada';
export type CotaStatus = 'pendente' | 'confirmada' | 'entregue_parcial' | 'entregue_total' | 'cancelada';

export interface DemandaColetiva {
    id: string;
    created_at: string;
    titulo: string;
    descricao?: string;
    cultura: string;
    unidade: string;
    quantidade_total: number;
    quantidade_assumida: number;
    preco_referencia?: number;
    data_entrega: string; // ISO Date
    status: DemandaStatus;
    modalidade_exigida: 'ORGANICO' | 'CONVENCIONAL' | 'TRANSICAO';
    criado_por?: string;
    cooperativa_id?: number; // Legacy, kept for compatibility if needed
    organizacao_id?: number;
    volume_necessario: number;
    unidade_medida: string;
    data_limite_entrega: string;
}

export interface DemandaIntencao {
    id: string;
    demanda_id: string;
    propriedade_id: number;
    user_id: string;
    volume_ofertado: number;
    status_intencao: 'pendente' | 'aceita' | 'rejeitada';
    created_at: string;
    propriedade?: {
        nome: string;
    };
}

export interface CotaProdutor {
    id: string;
    demanda_id: string;
    propriedade_id: number;
    user_id: string;
    quantidade_assumida: number;
    quantidade_entregue: number;
    status: CotaStatus;
    observacao?: string;
    created_at: string;
}

export interface CronogramaPlantio {
    id: string;
    cota_id: string;
    ciclo_dias_estimado?: number;
    data_plantio_recomendada?: string; // ISO Date
    data_alerta_whatsapp?: string; // ISO Date
    alerta_enviado: boolean;
    observacao_ia?: string;
    created_at: string;
}
