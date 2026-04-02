// pmo-frontend/src/domain/organizacao/orgTypes.ts

export type OrganizacaoTipo = 'cooperativa' | 'associacao' | 'spg' | 'grupo_informal';

export interface Organizacao {
    id: number;
    nome: string;
    cnpj?: string;
    tipo: OrganizacaoTipo;
    slug?: string;
    created_at: string;
    // Opcional: contagem de membros se vier via RPC ou subquery
    membros_count?: number;
}

export interface OrganizacaoMembro {
    organizacao_id: number;
    propriedade_id: number;
    role: string;
    data_filiacao: string;
    // Preenchido via join
    organizacao?: Organizacao;
    propriedades?: {
        nome: string;
        area_total_ha: number;
    };
    profiles?: {
        nome: string;
    };
}
