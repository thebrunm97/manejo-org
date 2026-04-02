import { useState, useEffect, useCallback } from 'react';
import { getDREMensal, getLucroPorTalhao } from '../../services/financeiroService';
import { DREMensal, DRESummary, LucroTalhao } from '../../domain/financeiro/financeiroTypes';

interface UseFinanceiroStatsResult {
    dataDRE: DREMensal[];
    dataTalhoes: LucroTalhao[];
    summary: DRESummary;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

const EMPTY_SUMMARY: DRESummary = {
    totalReceitas: 0,
    totalDespesas: 0,
    lucroLiquido: 0,
    margemLiquida: 0,
};

function calcSummary(dre: DREMensal[]): DRESummary {
    const totalReceitas = dre.reduce((acc, m) => acc + m.receitas, 0);
    const totalDespesas = dre.reduce((acc, m) => acc + m.despesas, 0);
    const lucroLiquido = totalReceitas - totalDespesas;
    const margemLiquida = totalReceitas > 0
        ? Math.round((lucroLiquido / totalReceitas) * 100)
        : 0;

    return { totalReceitas, totalDespesas, lucroLiquido, margemLiquida };
}

export function useFinanceiroStats(
    propriedadeId: number | undefined,
    ano: number
): UseFinanceiroStatsResult {
    const [dataDRE, setDataDRE] = useState<DREMensal[]>([]);
    const [dataTalhoes, setDataTalhoes] = useState<LucroTalhao[]>([]);
    const [summary, setSummary] = useState<DRESummary>(EMPTY_SUMMARY);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        if (!propriedadeId) return;

        setLoading(true);
        setError(null);

        const [dreResult, talhoesResult] = await Promise.all([
            getDREMensal(propriedadeId, ano),
            getLucroPorTalhao(propriedadeId, ano),
        ]);

        if (!dreResult.success) {
            setError(dreResult.error ?? 'Erro ao carregar DRE');
        } else {
            setDataDRE(dreResult.data);
            setSummary(calcSummary(dreResult.data));
        }

        if (!talhoesResult.success) {
            setError(prev => prev ?? (talhoesResult.error ?? 'Erro ao carregar talhões'));
        } else {
            setDataTalhoes(talhoesResult.data);
        }

        setLoading(false);
    }, [propriedadeId, ano]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return { dataDRE, dataTalhoes, summary, loading, error, refetch: fetchAll };
}
