//go:build ignore

package main

import (
	"fmt"
	"log"

	"github.com/thebrunm97/pmo-bot-go/internal/weather"
)

func main() {
	// Testando a string que vem do banco de dados: "Uberlândia, MG"
	location := "Uberlândia, MG"
	data, err := weather.FetchWeather("", location)
	if err != nil {
		log.Fatalf("Erro: %v", err)
	}

	fmt.Printf("Sucesso! Temp Atual: %.1f°C\n", data.Current.TempC)
	for _, f := range data.Forecast.ForecastDay {
		fmt.Printf("Data: %s - Max: %.1f°C / Min: %.1f°C\n", f.Date, f.Day.MaxTempC, f.Day.MinTempC)
	}
}
