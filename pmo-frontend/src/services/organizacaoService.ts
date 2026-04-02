import { supabase } from '../supabaseClient';
import { Organizacao, OrganizacaoMembro, OrganizacaoTipo } from '../domain/organizacao/orgTypes';

export const getOrganizacoes = async () => {
    try {
        const { data, error } = await supabase
            .from('organizacoes')
            .select('*')
            .order('nome', { ascending: true });

        if (error) throw error;
        return { success: true, data: data as Organizacao[] };
    } catch (error: any) {
        console.error('[organizacaoService] getOrganizacoes:', error.message);
        return { success: false, error: error.message };
    }
};

export const createOrganizacao = async (data: { nome: string; cnpj?: string; tipo: OrganizacaoTipo; slug?: string; created_at?: string }) => {
    try {
        const { data: newOrg, error } = await supabase
            .from('organizacoes')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return { success: true, data: newOrg as Organizacao };
    } catch (error: any) {
        console.error('[organizacaoService] createOrganizacao:', error.message);
        return { success: false, error: error.message };
    }
};

export const getMembros = async (organizacaoId: number) => {
    try {
        const { data, error } = await supabase
            .from('organizacao_membros')
            .select(`
                *,
                propriedades(nome, area_total_ha, user_id)
            `)
            .eq('organizacao_id', organizacaoId);

        if (error) throw error;
        
        // Ajuste manual se o join do Supabase for complexo (profiles via propriedades)
        // Se a estrutura de foreign keys permitir direct join organizacao_membros -> profiles (user_id), seria melhor.
        // Mas o membro é a PROPRIEDADE, então buscamos o dono da propriedade.
        
        return { success: true, data: data as any[] };
    } catch (error: any) {
        console.error('[organizacaoService] getMembros:', error.message);
        return { success: false, error: error.message };
    }
};

export const addMembro = async (organizacaoId: number, propriedadeId: number) => {
    try {
        const { error } = await supabase
            .from('organizacao_membros')
            .insert([{ 
                organizacao_id: organizacaoId, 
                propriedade_id: propriedadeId,
                role: 'membro',
                data_filiacao: new Date().toISOString()
            }]);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('[organizacaoService] addMembro:', error.message);
        return { success: false, error: error.message };
    }
};

export const removeMembro = async (organizacaoId: number, propriedadeId: number) => {
    try {
        const { error } = await supabase
            .from('organizacao_membros')
            .delete()
            .match({ organizacao_id: organizacaoId, propriedade_id: propriedadeId });

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('[organizacaoService] removeMembro:', error.message);
        return { success: false, error: error.message };
    }
};

export const fetchPropriedadeOrganizacoes = async (propriedadeId: number) => {
    try {
        const { data, error } = await supabase
            .from('organizacao_membros')
            .select(`
                *,
                organizacao:organizacoes(*)
            `)
            .eq('propriedade_id', propriedadeId);

        if (error) throw error;
        return { success: true, data: data as OrganizacaoMembro[] };
    } catch (error: any) {
        console.error('[organizacaoService] fetchPropriedadeOrganizacoes:', error.message);
        return { success: false, error: error.message };
    }
};
export const getOrganizacaoBySlug = async (slug: string) => {
    try {
        const { data, error } = await supabase
            .from('organizacoes')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) throw error;
        return { success: true, data: data as Organizacao };
    } catch (error: any) {
        console.error('[organizacaoService] getOrganizacaoBySlug:', error.message);
        return { success: false, error: error.message };
    }
};
