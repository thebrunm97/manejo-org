import { supabase } from '../supabaseClient';

export interface WeatherData {
    current: {
        temperature: number;
        humidity: number;
        windKph: number;
        conditionText: string;
        conditionIcon: string;
    };
    forecast: any[]; // JSONB content from WeatherAPI mapped closely
}

/**
 * Busca dados climáticos da base do AgTech Pro (preenchidos via cron no Go).
 * @param pmoId ID do PMO logado
 */
export async function getCurrentWeather(pmoId: string): Promise<WeatherData | null> {
    try {
        const { data, error } = await supabase
            .from('pmo_clima')
            .select('*')
            .eq('pmo_id', pmoId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) return null;

        return {
            current: {
                temperature: Number(data.temperatura_c) || 0,
                humidity: Number(data.umidade) || 0,
                windKph: Number(data.vento_kph) || 0,
                conditionText: data.condicao_texto || "Desconhecido",
                conditionIcon: data.condicao_icone ? `https:${data.condicao_icone}` : "",
            },
            forecast: data.previsao_dias || []
        };
    } catch (error) {
        console.error("Erro ao carregar clima do banco AgTech:", error);
        return null;
    }
}
