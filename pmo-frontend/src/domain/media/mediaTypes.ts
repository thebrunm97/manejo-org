export interface MediaAsset {
    uri: string;        // URL de preview (blob:)
    name: string;
    type: 'image' | 'document';
    mimeType: string;
    file?: File;        // Opcional: Apenas para Web
}
