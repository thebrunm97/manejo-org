export interface WeatherData {
    current: {
        temperature: number;
        humidity: number;
        code: number;
    };
    daily: {
        rainChance: number;
    };
}

/**
 * Busca dados climáticos da API Open-Meteo.
 * @param lat Latitude
 * @param lon Longitude
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=precipitation_probability_max&timezone=America%2FSao_Paulo`
        );

        if (!response.ok) {
            throw new Error('Falha na resposta da API de Clima');
        }

        const data = await response.json();

        // Mapeia para nosso formato interno limpo
        const current = data.current || {};
        const daily = data.daily || {};

        return {
            current: {
                temperature: Math.round(current.temperature_2m || 0),
                humidity: current.relative_humidity_2m || 0,
                code: current.weather_code || 0
            },
            daily: {
                rainChance: daily.precipitation_probability_max ? daily.precipitation_probability_max[0] : 0
            }
        };

    } catch (error) {
        console.error("Erro ao carregar clima:", error);
        return null;
    }
}
