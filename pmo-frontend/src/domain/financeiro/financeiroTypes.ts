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

// Representa uma transação no Ledger Financeiro (tabela transacoes_financeiras com join em categorias)
export interface TransacaoFinanceira {
    id: string;
    pmo_id?: number;
    propriedade_id: number;
    data_transacao: string;
    valor_total: number;
    tipo: 'RECEITA' | 'DESPESA';
    fornecedor?: string;
    nota_fiscal?: string;
    created_at?: string;
    // Campo que vem do join com categorias_financeiras
    categoria_nome?: string;
}
