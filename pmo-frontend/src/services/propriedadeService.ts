import { supabase } from '../supabaseClient';
import { Propriedade } from '../domain/pmo/pmoTypes';

export const fetchPropriedade = async (id: number) => {
    try {
        const { data, error } = await supabase
            .from('propriedades')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const fetchAllPropriedades = async (userId: string): Promise<Propriedade[]> => {
    try {
        const { data, error } = await supabase
            .from('propriedades')
            .select('*')
            .eq('user_id', userId)
            .order('nome', { ascending: true });

        if (error) throw error;
        return (data as Propriedade[]) || [];
    } catch (error: any) {
        console.error('[propriedadeService] fetchAllPropriedades:', error.message);
        return [];
    }
};

export const updatePropriedade = async (id: number, updates: Partial<Propriedade> & { car?: string, inscricao_estadual?: string, matricula?: string, endereco_cadastral?: string }) => {
    try {
        const { data, error } = await supabase
            .from('propriedades')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

export const updateActivePropriedade = async (userId: string, propriedadeId: number | null) => {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ propriedade_ativa_id: propriedadeId })
            .eq('id', userId);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('[propriedadeService] updateActivePropriedade:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Deleta uma propriedade e todos os seus vínculos de forma atômica via RPC.
 * @param id ID da propriedade
 */
export const deletePropriedade = async (id: number): Promise<{ success: boolean; error?: string }> => {
    try {
        // Usamos a RPC atômica para limpar todas as dependências primeiro
        const { error } = await supabase.rpc('delete_propriedade_cascade', { 
            p_propriedade_id: id 
        });

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Erro ao deletar propriedade (Cascade):', error);
        return { 
            success: false, 
            error: error.message || 'Erro ao realizar exclusão em cascata.' 
        };
    }
};

export const getPropriedadeMetrics = async (id: number) => {
    try {
        const { data, error } = await supabase
            .rpc('get_propriedade_metrics', { p_propriedade_id: id });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};

