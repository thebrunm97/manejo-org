package weather

import (
	"context"
	"log"
	"sync"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

type Job struct {
	Location string
	PmoIDs   []int64
}

type Result struct {
	Location string
	PmoIDs   []int64
	Data     *WeatherData
	Err      error
}

func RunWeatherCronJob(ctx context.Context, sbClient *supabase.Client, apiKey string) {
	log.Println("🌦️ Iniciando rotina de atualização meteorológica via Worker Pool (AgTech Pro)...")

	// 1. Fetch all PMOs
	pmoLocations, err := sbClient.FetchActivePMOsLocations()
	if err != nil {
		log.Printf("❌ Erro ao buscar localizações dos PMOs: %v", err)
		return
	}

	// 2. Group PMOs by Location to avoid redundant API calls
	locationsMap := make(map[string][]int64)
	for _, p := range pmoLocations {
		var locStr string
		if p.Latitude != "" && p.Longitude != "" {
			locStr = p.Latitude + "," + p.Longitude
		} else if p.City != "" {
			locStr = p.City
		}

		if locStr != "" {
			locationsMap[locStr] = append(locationsMap[locStr], p.ID)
		}
	}

	if len(locationsMap) == 0 {
		log.Println("Nenhum PMO válido para buscar clima.")
		return
	}

	jobs := make(chan Job, len(locationsMap))
	results := make(chan Result, len(locationsMap))

	// 3. Setup Worker Pool
	numWorkers := 5
	var wg sync.WaitGroup

	for w := 1; w <= numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for job := range jobs {
				data, err := FetchWeather(apiKey, job.Location)
				results <- Result{
					Location: job.Location,
					PmoIDs:   job.PmoIDs,
					Data:     data,
					Err:      err,
				}
			}
		}(w)
	}

	// Queue the jobs
	for loc, ids := range locationsMap {
		jobs <- Job{Location: loc, PmoIDs: ids}
	}
	close(jobs)

	// Wait and close results
	go func() {
		wg.Wait()
		close(results)
	}()

	// 4. Collect results and prepare Batch Insert
	var batchInserts []supabase.PmoClimaInsert
	successCount := 0

	for res := range results {
		if res.Err != nil {
			log.Printf("⚠️ Falha ao buscar clima para %s: %v", res.Location, res.Err)
			continue
		}

		successCount++
		for _, pmoID := range res.PmoIDs {
			batchInserts = append(batchInserts, supabase.PmoClimaInsert{
				PmoID:         pmoID,
				TemperaturaC:  res.Data.Current.TempC,
				Umidade:       res.Data.Current.Humidity,
				VentoKph:      res.Data.Current.WindKph,
				CondicaoTexto: res.Data.Current.Condition.Text,
				CondicaoIcone: res.Data.Current.Condition.Icon,
				PrevisaoDias:  res.Data.Forecast.ForecastDay,
			})
		}
	}

	// 5. Execute Batch Insert
	if len(batchInserts) > 0 {
		err := sbClient.SaveWeatherDataBatch(batchInserts)
		if err != nil {
			log.Printf("❌ Erro no Batch Insert do clima: %v", err)
		} else {
			log.Printf("✅ Clima atualizado com sucesso! (Cidades: %d | Total PMOs: %d)", successCount, len(batchInserts))
		}
	} else {
		log.Println("Nenhum dado climático novo para inserir nesta rodada.")
	}
}
