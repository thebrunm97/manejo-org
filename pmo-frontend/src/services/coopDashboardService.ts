import { supabase } from '../supabaseClient';

export interface RecentProduction {
    id: string;
    data_registro: string;
    produto: string;
    quantidade_valor: number;
    quantidade_unidade: string;
    propriedade_nome: string;
}

export interface CoopDashboardStats {
    total_membros: number;
    area_total_vinculada: number;
    area_por_cultura: Array<{ cultura: string; area: number }>;
    producao_recente: RecentProduction[];
    last_updated: string;
}

/**
 * Busca as estatísticas agregadas para o Dashboard da Cooperativa via RPC.
 */
export const getDashboardStats = async (orgId: number) => {
    try {
        const { data, error } = await supabase.rpc('get_coop_dashboard_stats', { 
            p_organizacao_id: orgId 
        });

        if (error) throw error;
        
        return { 
            success: true, 
            data: data as CoopDashboardStats 
        };
    } catch (error: any) {
        console.error('[coopDashboardService] getDashboardStats:', error.message);
        return { 
            success: false, 
            error: error.message 
        };
    }
};

/**
 * Verifica se o usuário atual é gestor de uma organização específica.
 * Útil para controle de menu dinâmico.
 */
export const checkIfGestor = async (orgId?: number) => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data: props, error: propsError } = await supabase
            .from('propriedades')
            .select('id')
            .eq('user_id', user.id);
        
        if (propsError || !props || props.length === 0) return false;
        
        const propIds = props.map(p => p.id);
        
        let query = supabase
            .from('organizacao_membros')
            .select('role')
            .in('propriedade_id', propIds)
            .eq('role', 'gestor');
        
        if (orgId) {
            query = query.eq('organizacao_id', orgId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data.length > 0;
    } catch (err) {
        return false;
    }
}
