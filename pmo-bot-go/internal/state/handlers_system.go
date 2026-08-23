package state

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/history"
	"github.com/thebrunm97/pmo-bot-go/internal/ports"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func handleAguardandoFazenda(_ context.Context, body string, _ string, phone string, profile *supabase.Profile, _ bool, sbClient *supabase.Client, _ ports.MessageSender, _ ports.Synthesizer, historyManager *history.Manager, extraction map[string]interface{}, _ time.Time, _ string) (string, ProcessResult) {
	bodyTrim := strings.TrimSpace(body)

	optionsIface, ok := extraction["options"].([]interface{})
	if !ok {
		historyManager.ClearFSMState(phone)
		return "❌ Erro ao ler as opções de fazenda. Tente novamente.", ProcessResult{Success: false, Reason: "invalid_options"}
	}

	index, err := strconv.Atoi(bodyTrim)
	if err != nil || index < 1 || index > len(optionsIface) {
		return "❌ Por favor, responda apenas com o número da fazenda desejada.", ProcessResult{Success: false, Reason: "invalid_selection"}
	}

	selectedOption := optionsIface[index-1].(map[string]interface{})
	selectedID := int64(selectedOption["id"].(float64)) // JSON decodes numbers as float64
	selectedNome := selectedOption["nome"].(string)

	// We might also have propriedade_id
	var propID int64
	if p, ok := selectedOption["propriedade_id"].(float64); ok {
		propID = int64(p)
	}

	// Update active PMO in DB
	err = sbClient.UpdateActivePMO(profile.ID, selectedID)
	if err != nil {
		return "❌ Ocorreu um erro ao trocar de fazenda. Tente novamente mais tarde.", ProcessResult{Success: false, Reason: "update_failed"}
	}

	if propID > 0 {
		_ = sbClient.UpdateActivePropriedade(profile.ID, propID, &selectedID)
	}

	historyManager.ClearFSMState(phone)
	return fmt.Sprintf("✅ Fazenda alterada para: *%s*.", selectedNome), ProcessResult{Success: true, Reason: "fazenda_changed"}
}
