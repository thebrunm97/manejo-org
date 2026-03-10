import { useEffect, useState } from 'react';
import L from 'leaflet';

// Importante: Não importar EditControl diretamente aqui.
// Este wrapper cuida do carregamento dinâmico para evitar race conditions no Vite.

export const SafeEditControl = (props: any) => {
    const [Control, setControl] = useState<any>(null);

    useEffect(() => {
        // 1. Garante que o Leaflet Global está disponível
        if (typeof window !== 'undefined') {
            (window as any).L = L;
        }

        // 2. Importa o CSS do Leaflet Draw (pode ser redundante mas garante estilo)
        import('leaflet-draw/dist/leaflet.draw.css');

        // 3. Importa o componente dinamicamente apenas após o Leaflet estar pronto
        const loadDraw = async () => {
            try {
                // Forçamos a espera pela injeção global e garantimos que o Leaflet está completo
                const mod = await import('react-leaflet-draw');
                if (mod && mod.EditControl) {
                    setControl(() => mod.EditControl);
                }
            } catch (err) {
                console.error("Erro ao carregar react-leaflet-draw dinamicamente:", err);
            }
        };

        loadDraw();
    }, []);

    if (!Control) return null;

    const EditControl = Control;
    return <EditControl {...props} />;
};
