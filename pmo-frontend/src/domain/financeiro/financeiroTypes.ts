// Domain types for the Financial Analytical Engine (Ledger Slice 2)
// Mirrors the return types of PostgreSQL RPCs: get_dre_mensal, get_lucro_por_talhao

export interface DREMensal {
    mes: string;       // 'Jan', 'Fev', ... 'Dez'
    receitas: number;
    despesas: number;
    lucro: number;
}

export interface LucroTalhao {
    talhao_id: number;
    talhao_nome: string;
    cor: string;       // Hex color from talhoes.cor
    receitas: number;
    despesas: number;
    lucro: number;
}

// Aggregated totals for the DRE header cards
export interface DRESummary {
    totalReceitas: number;
    totalDespesas: number;
    lucroLiquido: number;
    margemLiquida: number; // %
}
