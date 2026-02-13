import { supabase } from '../supabaseClient';
import { MediaAsset } from '../domain/media/mediaTypes';

/**
 * Faz upload de um MediaAsset para o bucket 'anexos-pmos'.
 * @param asset O ativo de mídia (imagem ou documento).
 * @param userId O ID do usuário (usado para montar o caminho).
 * @returns A URL pública do arquivo ou null em caso de erro.
 */
export async function uploadFileToBucket(asset: MediaAsset, userId: string): Promise<string | null> {
    try {
        const fileExt = asset.name.split('.').pop();
        const fileNameOnStorage = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${userId}/${fileNameOnStorage}`;

        // Lógica Híbrida
        if (asset.file) {
            // WEB: Upload direto usando o objeto File
            const { error: uploadError } = await supabase.storage
                .from('anexos-pmos')
                .upload(filePath, asset.file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: asset.mimeType,
                });

            if (uploadError) throw uploadError;
        } else {
            // MOBILE / NATIVE (Futuro)
            // TODO: Handle ArrayBuffer/FormData for native platform
            console.warn('Upload nativo ainda não implementado. Asset sem objeto File.');
            throw new Error('Upload nativo não suportado nesta versão Web.');
        }

        // Obter URL Pública
        const { data } = supabase.storage
            .from('anexos-pmos')
            .getPublicUrl(filePath);

        return data.publicUrl;

    } catch (error) {
        console.error('Erro no uploadFileToBucket:', error);
        return null;
    }
}
