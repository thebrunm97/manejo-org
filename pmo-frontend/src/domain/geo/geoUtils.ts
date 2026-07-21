import area from '@turf/area';
import { polygon } from '@turf/helpers';
import { GeoPoint } from './geoTypes';

/**
 * Calcula área em Hectares.
 * 1 Hectare = 10.000 m²
 */
export function calculatePolygonArea(coords: GeoPoint[]): number {
    if (!coords || coords.length < 3) return 0;

    // Turf espera GeoJSON [longitude, latitude] e anel fechado
    const ring = coords.map(c => [c.lng, c.lat]);
    
    // Fechar o polígono se não estiver fechado (primeira coordenada === última)
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([...first]);
    }

    try {
        const poly = polygon([ring]);
        const areaMeters = area(poly);
        return Number((areaMeters / 10000).toFixed(4));
    } catch (e) {
        console.error("Erro ao calcular área com Turf:", e);
        return 0;
    }
}
