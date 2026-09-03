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
            const toNumberOrNull = (v: any): number | null => {
                if (v === null || v === undefined || v === '') return null;
                const n = parseFloat(String(v).replace(',', '.'));
                return Number.isNaN(n) ? null : n;
            };

            // Validate numeric fields to ensure they are actually numbers or null
            const payload: AnaliseSoloInsert = {
                talhao_id: dados.talhao_id!,
                data_analise: dados.data_analise,
                ph_agua: dados.ph != null && dados.ph !== '' ? toNumberOrNull(dados.ph) : toNumberOrNull(dados.ph_agua),
                fosforo: toNumberOrNull(dados.fosforo),
                potassio: toNumberOrNull(dados.potassio),
                calcio: toNumberOrNull(dados.calcio),
                magnesio: toNumberOrNull(dados.magnesio),
                saturacao_bases: toNumberOrNull(dados.saturacao_bases),
                materia_organica: toNumberOrNull(dados.materia_organica),
                argila: toNumberOrNull(dados.argila),
                areia: toNumberOrNull(dados.areia),
                silte: toNumberOrNull(dados.silte),
            };

            const result = await supabase.rpc('upsert_analise_solo', { p_payload: payload });

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
