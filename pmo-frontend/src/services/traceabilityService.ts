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

    const { data: res, error } = await supabase.rpc('rpc_insert_lote_rastreabilidade', {
        p_codigo_lote: codigoLote,
        p_caderno_campo_id: loteData.caderno_campo_id || null,
        p_propriedade_id: loteData.propriedade_id,
        p_cultura: loteData.cultura,
        p_data_colheita: loteData.data_colheita,
        p_quantidade: loteData.quantidade,
        p_qr_code_url: loteData.qr_code_url || null
    });

    if (error || !res) {
        console.error('Error executing traceability RPC:', error);
        return null;
    }

    if (res.status === 'error') {
        console.error('RPC Business Error:', res.message, res.code);
        // O ideal é a UI tratar ERR_DUPLICATE e tentar novamente, mas
        // por segurança retornamos null para abortar como o antigo erro de DB fazia.
        return null;
    }

    // A RPC retorna apenas os campos base para economizar,
    // nós montamos o objeto retornado juntando o loteData original
    return {
        ...loteData,
        id: res.data.id,
        codigo_lote: res.data.codigo_lote
    } as LoteRastreabilidade;
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
