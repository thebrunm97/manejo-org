import L from 'leaflet';

// 1. SHIM SÍNCRONO: Injetar L no window antes de qualquer outro import
if (typeof window !== 'undefined') {
    (window as any).L = L;
}

// 2. Importar o núcleo do desenho e o CSS
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

// 3. Importar o componente React
import { EditControl } from 'react-leaflet-draw';

export const SafeEditControl = (props: any) => {
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
