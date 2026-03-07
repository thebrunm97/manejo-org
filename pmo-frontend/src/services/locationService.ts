import { supabase } from '../supabaseClient';
import { Database } from '../types/supabase';

type TalhaoRow = Database['public']['Tables']['talhoes']['Row'];
type TalhaoInsert = Database['public']['Tables']['talhoes']['Insert'];
type CanteiroRow = Database['public']['Tables']['canteiros']['Row'];
type CanteiroInsert = Database['public']['Tables']['canteiros']['Insert'];

export interface TalhaoWithCanteiros extends TalhaoRow {
    canteiros: Array<{
        id: string;
        nome: string;
        status: string | null;
    }>;
}

export const locationService = {
    /**
     * Busca todos os talhões ativos da propriedade.
     */
    getTalhoes: async (): Promise<TalhaoWithCanteiros[]> => {
        const { data, error } = await supabase
            .from('talhoes')
            .select(`
                *,
                canteiros (
                    id,
                    nome,
                    status
                )
            `)
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao buscar talhões:', error);
            throw error;
        }
        return (data as any) || [];
    },

    /**
     * Busca canteiros vinculados a um talhão específico.
     */
    getCanteirosByTalhao: async (talhaoId: string | number): Promise<CanteiroRow[]> => {
        if (!talhaoId) return [];

        const { data, error } = await supabase
            .from('canteiros')
            .select('*')
            .eq('talhao_id', talhaoId)
            .order('nome', { ascending: true });

        if (error) {
            console.error('Erro ao buscar canteiros:', error);
            throw error;
        }
        return data || [];
    },

    /**
     * Cria um novo canteiro/espaço no banco de dados.
     */
    createCanteiro: async (talhaoId: number, nome: string, metadata: any = {}): Promise<CanteiroRow> => {
        const payload: CanteiroInsert = {
            talhao_id: talhaoId,
            nome: nome,
            // tipo: metadata.tipo || 'canteiro', // Not in Row type in supabase.ts check earlier?
            largura_metros: metadata.largura || null,
            comprimento_metros: metadata.comprimento || null,
            // area_total_m2: metadata.area || null, // Not in Row type in supabase.ts check earlier?
        };

        const { data, error } = await supabase
            .from('canteiros')
            .insert([payload])
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar canteiro:', error);
            throw error;
        }
        return data;
    },

    /**
     * Cria múltiplos canteiros/estruturas de uma vez (Batch Insert).
     */
    createCanteirosBatch: async (payloads: CanteiroInsert[]): Promise<CanteiroRow[]> => {
        const { data, error } = await supabase
            .from('canteiros')
            .insert(payloads)
            .select();

        if (error) {
            console.error('Erro ao criar canteiros em lote:', error);
            throw error;
        }
        return data || [];
    },

    /**
     * Remove um canteiro pelo ID.
     */
    deleteCanteiro: async (id: string): Promise<boolean> => {
        const { error } = await supabase
            .from('canteiros')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Erro ao deletar canteiro:', error);
            throw error;
        }
        return true;
    },

    /**
     * Atualiza dados de um talhão.
     */
    updateTalhao: async (id: number, data: Partial<TalhaoRow>): Promise<boolean> => {
        const { error } = await supabase
            .from('talhoes')
            .update(data)
            .eq('id', id);

        if (error) {
            console.error('Erro ao atualizar talhão:', error);
            throw error;
        }
        return true;
    },

    /**
     * Cria um novo talhão.
     */
    createTalhao: async (talhaoData: TalhaoInsert): Promise<TalhaoRow> => {
        const { data, error } = await supabase
            .from('talhoes')
            .insert([talhaoData])
            .select()
            .single();

        if (error) {
            console.error("Erro ao criar talhão:", error);
            throw error;
        }
        return data;
    }
};
