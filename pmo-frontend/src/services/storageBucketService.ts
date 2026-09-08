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

        return filePath;

    } catch (error) {
        console.error('Erro no uploadFileToBucket:', error);
        return null;
    }
}

/**
 * Validade da assinatura do anexo — mesma janela curta usada para avatar e
 * áudio de auditoria (DT-108/DT-105): a URL é gerada no momento de abrir o
 * anexo, não precisa sobreviver além disso.
 */
const VALIDADE_SEGUNDOS_ANEXO = 300;

/**
 * Extrai o path do objeto a partir do que está gravado em `path_arquivo`
 * (novo) ou `url_arquivo` (legado, URL pública completa de antes do bucket
 * virar privado — DT-111). Mesmo dois-formatos que o avatarSigning trata.
 */
const extrairCaminhoDoAnexo = (valor: string): string | null => {
    const limpo = valor.trim();

    if (!limpo.startsWith('http')) {
        return limpo.replace(/^\/+/, '') || null;
    }

    const marcador = '/anexos-pmos/';
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
 * Emite uma URL assinada de curta duração para abrir um anexo de PMO.
 * Aceita tanto o path novo quanto a URL pública legada.
 */
export const obterUrlAssinadaAnexo = async (
    valor: string | null | undefined,
): Promise<string | null> => {
    if (!valor) return null;

    const caminho = extrairCaminhoDoAnexo(valor);
    if (!caminho) {
        console.warn('[anexoSigning] Não foi possível extrair o caminho de:', valor);
        return null;
    }

    const { data, error } = await supabase.storage
        .from('anexos-pmos')
        .createSignedUrl(caminho, VALIDADE_SEGUNDOS_ANEXO);

    if (error) {
        console.warn('[anexoSigning] Falha ao assinar anexo:', error.message);
        return null;
    }

    return data?.signedUrl ?? null;
};
