import { supabase } from '../supabaseClient';
import { GeoPoint } from '../domain/geo/geoTypes';

export interface Talhao {
    id: string;
    pmo_id?: string;
    propriedade_id?: number; // FK para tabela propriedades
    nome: string;
    geometria: GeoPoint[]; // Mapeado de/para GeoJSON no banco
    area_hectares: number;
    cor?: string;
    cultura?: string;
    user_id?: string;
}

// Auxiliar para converter formato do Banco (GeoJSON) <-> App (GeoPoint[])
const convertGeoJsonToPoints = (geoJson: any): GeoPoint[] => {
    if (!geoJson || !geoJson.geometry || !geoJson.geometry.coordinates) return [];
    // GeoJSON Polygon coordinates: array de anéis. O primeiro é o externo.
    // [ [ [long, lat], [long, lat] ... ] ]
    const coords = geoJson.geometry.coordinates[0];
    if (!Array.isArray(coords)) return [];

    // Inverte [lng, lat] para { lat, lng }
    return coords.map((c: number[]) => ({
        lat: c[1],
        lng: c[0]
    }));
};

const convertPointsToGeoJson = (points: GeoPoint[]) => {
    if (!points || points.length === 0) return null;
    // Converte { lat, lng } para [lng, lat] (padrão GeoJSON)
    const coords = points.map(p => [p.lng, p.lat]);
    // Fecha o polígono se necessário
    if (coords.length > 0) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push(first);
        }
    }

    return {
        type: "Feature",
        properties: {},
        geometry: {
            type: "Polygon",
            coordinates: [coords]
        }
    };
};

export const talhaoService = {
    async fetchByPmo(pmoId: string): Promise<Talhao[]> {
        const { data, error } = await supabase
            .from('talhoes')
            .select('*')
            .eq('pmo_id', pmoId);

        if (error) throw new Error(error.message);
        if (!data) return [];

        return data.map((t: any) => ({
            id: t.id,
            pmo_id: t.pmo_id,
            propriedade_id: t.propriedade_id,
            nome: t.nome,
            geometria: t.geometry ? convertGeoJsonToPoints(t.geometry) : [],
            area_hectares: t.area_ha ?? t.area_total_m2 / 10000,
            cor: t.cor,
            cultura: t.cultura,
            user_id: t.user_id
        }));
    },

    async getTalhoesByPropriedade(propriedadeId: number): Promise<Talhao[]> {
        const { data, error } = await supabase
            .from('talhoes')
            .select('*')
            .eq('propriedade_id', propriedadeId);

        if (error) throw new Error(error.message);
        if (!data) return [];

        return data.map((t: any) => ({
            id: t.id,
            pmo_id: t.pmo_id,
            propriedade_id: t.propriedade_id,
            nome: t.nome,
            geometria: t.geometry ? convertGeoJsonToPoints(t.geometry) : [],
            area_hectares: t.area_ha ?? t.area_total_m2 / 10000,
            cor: t.cor,
            cultura: t.cultura,
            user_id: t.user_id
        }));
    },

    async create(talhao: Omit<Talhao, 'id'>): Promise<Talhao> {
        // Validação defensiva
        if (!talhao.propriedade_id) {
            console.warn('[talhaoService] Criando talhão sem propriedade_id - registro pode ficar órfão');
        }

        // Prepara payload para o banco (tabela talhoes)
        const payload: Record<string, unknown> = {
            nome: talhao.nome,
            geometry: convertPointsToGeoJson(talhao.geometria),
            area_ha: talhao.area_hectares,
            area_total_m2: talhao.area_hectares * 10000,
            cor: talhao.cor,
            cultura: talhao.cultura,
            user_id: talhao.user_id,
            tipo: 'produtivo'
        };

        // Adiciona FKs apenas se definidas
        if (talhao.pmo_id) payload.pmo_id = talhao.pmo_id;
        if (talhao.propriedade_id) payload.propriedade_id = talhao.propriedade_id;

        const { data, error } = await supabase
            .from('talhoes')
            .insert(payload)
            .select()
            .single();

        if (error) throw new Error(error.message);

        // Retorna no formato do dominio
        return {
            id: data.id,
            pmo_id: data.pmo_id,
            propriedade_id: data.propriedade_id,
            nome: data.nome,
            geometria: data.geometry ? convertGeoJsonToPoints(data.geometry) : [],
            area_hectares: data.area_ha ?? data.area_total_m2 / 10000,
            cor: data.cor,
            cultura: data.cultura,
            user_id: data.user_id
        };
    },

    async delete(id: string): Promise<void> {
        const { error } = await supabase
            .from('talhoes')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    }
};
