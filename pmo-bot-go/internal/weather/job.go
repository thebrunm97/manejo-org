package weather

import (
	"context"
	"log"
	"sync"
	"time"

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

func StartWeatherJob(ctx context.Context, sbClient *supabase.Client, apiKey string) {
	log.Println("🌤️ [WeatherJob] Executando na inicialização do serviço...")
	time.Sleep(10 * time.Second) // aguardar inicialização
	runWeatherJobSafe(ctx, sbClient, apiKey)

	ticker := time.NewTicker(3 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			runWeatherJobSafe(ctx, sbClient, apiKey)
		case <-ctx.Done():
			return
		}
	}
}

func runWeatherJobSafe(ctx context.Context, sbClient *supabase.Client, apiKey string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("❌ [WeatherJob] PANIC recuperado: %v", r)
		}
	}()
	RunWeatherCronJob(ctx, sbClient, apiKey)
}

func purgeOldWeatherData(ctx context.Context, sbClient *supabase.Client) {
	cutoffDate := time.Now().AddDate(0, 0, -7).Format("2006-01-02")
	
	log.Printf("🗑️ [WeatherJob] Purgando registros anteriores a %s...", cutoffDate)
	
	err := sbClient.DeleteOlderThan("pmo_clima", "created_at", cutoffDate)
	if err != nil {
		log.Printf("⚠️ [WeatherJob] Falha no purge (não crítico): %v", err)
		return
	}
	
	log.Printf("✅ [WeatherJob] Purge concluído")
}

func RunWeatherCronJob(ctx context.Context, sbClient *supabase.Client, apiKey string) {
	startTime := time.Now()
	log.Printf("🌤️ [WeatherJob] ===== INÍCIO ===== %s", startTime.Format("2006-01-02 15:04:05"))

	defer func() {
		elapsed := time.Since(startTime)
		log.Printf("🌤️ [WeatherJob] ===== FIM ===== duração: %v", elapsed)
	}()

	// 1. Fetch all PMOs
	pmoLocations, err := sbClient.FetchActivePMOsLocations()
	if err != nil {
		log.Printf("❌ Erro ao buscar localizações dos PMOs: %v", err)
		return
	}

	// 2. Group PMOs by Location to avoid redundant API calls
	locationsMap := make(map[string][]int64)
	for _, p := range pmoLocations {
		if p.Query != "" {
			locationsMap[p.Query] = append(locationsMap[p.Query], p.ID)
		} else {
			log.Printf("⚠️ [WeatherJob] PMO=%d ignorado na atualização (sem query válida)", p.ID)
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
			log.Printf("❌ [WeatherJob] Erro no Batch Insert do clima: %v", err)
		} else {
			log.Printf("✅ [WeatherJob] Clima atualizado com sucesso! (Cidades/Locais processados: %d | Total PMOs inseridos: %d)", successCount, len(batchInserts))
		}
	} else {
		log.Println("⚠️ [WeatherJob] Nenhum dado climático novo para inserir nesta rodada.")
	}

	log.Printf("📊 [WeatherJob] Resultado da extração: %d localidade(s) tratadas com sucesso.", successCount)

	// 6. Purge old records (retain 7 days)
	purgeOldWeatherData(ctx, sbClient)
}
