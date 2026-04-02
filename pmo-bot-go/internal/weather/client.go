package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// Condition representa as condições climáticas (compatível com WeatherAPI para o frontend)
type Condition struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Code int    `json:"code,omitempty"`
}

// Current representa métricas atuais
type Current struct {
	TempC     float64   `json:"temp_c"`
	WindKph   float64   `json:"wind_kph"`
	Humidity  int       `json:"humidity"`
	Condition Condition `json:"condition"`
}

// Day representa métricas diárias (inclui bônus agrícolas)
type Day struct {
	MaxTempC          float64   `json:"maxtemp_c"`
	MinTempC          float64   `json:"mintemp_c"`
	AvgTempC          float64   `json:"avgtemp_c"`
	DailyChanceOfRain int       `json:"daily_chance_of_rain"`
	Condition         Condition `json:"condition"`
	// Bônus Agrícolas (salvos no JSONB para v2)
	Evapotranspiration float64 `json:"et0_evapotranspiration,omitempty"`
	UVIndex            float64 `json:"uv_index,omitempty"`
}

// ForecastDay representa a previsão de um único dia
type ForecastDay struct {
	Date string `json:"date"`
	Day  Day    `json:"day"`
}

// Forecast é um array de dias de previsão
type Forecast struct {
	ForecastDay []ForecastDay `json:"forecastday"`
}

// WeatherData representa a resposta unificada (mantém compatibilidade com frontend)
type WeatherData struct {
	Current  Current  `json:"current"`
	Forecast Forecast `json:"forecast"`
}

// OpenMeteoResponse mapeia a resposta bruta do Open-Meteo
type OpenMeteoResponse struct {
	Current struct {
		Temperature2m    float64 `json:"temperature_2m"`
		RelativeHumidity int     `json:"relative_humidity_2m"`
		WindSpeed10m     float64 `json:"wind_speed_10m"`
		WeatherCode      int     `json:"weather_code"`
	} `json:"current"`
	Daily struct {
		Time                       []string  `json:"time"`
		Temperature2mMax           []float64 `json:"temperature_2m_max"`
		Temperature2mMin           []float64 `json:"temperature_2m_min"`
		PrecipitationProbability   []int     `json:"precipitation_probability_max"`
		WeatherCode                []int     `json:"weather_code"`
		Et0FaoEvapotranspiration   []float64 `json:"et0_fao_evapotranspiration"`
		UvIndexMax                 []float64 `json:"uv_index_max"`
	} `json:"daily"`
}

// FetchWeather busca dados climáticos com retries e fallback para WeatherAPI
func FetchWeather(apiKey string, location string) (*WeatherData, error) {
	ctx := context.Background()

	// 1. Tentar Open-Meteo com Retry e Timeout Robusto
	data, err := fetchWeatherWithRetry(ctx, location)
	if err == nil {
		return data, nil
	}

	log.Printf("⚠️ [WeatherSync] Open-Meteo falhou após retries: %v", err)

	// 2. Fallback para WeatherAPI (se apiKey disponível)
	if apiKey != "" {
		log.Printf("🔄 [WeatherSync] Iniciando fallback para WeatherAPI...")
		return fetchWeatherLegacy(ctx, apiKey, location)
	}

	return nil, fmt.Errorf("clima indisponível (Open-Meteo falhou e sem API Key de fallback): %w", err)
}

func fetchWeatherWithRetry(ctx context.Context, location string) (*WeatherData, error) {
	const maxRetries = 3
	const baseDelay = 2 * time.Second

	parts := strings.Split(location, ",")
	if len(parts) < 2 {
		return nil, fmt.Errorf("localização inválida para Open-Meteo: %s", location)
	}
	lat := strings.TrimSpace(parts[0])
	lng := strings.TrimSpace(parts[1])

	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		data, err := doFetchOpenMeteo(ctx, lat, lng)
		if err == nil {
			if attempt > 1 {
				log.Printf("✅ [Open-Meteo] Sucesso na tentativa %d para %s", attempt, location)
			}
			return data, nil
		}

		lastErr = err
		log.Printf("⚠️ [Open-Meteo] Tentativa %d falhou (%s): %v", attempt, location, err)

		if attempt < maxRetries {
			delay := baseDelay * time.Duration(1<<(attempt-1))
			time.Sleep(delay)
		}
	}
	return nil, lastErr
}

