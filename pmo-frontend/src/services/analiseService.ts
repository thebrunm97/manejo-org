import { supabase } from '../supabaseClient';
import { Database } from '../types/supabase';

type AnaliseSoloRow = Database['public']['Tables']['analises_solo']['Row'];
type AnaliseSoloInsert = Database['public']['Tables']['analises_solo']['Insert'];

export interface AnaliseDados extends Partial<Omit<AnaliseSoloRow, 'ph_agua'>> {
    ph?: string | number | null;
    ph_agua?: number | null;
}

export const analiseService = {
    /**
     * Salvar nova análise
     */
    async saveAnalise(dados: AnaliseDados): Promise<AnaliseSoloRow> {
        try {
            // Validate numeric fields to ensure they are actually numbers or null
            const payload: AnaliseSoloInsert = {
                talhao_id: dados.talhao_id!,
                data_analise: dados.data_analise,
                ph_agua: dados.ph ? parseFloat(dados.ph.toString()) : (dados.ph_agua || null),
                fosforo: dados.fosforo ? parseFloat(dados.fosforo.toString()) : null,
                potassio: dados.potassio ? parseFloat(dados.potassio.toString()) : null,
                calcio: dados.calcio ? parseFloat(dados.calcio.toString()) : null,
                magnesio: dados.magnesio ? parseFloat(dados.magnesio.toString()) : null,
                saturacao_bases: dados.saturacao_bases ? parseFloat(dados.saturacao_bases.toString()) : null,
                materia_organica: dados.materia_organica ? parseFloat(dados.materia_organica.toString()) : null,
                argila: dados.argila ? parseFloat(dados.argila.toString()) : null,
                areia: dados.areia ? parseFloat(dados.areia.toString()) : null,
                silte: dados.silte ? parseFloat(dados.silte.toString()) : null,
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
            if (!data) throw new Error("Erro ao salvar análise: nenhum dado retornado.");

            return data;
        } catch (error) {
            console.error('Erro ao salvar análise:', error);
            throw error;
        }
    },

    /**
     * Buscar a análise mais recente de um talhão
     */
    async getLatestAnalise(talhaoId: string): Promise<AnaliseDados | null> {
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
