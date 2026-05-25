import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabaseClient';
import { TransacaoFinanceira } from '../../domain/financeiro/financeiroTypes';

export function useTransacoes(propriedadeId: number | undefined) {
    const [transacoes, setTransacoes] = useState<TransacaoFinanceira[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTransacoes = useCallback(async () => {
        if (!propriedadeId) return;

        setLoading(true);
        setError(null);

        try {
            // Utilizamos uma sintaxe de join do Supabase para trazer a categoria
            const { data, error: sbError } = await supabase
                .from('transacoes_financeiras')
                .select(`
                    *,
                    categorias_financeiras (
                        nome
                    )
                `)
                .eq('propriedade_id', propriedadeId)
                .order('data_transacao', { ascending: false });

            if (sbError) throw sbError;

            const mapped: TransacaoFinanceira[] = (data || []).map((row: any) => ({
                id: row.id,
                pmo_id: row.pmo_id,
                propriedade_id: row.propriedade_id,
                data_transacao: row.data_transacao,
                valor_total: Number(row.valor_total),
                tipo: row.tipo,
                fornecedor: row.fornecedor,
                nota_fiscal: row.nota_fiscal,
                created_at: row.created_at,
                // Mapear o join
                categoria_nome: row.categorias_financeiras?.nome || 'Sem Categoria'
            }));

            setTransacoes(mapped);
        } catch (err: any) {
            console.error('[useTransacoes] Erro:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [propriedadeId]);

    useEffect(() => {
        fetchTransacoes();
    }, [fetchTransacoes]);

    return { transacoes, loading, error, refetch: fetchTransacoes };
}
