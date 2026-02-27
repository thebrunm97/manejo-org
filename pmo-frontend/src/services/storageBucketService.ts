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

        // Lógica Híbrida: Web envia `File`, Mobile envia `uri`
        let fileBody: File | Blob;

        if (asset.file) {
            // WEB: Upload direto usando o objeto File
            fileBody = asset.file;
        } else if (asset.uri) {
            // MOBILE / NATIVE
            // A URI pode ser um caminho local ou base64. O fetch resolve ambas para um Blob na maioria dos ambientes.
            try {
                const response = await fetch(asset.uri);
                fileBody = await response.blob();
            } catch (err) {
                console.error('Falha ao converter URI para Blob nativamente:', err);
                throw new Error('Falha ao processar o arquivo para upload nativo.');
            }
        } else {
            throw new Error('Asset não possui file ou uri válido para upload.');
        }

        const { error: uploadError } = await supabase.storage
            .from('anexos-pmos')
            .upload(filePath, fileBody, {
                cacheControl: '3600',
                upsert: false,
                contentType: asset.mimeType,
            });

        if (uploadError) throw uploadError;

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
