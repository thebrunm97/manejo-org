import { useState, useCallback } from 'react';
import { MediaAsset } from '../../domain/media/mediaTypes';
import { mediaPicker } from '../../services/media/WebMediaPicker';
import { uploadFileToBucket } from '../../services/storageBucketService';

export function useMediaManager() {
    const [currentAsset, setCurrentAsset] = useState<MediaAsset | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const selectImage = useCallback(async (source: 'camera' | 'gallery' = 'gallery') => {
        try {
            const asset = await mediaPicker.pickImage(source);
            if (asset) {
                setCurrentAsset(asset);
                setUploadError(null);
            }
        } catch (err) {
            console.error('Erro ao selecionar imagem:', err);
            setUploadError('Falha ao selecionar imagem.');
        }
    }, []);

    const selectDocument = useCallback(async () => {
        try {
            const asset = await mediaPicker.pickDocument();
            if (asset) {
                setCurrentAsset(asset);
                setUploadError(null);
            }
        } catch (err) {
            console.error('Erro ao selecionar documento:', err);
            setUploadError('Falha ao selecionar documento.');
        }
    }, []);

    const uploadAsset = useCallback(async (userId: string): Promise<string | null> => {
        if (!currentAsset) return null;

        setIsUploading(true);
        setUploadError(null);

        try {
            const publicUrl = await uploadFileToBucket(currentAsset, userId);

            if (!publicUrl) {
                throw new Error('Falha no upload (URL não gerada).');
            }

            return publicUrl;
        } catch (err: any) {
            console.error('Erro no uploadAsset:', err);
            setUploadError(err.message || 'Erro ao enviar arquivo.');
            return null;
        } finally {
            setIsUploading(false);
        }
    }, [currentAsset]);

    const clearAsset = useCallback(() => {
        setCurrentAsset(null);
        setUploadError(null);
    }, []);

    return {
        currentAsset,
        isUploading,
        uploadError,
        selectImage,
        selectDocument,
        uploadAsset,
        clearAsset
    };
}
