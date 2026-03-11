import { useEffect, useState } from 'react';
import L from 'leaflet';

export const SafeEditControl = (props: any) => {
    const [Control, setControl] = useState<any>(null);

    useEffect(() => {
        // 1. Injetar Leaflet Global
        (window as any).L = L;

        // 2. IMPORTANTE: Carregar a lógica de desenho JS e o CSS
        // Sem 'leaflet-draw', o L.Draw fica undefined e causa o erro de 'Event'
        import('leaflet-draw');
        import('leaflet-draw/dist/leaflet.draw.css');

        // 3. Carregar o wrapper React dinamicamente
        import('react-leaflet-draw').then((mod) => {
            setControl(() => mod.EditControl);
        });
    }, []);

    if (!Control) return null;
    const EditControl = Control;

    // Garante que retângulo e polígono estão ativos se não passados via props
    return (
        <EditControl
            {...props}
            draw={{
                rectangle: props.draw?.rectangle ?? true,
                polygon: props.draw?.polygon ?? true,
                circle: props.draw?.circle ?? false,
                circlemarker: props.draw?.circlemarker ?? false,
                marker: props.draw?.marker ?? true,
                polyline: props.draw?.polyline ?? false,
            }}
        />
    );
};
