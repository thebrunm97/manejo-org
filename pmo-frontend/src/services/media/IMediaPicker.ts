import { MediaAsset } from "../../domain/media/mediaTypes";

export interface IMediaPicker {
    /**
     * Seleciona uma imagem da câmera ou galeria.
     */
    pickImage(source: 'camera' | 'gallery'): Promise<MediaAsset | null>;

    /**
     * Seleciona um documento (PDF, DOC, DOCX).
     */
    pickDocument(): Promise<MediaAsset | null>;
}
