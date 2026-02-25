export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface PolygonData {
    coordinates: GeoPoint[]; // Array simples, desacoplado do Leaflet
    areaHectares: number;
}

export interface GeoJSONGeometry {
    type: string;
    coordinates: number[][][];
}

export interface Talhao {
    id: string;
    nome: string;
    tipo?: string;
    geometry?: string | GeoJSONGeometry;
    geometria?: GeoPoint[]; // For internal state/services
    cor?: string;
    area_total_m2?: number;
    area_m2?: number;
    area_ha?: number;
    area_hectares?: number;
    cultura?: string;
    ph_solo?: number;
    v_percent?: number;
    teor_argila?: number;
    pmo_id?: string;
    propriedade_id?: number;
    user_id?: string;
    canteiros?: any[];
}
