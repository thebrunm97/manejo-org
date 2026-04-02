import { supabase } from '../supabaseClient';
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
        .select('*, talhoes(nome), caderno_campo_canteiros(canteiros(id, nome))')
        .order('data_registro', { ascending: false });

    let limpezaQuery = supabase
        .from('pmo_limpeza')
        .select('*')
        .order('data_limpeza', { ascending: false });

    // Construir filtro OR para buscar registros associados à Propriedade OU ao PMO
    const orConditions: string[] = [];

    if (propriedadeId) {
        orConditions.push(`propriedade_id.eq.${propriedadeId}`);
    }
    if (pmoId) {
        orConditions.push(`pmo_id.eq.${pmoId}`);
    }

    // Se temos condições, aplicar .or()
    if (orConditions.length > 0) {
        const cond = orConditions.join(',');
        query = query.or(cond);
        limpezaQuery = limpezaQuery.or(cond);
    }
    // Se pmoId for explicitamente null (novo PMO sem ID), buscar órfãos
    else if (pmoId === null) {
        query = query.is('pmo_id', null);
        limpezaQuery = limpezaQuery.is('pmo_id', null);
    }
    // Sem IDs válidos, retornar vazio
    else {
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

    const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('Error adding registro:', error.message);
        throw error;
    }

    return data as CadernoEntry;
};

export const deleteRegistro = async (id: string): Promise<void> => {
    const { error } = await supabase
        .from('caderno_campo')
        .delete()
        .eq('id', id);

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

    const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

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
