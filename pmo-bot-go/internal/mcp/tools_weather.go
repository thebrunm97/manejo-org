package mcp

import (
	"fmt"
	"log"
	"os"

	"github.com/thebrunm97/pmo-bot-go/internal/weather"
)

// handleConsultarPrevisaoTempo processa a requisição de previsão do tempo.
// Recebe a localidade (ex: "São Paulo" ou "lat,lng") e consulta a API.
func (s *Server) handleConsultarPrevisaoTempo(args map[string]interface{}) (interface{}, error) {
	log.Printf("🌦️ [MCP] handleConsultarPrevisaoTempo executado com args: %v", args)

	// Extrair propriedade_id (Obrigatório)
	propriedadeIDInterface, ok := args["propriedade_id"]
	if !ok {
		return nil, fmt.Errorf("parâmetro 'propriedade_id' é obrigatório")
	}
	propriedadeID, err := parseArgToFloat(propriedadeIDInterface)
	if err != nil {
		return nil, fmt.Errorf("parâmetro 'propriedade_id' inválido: %w", err)
	}

	// Extrair cidade_informada (Opcional, se o usuário pediu especificamente)
	var localidade string
	if locInt, ok := args["cidade_informada"]; ok {
		localidade, _ = locInt.(string)
	}

	// Se não veio cidade_informada nos args, buscar da propriedade no Supabase
	if localidade == "" {
		if s.supabase == nil {
			return map[string]interface{}{
				"status":  "requires_user_input",
				"message": "Localização não encontrada no banco de dados. Instrua o usuário educadamente a informar para qual cidade e estado ele deseja a previsão do tempo.",
			}, nil
		}
		loc, err := s.supabase.GetPropriedadeLocation(int64(propriedadeID))
		if err != nil {
			// Não retorna um erro fatal, retorna instrução pro LLM
			return map[string]interface{}{
				"status":  "requires_user_input",
				"message": "Localização não encontrada no banco de dados. Instrua o usuário educadamente a informar para qual cidade e estado ele deseja a previsão do tempo.",
			}, nil
		}
		localidade = loc
		log.Printf("📍 [MCP] Localização obtida via Supabase: %s", localidade)
	}

	// Buscar dados do clima
	apiKey := os.Getenv("WEATHER_API_KEY")
	data, err := weather.FetchWeather(apiKey, localidade)
	if err != nil {
		// Falhas da API ainda devem ser logadas e repassadas
		return nil, fmt.Errorf("erro ao buscar previsão do tempo: %w", err)
	}

	// Como formataremos focando 100% no WhatsApp, o LLM vai traduzir isso para o produtor.
	// Passamos os dados agrícolas (Evapotranspiração, UV) "cruamente" como o usuário solicitou (no objeto data).
	return map[string]interface{}{
		"mensagem":   fmt.Sprintf("Previsão do tempo obtida com sucesso para a localidade (%s). Formate a resposta de forma amigável com emojis (☀️, 🌧️, 🌡️) e seja conciso. Se houver índices como Evapotranspiração ou UV relevantes para o manejo agronômico atual do agricultor, mencione isso no contexto.", localidade),
		"localidade": localidade,
		"clima":      data,
	}, nil
}
