import { supabase } from '../supabaseClient';
import type { UserProfile, FetchResult, SaveResult } from '../domain/pmo/pmoTypes';

/**
 * Busca o perfil do usuário (incluindo pmo_ativo_id).
 * 
 * @param userId - ID do usuário
 * @returns FetchResult com UserProfile ou erro
 */
export async function fetchUserProfile(
    userId: string
): Promise<FetchResult<UserProfile>> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, nome, avatar_url, pmo_ativo_id, telefone, role')
            .eq('id', userId)
            .single();

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data: data as UserProfile };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar perfil';
        return { success: false, error: message };
    }
}

/**
 * Define qual PMO está ativo para o usuário.
 * 
 * @param userId - ID do usuário
 * @param pmoId - ID do PMO a ativar
 * @returns SaveResult indicando sucesso ou erro
 */
export async function setActivePmo(
    _userId: string,
    pmoId: string
): Promise<SaveResult> {
    try {
        const { error } = await supabase.rpc('update_profile', {
            p_updates: { pmo_ativo_id: pmoId }
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, pmoId };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao ativar PMO';
        return { success: false, error: message };
    }
}

/**
 * Busca propriedades vinculadas ao usuário.
 * Útil para fallback quando o PMO não tem propriedade_id vinculado.
 * 
 * @param userId - ID do usuário (UUID)
 * @returns Lista de propriedades
 */
export async function fetchUserProperties(userId: string): Promise<FetchResult<any[]>> {
    try {
        const { data, error } = await supabase
            .from('propriedades')
            .select('id, nome')
            .eq('user_id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true, data: data || [] };
    } catch (err) {
        return { success: false, error: 'Erro ao buscar propriedades do usuário' };
    }
}

/**
 * Atualiza os dados do perfil do usuário.
 * 
 * @param userId - ID do usuário
 * @param data - Dados para atualizar (nome, telefone)
 * @returns SaveResult indicando sucesso ou erro
 */
export async function updateUserProfile(
    _userId: string,
    data: { nome?: string; telefone?: string; avatar_url?: string }
): Promise<SaveResult> {
    try {
        const { error } = await supabase.rpc('update_profile', {
            p_updates: data
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao atualizar perfil';
        return { success: false, error: message };
    }
}

/**
 * Faz o upload do avatar do usuário para o bucket 'avatars'.
 * 
 * @param userId - ID do usuário
 * @param file - Arquivo de imagem
 * @returns FetchResult com a URL pública
 */
export async function uploadAvatar(userId: string, file: File): Promise<FetchResult<string>> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
        
        return { success: true, data: data.publicUrl };
    } catch (err) {
        return { success: false, error: 'Erro ao fazer upload da imagem' };
    }
}
