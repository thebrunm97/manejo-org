import { MediaAsset } from "../../domain/media/mediaTypes";
import { IMediaPicker } from "./IMediaPicker";

export class WebMediaPicker implements IMediaPicker {

    private createInput(accept: string, capture?: string): HTMLInputElement {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        if (capture) {
            input.capture = capture;
        }
        // input.style.display = 'none'; // Não precisa anexar ao DOM
        return input;
    }

    private handleFileSelection(input: HTMLInputElement, type: 'image' | 'document'): Promise<MediaAsset | null> {
        return new Promise((resolve) => {
            input.onchange = (event) => {
                const target = event.target as HTMLInputElement;
                const file = target.files?.[0];

                if (!file) {
                    resolve(null);
                    return;
                }

                const asset: MediaAsset = {
                    uri: URL.createObjectURL(file), // Preview URL
                    name: file.name,
                    type: type,
                    mimeType: file.type,
                    file: file // Web specific
                };

                resolve(asset);
            };

            input.oncancel = () => {
                resolve(null);
            }

            // Trigger selection
            input.click();
        });
    }

    async pickImage(source: 'camera' | 'gallery'): Promise<MediaAsset | null> {
        const accept = 'image/*';
        // Se for camera, tentamos forçar environment (traseira)
        // No desktop isso costuma abrir o file explorer igual, mas no mobile web abre camera
        const capture = source === 'camera' ? 'environment' : undefined;

        const input = this.createInput(accept, capture);
        return this.handleFileSelection(input, 'image');
    }

    async pickDocument(): Promise<MediaAsset | null> {
        const accept = '.pdf, .doc, .docx, application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const input = this.createInput(accept);
        return this.handleFileSelection(input, 'document');
    }
}

export const mediaPicker = new WebMediaPicker();
