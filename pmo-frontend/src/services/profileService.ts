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
 * Validade da assinatura do avatar.
 *
 * Curta de propósito, igual à do áudio (audioSigningService.ts): a URL é gerada
 * no momento de exibir, não sobrevive à sessão, e uma assinatura vazada vale
 * pouco.
 */
const VALIDADE_SEGUNDOS_AVATAR = 300;

/**
 * Extrai o path do objeto a partir do que está gravado em profiles.avatar_url.
 *
 * Tolera os dois formatos de propósito: linhas novas guardam apenas o caminho
 * cru (`<uid>/<arquivo>`), e o histórico guarda a URL pública completa do bucket
 * (que voltava 400 depois do bucket virar privado).
 */
const extrairCaminhoDoAvatar = (valor: string): string | null => {
    const limpo = valor.trim();

    if (!limpo.startsWith('http')) {
        return limpo.replace(/^\/+/, '') || null;
    }

    const marcador = '/avatars/';
    const idx = limpo.indexOf(marcador);
    if (idx !== -1) {
        const caminho = limpo.slice(idx + marcador.length).split('?')[0];
        try {
            return decodeURIComponent(caminho) || null;
        } catch {
            return caminho || null;
        }
    }

    return null;
};

/**
 * Emite uma URL assinada de curta duração para o avatar.
 *
 * Retorna `null` em vez de lançar: manter o placeholder inicial em vez de
 * derrubar a tela quando o dono não pode ler o objeto (política recusa a
 * assinatura).
 */
export const obterUrlAssinadaAvatar = async (
    valor: string | null | undefined,
): Promise<string | null> => {
    if (!valor) return null;

    const caminho = extrairCaminhoDoAvatar(valor);
    if (!caminho) {
        console.warn('[avatarSigning] Não foi possível extrair o caminho de:', valor);
        return null;
    }

    const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(caminho, VALIDADE_SEGUNDOS_AVATAR);

    if (error) {
        console.warn('[avatarSigning] Falha ao assinar avatar:', error.message);
        return null;
    }

    return data?.signedUrl ?? null;
};

/**
 * Faz o upload do avatar do usuário para o bucket 'avatars'.
 * 
 * REQUISITO DE CONTRATO (DT-108): o primeiro segmento do path é o auth.uid()
 * do dono (`<uid>/...`) — é isso que as policies do bucket avatars validam
 * (storage.objects: WITH CHECK auth.uid()::text = split_part(name, '/', 1)).
 * O bucket é privado, então o retorno é o PATH do objeto (não URL pública); a
 * exibição assina URL em tempo de render (obterUrlAssinadaAvatar).
 * 
 * @param userId - ID do usuário
 * @param file - Arquivo de imagem
 * @returns FetchResult com o path do objeto no bucket
 */
export async function uploadAvatar(userId: string, file: File): Promise<FetchResult<string>> {
    try {
        const fileExt = file.name.split('.').pop() || 'png';
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) {
            return { success: false, error: uploadError.message };
        }

        return { success: true, data: fileName };
    } catch (err) {
        return { success: false, error: 'Erro ao fazer upload da imagem' };
    }
}
