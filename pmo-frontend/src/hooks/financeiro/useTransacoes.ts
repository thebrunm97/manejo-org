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
                    ),
                    transacao_alocacoes (
                        id,
                        talhao_id,
                        valor_alocado,
                        percentual_alocado,
                        talhoes (
                            nome
                        ),
                        caderno_campo (
                            talhao_canteiro
                        )
                    )
                `)
                .eq('propriedade_id', propriedadeId)
                .order('data_transacao', { ascending: false });

            if (sbError) throw sbError;

            const mapped: TransacaoFinanceira[] = (data || []).map((row: any) => {
                // Obter talhao_canteiro do caderno_campo associado a qualquer uma das alocações da transação
                const talhao_canteiro = row.transacao_alocacoes?.find((aloc: any) => aloc.caderno_campo?.talhao_canteiro)?.caderno_campo?.talhao_canteiro || null;

                return {
                    id: row.id,
                    pmo_id: row.pmo_id,
                    propriedade_id: row.propriedade_id,
                    data_transacao: row.data_transacao,
                    valor_total: Number(row.valor_total),
                    tipo: row.tipo,
                    fornecedor: row.fornecedor,
                    nota_fiscal: row.nota_fiscal,
                    created_at: row.created_at,
                    categoria_nome: row.categorias_financeiras?.nome || 'Sem Categoria',
                    talhao_canteiro: talhao_canteiro,
                    alocacoes: (row.transacao_alocacoes || []).map((aloc: any) => ({
                        id: aloc.id,
                        talhao_id: aloc.talhao_id,
                        talhao_nome: aloc.talhoes?.nome || 'Global',
                        valor_alocado: Number(aloc.valor_alocado),
                        percentual_alocado: Number(aloc.percentual_alocado)
                    }))
                };
            });

            setTransacoes(mapped);
        } catch (err: any) {
            console.error('[useTransacoes] Erro:', err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [propriedadeId]);

    useEffect(() => {
        if (!propriedadeId) return;

        // Executar busca inicial
        fetchTransacoes();

        // Subscrição em tempo real para mudanças na tabela de transacoes_financeiras
        const channel = supabase
            .channel(`realtime:transacoes:${propriedadeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transacoes_financeiras',
                    filter: `propriedade_id=eq.${propriedadeId}`,
                },
                (payload) => {
                    console.log('[useTransacoes] Mudança em tempo real detectada:', payload);
                    fetchTransacoes();
                }
            )
            .subscribe();

        // Polling de baixo consumo (fallback) a cada 10 segundos para garantir consistência
        const interval = setInterval(() => {
            fetchTransacoes();
        }, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [propriedadeId, fetchTransacoes]);

    return { transacoes, loading, error, refetch: fetchTransacoes };
}
