import { getAreaOfPolygon } from 'geolib';
import { GeoPoint } from './geoTypes';

/**
 * Calcula área em Hectares.
 * 1 Hectare = 10.000 m²
 */
export function calculatePolygonArea(coords: GeoPoint[]): number {
    if (!coords || coords.length < 3) return 0;

    // geolib espera array de objetos {latitude, longitude} ou {lat, lng}
    // Nossos GeoPoint já são {lat, lng}, compatível.
    const areaMeters = getAreaOfPolygon(coords);

    // Converte para hectares e ajusta casas decimais
    return Number((areaMeters / 10000).toFixed(4));
}
