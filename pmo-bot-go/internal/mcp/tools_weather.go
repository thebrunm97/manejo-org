package mcp

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/thebrunm97/pmo-bot-go/internal/weather"
	"github.com/thebrunm97/pmo-bot-go/internal/zae"
)

// handleConsultarPrevisaoTempo processa a requisição de previsão do tempo.
// Recebe a localidade (ex: "São Paulo" ou "lat,lng") e consulta a API.
func (s *Server) handleConsultarPrevisaoTempo(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	propID := tenant.PropriedadeID

	log.Printf("🌦️ [MCP] handleConsultarPrevisaoTempo executado com args: %v", args)

	pais := s.paisDoTenant(tenant)
	pedirLocal := map[string]interface{}{
		"status":  "requires_user_input",
		"message": "Localização não encontrada no banco de dados. Instrua o usuário educadamente a informar para qual cidade e estado ele deseja a previsão do tempo.",
	}
	if pais == "MZ" {
		pedirLocal["message"] = "Localização da machamba não encontrada. Peça ao produtor, com educação, o distrito e a província (ex.: Boane, Maputo) para a previsão do tempo."
	}

	// Extrair cidade_informada (Opcional, se o usuário pediu especificamente)
	var localidade string
	localidadeDoCadastro := false
	if locInt, ok := args["cidade_informada"]; ok {
		localidade, _ = locInt.(string)
	}

	// Se não veio cidade_informada nos args, buscar da propriedade no Supabase
	if localidade == "" {
		if s.supabase == nil || propID == 0 {
			return pedirLocal, nil
		}
		loc, err := s.supabase.GetPropriedadeLocation(propID)
		if err != nil {
			// Não retorna um erro fatal, retorna instrução pro LLM
			return pedirLocal, nil
		}
		localidade = loc
		localidadeDoCadastro = true
		log.Printf("📍 [MCP] Localização obtida via Supabase: %s", localidade)
	}

	// Buscar dados do clima
	apiKey := os.Getenv("WEATHER_API_KEY")
	// Local vindo do cadastro: geocoding restrito ao país da propriedade. Um
	// local informado na conversa só é restrito se tiver forma de Moçambique.
	paisGeo := ""
	if localidadeDoCadastro {
		paisGeo = pais
	}
	if _, _, okMZ := zae.SepararDistritoProvincia(localidade); okMZ {
		paisGeo = "MZ"
	}
	data, err := weather.FetchWeatherNoPais(apiKey, localidade, paisGeo)
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
