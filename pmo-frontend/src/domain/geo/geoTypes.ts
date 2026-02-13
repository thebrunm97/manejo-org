export interface GeoPoint {
    lat: number;
    lng: number;
}

export interface PolygonData {
    coordinates: GeoPoint[]; // Array simples, desacoplado do Leaflet
    areaHectares: number;
}
