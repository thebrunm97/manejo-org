package weather

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Condition represents weather conditions for current and forecasts
type Condition struct {
	Text string `json:"text"`
	Icon string `json:"icon"`
	Code int    `json:"code,omitempty"`
}

// Current represents current weather metrics
type Current struct {
	TempC     float64   `json:"temp_c"`
	WindKph   float64   `json:"wind_kph"`
	Humidity  int       `json:"humidity"`
	Condition Condition `json:"condition"`
}

// Day represents daily forecast metrics
type Day struct {
	MaxTempC          float64   `json:"maxtemp_c"`
	MinTempC          float64   `json:"mintemp_c"`
	AvgTempC          float64   `json:"avgtemp_c"`
	DailyChanceOfRain int       `json:"daily_chance_of_rain"`
	Condition         Condition `json:"condition"`
}

// ForecastDay represents a single day's forecast
type ForecastDay struct {
	Date string `json:"date"`
	Day  Day    `json:"day"`
}

// Forecast is an array of forecast days
type Forecast struct {
	ForecastDay []ForecastDay `json:"forecastday"`
}

// WeatherData represents the full API response from WeatherAPI
type WeatherData struct {
	Current  Current  `json:"current"`
	Forecast Forecast `json:"forecast"`
}

// FetchWeather gets the weather data (current + 3 days forecast) from WeatherAPI
func FetchWeather(apiKey string, location string) (*WeatherData, error) {
	// Base URL for forecast
	url := fmt.Sprintf("http://api.weatherapi.com/v1/forecast.json?key=%s&q=%s&days=3&aqi=no&alerts=no", apiKey, location)

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("weather API error: status code %d", resp.StatusCode)
	}

	var data WeatherData
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("failed to decode JSON response: %w", err)
	}

	return &data, nil
}
