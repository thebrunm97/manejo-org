package jobs

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/whatsapp"
)

// StartPlantioReminderJob kicks off a ticker to scan for pending planting alerts.
func StartPlantioReminderJob(sbClient *supabase.Client, wpClient *whatsapp.Client) {
	log.Println("🌱 [Job-Plantio] Background worker started")

	// Usually daily, but let's use 12 hours to be safer for close deadlines
	ticker := time.NewTicker(12 * time.Hour)
	defer ticker.Stop()

	// Initial run
	runPlantioCheck(sbClient, wpClient)

	for range ticker.C {
		runPlantioCheck(sbClient, wpClient)
	}
}

func runPlantioCheck(sbClient *supabase.Client, wpClient *whatsapp.Client) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	alertas, err := sbClient.ObterAlertasPlantioPendentes(ctx)
	if err != nil {
		log.Printf("❌ [Job-Plantio] Error fetching alerts: %v", err)
		return
	}

	if len(alertas) == 0 {
		return
	}

	log.Printf("📢 [Job-Plantio] Processing %d pending alerts", len(alertas))

	for _, a := range alertas {
		id, _ := a["id"].(string)

		// PostgREST embedding structure extraction
		cotas, _ := a["cotas_produtores"].(map[string]interface{})
		profiles, _ := cotas["profiles"].(map[string]interface{})
		demandas, _ := cotas["demandas_coletivas"].(map[string]interface{})

		telefone, _ := profiles["telefone"].(string)
		quantidade, _ := cotas["quantidade_assumida"].(float64)
		cultura, _ := demandas["cultura"].(string)

		if telefone == "" || cultura == "" {
			log.Printf("⚠️ [Job-Plantio] Skipping alert %s: missing phone or crop data", id)
			continue
		}

		message := fmt.Sprintf("🌱 Olá! O seu Assistente Agrônomo passando para lembrar: Chegou a época ideal para iniciar o plantio dos seus *%.0fkg de %s* da cota da Cooperativa! Bom trabalho! 🚜", 
			quantidade, cultura)

		err := wpClient.SendMessage(telefone, message)
		if err != nil {
			log.Printf("❌ [Job-Plantio] Failed to send message to %s: %v", telefone, err)
			continue
		}

		err = sbClient.MarcarAlertaComoEnviado(ctx, id)
		if err != nil {
			log.Printf("⚠️ [Job-Plantio] Failed to update alert status for %s: %v", id, err)
		} else {
			log.Printf("✅ [Job-Plantio] Alert sent successfully to %s", telefone)
		}
	}
}
