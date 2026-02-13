import { supabase } from '../supabaseClient';

export const analiseService = {
    // Salvar nova análise
    async saveAnalise(dados) {
        try {
            // Validate numeric fields to ensure they are actually numbers or null
            const payload = {
                talhao_id: dados.talhao_id,
                data_analise: dados.data_analise,
                ph_agua: dados.ph ? parseFloat(dados.ph) : null,
                fosforo: dados.fosforo ? parseFloat(dados.fosforo) : null,
                potassio: dados.potassio ? parseFloat(dados.potassio) : null,
                calcio: dados.calcio ? parseFloat(dados.calcio) : null,
                magnesio: dados.magnesio ? parseFloat(dados.magnesio) : null,
                saturacao_bases: dados.saturacao_bases ? parseFloat(dados.saturacao_bases) : null,
                materia_organica: dados.materia_organica ? parseFloat(dados.materia_organica) : null,
                argila: dados.argila ? parseFloat(dados.argila) : null,
                areia: dados.areia ? parseFloat(dados.areia) : null,
                silte: dados.silte ? parseFloat(dados.silte) : null,
            };

            let result;

            if (dados.id) {
                // UPDATE existing analysis
                result = await supabase
                    .from('analises_solo')
                    .update(payload)
                    .eq('id', dados.id)
                    .select()
                    .single();
            } else {
                // INSERT new analysis
                result = await supabase
                    .from('analises_solo')
                    .insert([payload])
                    .select()
                    .single();
            }

            const { data, error } = result;

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao salvar análise:', error);
            throw error;
        }
    },

    // Buscar a análise mais recente de um talhão
    async getLatestAnalise(talhaoId) {
        try {
            const { data, error } = await supabase
                .from('analises_solo')
                .select('*')
                .eq('talhao_id', talhaoId)
                .order('data_analise', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;

            // Map DB columns back to UI properties to ensure compatibility
            if (data) {
                return {
                    ...data,
                    ph: data.ph_agua, // Map ph_agua back to ph for UI
                };
            }
            return data;
        } catch (error) {
            console.error('Erro ao buscar análise:', error);
            throw error;
        }
    }
};
