import { useEffect, useState } from 'react';
import L from 'leaflet';

// SOLUÇÃO NUCLEAR V2: Força a ordem de execução dos side-effects do Leaflet Draw
export const SafeEditControl = (props: any) => {
    const [Control, setControl] = useState<any>(null);

    useEffect(() => {
        const initialize = async () => {
            try {
                // 1. Setup Global
                if (typeof window !== 'undefined') {
                    (window as any).L = L;
                }

                // 2. Import do CSS
                await import('leaflet-draw/dist/leaflet.draw.css');

                // 3. Import do SHIM/PLUGIN explicitamente antes do wrapper
                // Isso garante que L.Draw e L.Edit estão anexados ao objeto L global
                await import('../../leaflet-draw-shim');

                // 4. Pequeno delay para garantir propagação de side-effects em ambiente Vite HMR
                await new Promise(resolve => setTimeout(resolve, 100));

                // 5. Verificação de Sanidade: Só prossegue se o Leaflet Draw injetou o que precisamos
                if (!(window as any).L.Draw || !(window as any).L.Draw.Event) {
                    console.warn("Leaflet Draw ainda não está pronto, tentando carregar wrapper mesmo assim...");
                }

                // 6. Import dinâmico do wrapper que consome o L global
                const mod = await import('react-leaflet-draw');

                if (mod && mod.EditControl) {
                    setControl(() => mod.EditControl);
                }
            } catch (err) {
                console.error("Erro crítico ao inicializar SafeEditControl:", err);
            }
        };

        initialize();
    }, []);

    if (!Control) return null;

    const EditControl = Control;
    return <EditControl {...props} />;
};
