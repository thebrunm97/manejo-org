import { supabase } from '../supabaseClient';
import { DREMensal, LucroTalhao } from '../domain/financeiro/financeiroTypes';

// Supabase RPCs return NUMERIC as string — we need to coerce to number manually.
const toNumber = (val: unknown): number => {
    const n = Number(val);
    return isNaN(n) ? 0 : n;
};

export const getDREMensal = async (propriedadeId: number, ano: number) => {
    try {
        const { data, error } = await supabase.rpc('get_dre_mensal', {
            p_propriedade_id: propriedadeId,
            p_ano: ano,
        });

        if (error) throw error;

        // Cast NUMERIC fields from Postgres (returned as strings) to JS number
        const typed: DREMensal[] = (data ?? []).map((row: any) => ({
            mes: row.mes,
            receitas: toNumber(row.receitas),
            despesas: toNumber(row.despesas),
            lucro: toNumber(row.lucro),
        }));

        return { success: true, data: typed };
    } catch (error: any) {
        console.error('[financeiroService] getDREMensal:', error.message);
        return { success: false, error: error.message, data: [] };
    }
};

export const getLucroPorTalhao = async (propriedadeId: number, ano: number) => {
    try {
        const { data, error } = await supabase.rpc('get_lucro_por_talhao', {
            p_propriedade_id: propriedadeId,
            p_ano: ano,
        });

        if (error) throw error;

        const typed: LucroTalhao[] = (data ?? []).map((row: any) => ({
            talhao_id: toNumber(row.talhao_id),
            talhao_nome: row.talhao_nome,
            cor: row.cor ?? '#16a34a',
            receitas: toNumber(row.receitas),
            despesas: toNumber(row.despesas),
            lucro: toNumber(row.lucro),
        }));

        return { success: true, data: typed };
    } catch (error: any) {
        console.error('[financeiroService] getLucroPorTalhao:', error.message);
        return { success: false, error: error.message, data: [] };
    }
};
