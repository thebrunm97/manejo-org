import { supabase } from '../supabaseClient';

export const locationService = {
    /**
     * Busca todos os talhões ativos da propriedade.
     */
    getTalhoes: async () => {
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
        return data || [];
    },

    /**
     * Busca canteiros vinculados a um talhão específico.
     * @param {string|number} talhaoId 
     */
    getCanteirosByTalhao: async (talhaoId) => {
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
     * @param {string|number} talhaoId 
     * @param {string} nome 
     * @param {Object} metadata (largura, comprimento, tipo, etc.)
     */
    createCanteiro: async (talhaoId, nome, metadata = {}) => {
        const payload = {
            talhao_id: talhaoId,
            nome: nome,
            tipo: metadata.tipo || 'canteiro',
            largura: metadata.largura || null,
            comprimento: metadata.comprimento || null,
            area_total_m2: metadata.area || null,
            // map other fields if necessary based on schema
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
     * @param {Array} payloads - Array de objetos prontos para insert.
     */
    createCanteirosBatch: async (payloads) => {
        const { data, error } = await supabase
            .from('canteiros')
            .insert(payloads)
            .select();

        if (error) {
            console.error('Erro ao criar canteiros em lote:', error);
            throw error;
        }
        return data;
    },
    /**
     * Remove um canteiro pelo ID.
     * @param {string} id 
     */
    deleteCanteiro: async (id) => {
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
     * @param {string} id 
     * @param {Object} data - Objeto parcial com campos a atualizar
     */
    updateTalhao: async (id, data) => {
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

    createTalhao: async (talhaoData) => {
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