func doFetchOpenMeteo(ctx context.Context, lat, lng string) (*WeatherData, error) {
	// Timeout MAIOR: 30s e Transport customizado para evitar IPv6/KeepAlives problemáticos em Docker
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			DisableKeepAlives: true,
			IdleConnTimeout:   90 * time.Second,
		},
	}

	apiURL := fmt.Sprintf("https://api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,et0_fao_evapotranspiration,uv_index_max&timezone=America/Sao_Paulo&forecast_days=3", lat, lng)

	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "PMO-Bot-Go/0.11.5")

	resp, err := client.Do(req)
	if err != nil {
		if urlErr, ok := err.(*url.Error); ok && urlErr.Timeout() {
			return nil, fmt.Errorf("timeout 30s: %w", err)
		}
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	var om OpenMeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&om); err != nil {
		return nil, err
	}

	// Conversão
	data := &WeatherData{}
	data.Current = Current{
		TempC:     om.Current.Temperature2m,
		Humidity:  om.Current.RelativeHumidity,
		WindKph:   om.Current.WindSpeed10m,
		Condition: mapWeatherCode(om.Current.WeatherCode),
	}

	for i := 0; i < len(om.Daily.Time); i++ {
		data.Forecast.ForecastDay = append(data.Forecast.ForecastDay, ForecastDay{
			Date: om.Daily.Time[i],
			Day: Day{
				MaxTempC:           om.Daily.Temperature2mMax[i],
				MinTempC:           om.Daily.Temperature2mMin[i],
				AvgTempC:           (om.Daily.Temperature2mMax[i] + om.Daily.Temperature2mMin[i]) / 2,
				DailyChanceOfRain:  om.Daily.PrecipitationProbability[i],
				Condition:          mapWeatherCode(om.Daily.WeatherCode[i]),
				Evapotranspiration: om.Daily.Et0FaoEvapotranspiration[i],
				UVIndex:            om.Daily.UvIndexMax[i],
			},
		})
	}

	return data, nil
}

func fetchWeatherLegacy(ctx context.Context, apiKey, location string) (*WeatherData, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	url := fmt.Sprintf("http://api.weatherapi.com/v1/forecast.json?key=%s&q=%s&days=3&aqi=no&alerts=no", apiKey, location)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var data WeatherData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, err
	}
	return &data, nil
}

// mapWeatherCode converte WMO Cloud Codes para Condição/Ícone compatível com WeatherAPI
func mapWeatherCode(code int) Condition {
	switch code {
	case 0:
		return Condition{Text: "Céu limpo", Icon: "//cdn.weatherapi.com/weather/64x64/day/113.png", Code: 1000}
	case 1, 2:
		return Condition{Text: "Parcialmente nublado", Icon: "//cdn.weatherapi.com/weather/64x64/day/116.png", Code: 1003}
	case 3:
		return Condition{Text: "Nublado", Icon: "//cdn.weatherapi.com/weather/64x64/day/119.png", Code: 1006}
	case 45, 48:
		return Condition{Text: "Nevoeiro", Icon: "//cdn.weatherapi.com/weather/64x64/day/143.png", Code: 1030}
	case 51, 53, 55:
		return Condition{Text: "Chuva leve/Chuvisco", Icon: "//cdn.weatherapi.com/weather/64x64/day/266.png", Code: 1153}
	case 61, 63, 65:
		return Condition{Text: "Chuva", Icon: "//cdn.weatherapi.com/weather/64x64/day/296.png", Code: 1183}
	case 80, 81, 82:
		return Condition{Text: "Pancadas de chuva", Icon: "//cdn.weatherapi.com/weather/64x64/day/353.png", Code: 1240}
	case 95:
		return Condition{Text: "Tempestade", Icon: "//cdn.weatherapi.com/weather/64x64/day/389.png", Code: 1276}
	case 96, 99:
		return Condition{Text: "Tempestade com granizo", Icon: "//cdn.weatherapi.com/weather/64x64/day/395.png", Code: 1279}
	default:
		return Condition{Text: "Nublado", Icon: "//cdn.weatherapi.com/weather/64x64/day/119.png", Code: 1006}
	}
}
