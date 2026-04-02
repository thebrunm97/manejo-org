import { supabase } from '../supabaseClient';
import { TraceData, LoteRastreabilidade } from '../types/TraceabilityTypes';

export const getTraceDataByCode = async (codigoLote: string): Promise<TraceData | null> => {
    const { data, error } = await supabase.rpc('get_traceability_data', { 
        p_codigo_lote: codigoLote 
    });

    if (error) {
        console.error('Error fetching traceability data:', error);
        return null;
    }

    return data as TraceData;
};

export const createLoteRastreabilidade = async (loteData: Partial<LoteRastreabilidade>): Promise<LoteRastreabilidade | null> => {
    // Generate a unique code if not provided
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 8);
    const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
    const codigoLote = loteData.codigo_lote || `LOT-${timestamp}-${randomStr}`;

    const { data, error } = await supabase
        .from('lotes_rastreabilidade')
        .insert([{
            ...loteData,
            codigo_lote: codigoLote
        }])
        .select()
        .single();

    if (error) {
        console.error('Error creating traceability lot:', error);
        return null;
    }

    return data as LoteRastreabilidade;
};

export const getLoteByCadernoId = async (cadernoId: string): Promise<LoteRastreabilidade | null> => {
    const { data, error } = await supabase
        .from('lotes_rastreabilidade')
        .select('*')
        .eq('caderno_campo_id', cadernoId)
        .maybeSingle();

    if (error) {
        console.error('Error checking for existing lot:', error);
        return null;
    }

    return data as LoteRastreabilidade;
};
