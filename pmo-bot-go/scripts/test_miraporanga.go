package main

import (
	"fmt"
	"log"

	"github.com/thebrunm97/pmo-bot-go/internal/weather"
)

func main() {
	location := "Miraporanga"
	data, err := weather.FetchWeather("", location)
	if err != nil {
		log.Fatalf("Erro para %s: %v", location, err)
	}
	fmt.Printf("Sucesso para %s! Temp Atual: %.1f°C\n", location, data.Current.TempC)
}
