import { supabase } from '../supabaseClient';
import { goApiRpc } from './goApiClient';
import {
    CadernoEntry,
    ActivityType,
    DetalhesPlantioSchema,
    DetalhesManejoSchema,
    DetalhesColheitaSchema
} from '../types/CadernoTypes';

export const getRegistros = async (pmoId?: number | null, propriedadeId?: number): Promise<CadernoEntry[]> => {
    let query = supabase
        .from('caderno_campo')
        .select('*, talhoes(nome), caderno_campo_canteiros(canteiros!caderno_campo_canteiros_canteiro_id_fkey(id, nome))')
        .order('data_registro', { ascending: false });

    let limpezaQuery = supabase
        .from('pmo_limpeza')
        .select('*')
        .order('data_limpeza', { ascending: false });

    // Aplicar filtros de Propriedade e PMO (Lógica AND para isolamento estrito)
    if (propriedadeId) {
        query = query.eq('propriedade_id', propriedadeId);
        limpezaQuery = limpezaQuery.eq('propriedade_id', propriedadeId);
    }
    
    if (pmoId) {
        query = query.eq('pmo_id', pmoId);
        limpezaQuery = limpezaQuery.eq('pmo_id', pmoId);
    }

    // Caso não tenha nenhum ID e pmoId seja null (ex: formulário de criação), buscar órfãos
    if (!propriedadeId && pmoId === null) {
        query = query.is('pmo_id', null);
        limpezaQuery = limpezaQuery.is('pmo_id', null);
    }
    
    // Se não temos IDs válidos, retornar vazio por segurança
    if (!propriedadeId && !pmoId) {
        return [];
    }

    const [{ data: cadernoData, error: cadernoError }, { data: limpezaData, error: limpezaError }] = await Promise.all([
        query,
        limpezaQuery
    ]);

    if (cadernoError || limpezaError) {
        console.error('Error fetching registros:', cadernoError?.message || limpezaError?.message);
        throw cadernoError || limpezaError;
    }

    if (!cadernoData && !limpezaData) return [];

    // --- Runtime Validation & Transformation ---
    const cadernoMapeado = (cadernoData || []).map((raw: any) => {
        try {
            // Determine Schema Based on Activity Type
            let detalhesParsed = {};
            const tipo = raw.tipo_atividade;
            const rawDetalhes = raw.detalhes_tecnicos || {};

            if (tipo === ActivityType.PLANTIO || tipo === 'Plantio') {
                const result = DetalhesPlantioSchema.safeParse(rawDetalhes);
                detalhesParsed = result.success ? result.data : rawDetalhes;
            }
            else if (tipo === ActivityType.MANEJO || tipo === 'Manejo') {
                const result = DetalhesManejoSchema.safeParse(rawDetalhes);
                detalhesParsed = result.success ? result.data : rawDetalhes;
            }
            else if (tipo === ActivityType.COLHEITA || tipo === 'Colheita') {
                const result = DetalhesColheitaSchema.safeParse(rawDetalhes);
                detalhesParsed = result.success ? result.data : rawDetalhes;
            }
            else {
                detalhesParsed = rawDetalhes; // Fallback for 'Outro'
            }

            // Return Typed Object
            return {
                ...raw,
                detalhes_tecnicos: detalhesParsed
            } as CadernoEntry;

        } catch (err) {
            console.warn(`Failed to parse registro ${raw.id}:`, err);
            // Return raw with 'Outro' type fallback to avoid crashing UI
            return { ...raw, tipo_atividade: 'Outro', detalhes_tecnicos: {} } as CadernoEntry;
        }
    });

    const limpezaMapeada = (limpezaData || []).map((raw: any) => ({
        ...raw,
        tipo_atividade: 'Limpeza',
        data_registro: raw.data_limpeza,
        produto: `${raw.item_area} (${raw.tipo_limpeza})`,
        detalhes_tecnicos: null,
        is_pmo_limpeza: true
    } as any));

    return [...cadernoMapeado, ...limpezaMapeada].sort((a, b) => 
        new Date(b.data_registro).getTime() - new Date(a.data_registro).getTime()
    );
};

export const addRegistro = async (registro: any): Promise<CadernoEntry> => {
    const isLimpeza = !!registro.is_pmo_limpeza;
    const table = isLimpeza ? 'pmo_limpeza' : 'caderno_campo';
    
    // Preparar payload para pmo_limpeza (remover campos virtuais do frontend)
    const payload = { ...registro };
    if (isLimpeza) {
        delete payload.tipo_atividade;
        delete payload.data_registro;
        delete payload.produto;
        delete payload.is_pmo_limpeza;
    }

    const rpcName = isLimpeza ? 'create_limpeza_registro' : 'create_caderno_registro';
    const { data, error } = await supabase.rpc(rpcName, { 
        p_payload: payload 
    });

    if (error) {
        console.error('Error adding registro:', error.message);
        throw error;
    }

    return data as CadernoEntry;
};

export const deleteRegistro = async (id: string): Promise<void> => {
    // DT-59, fatia 3: via gateway Go — ver internal/gateway/rpc_proxy.go.
    const { error } = await goApiRpc('delete_caderno_registro', {
        p_id: id
    });

    if (error) {
        console.error('Error deleting registro:', error.message);
        throw error;
    }
};

export const updateRegistro = async (id: string, updates: any): Promise<CadernoEntry> => {
    const isLimpeza = !!updates.is_pmo_limpeza;
    const table = isLimpeza ? 'pmo_limpeza' : 'caderno_campo';

    const payload = { ...updates };
    if (isLimpeza) {
        delete payload.tipo_atividade;
        delete payload.data_registro;
        delete payload.produto;
        delete payload.is_pmo_limpeza;
    }

    const rpcName = isLimpeza ? 'update_limpeza_registro' : 'update_caderno_registro';
    const { data, error } = await supabase.rpc(rpcName, {
        p_id: id,
        p_payload: payload
    });

    if (error) {
        console.error('Error updating registro:', error.message);
        throw error;
    }
    return data as CadernoEntry;
}

export const cadernoService = {
    getRegistros,
    addRegistro,
    deleteRegistro,
    updateRegistro
};
