package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

// handleSugerirCulturaPlano deixa uma cultura planejada como sugestão na
// Seção 2.1 do plano de manejo. Não grava no plano: o produtor vê a caixinha
// "Sugestão do Assistente" no app (BotSuggestionsPanel) e escolhe adicionar
// ou ignorar. O formato de json_extraido é o que esse painel e o
// SuggestionRefinementDialog leem.
func (s *Server) handleSugerirCulturaPlano(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	produto := sanitize(args["cultura"])
	if produto == "" {
		return pedirAoProdutor("Pergunte qual cultura o produtor quer incluir no plano."), nil
	}
	sugestao := map[string]interface{}{
		"secao_pmo":             2,
		"produto":               produto,
		"talhao_canteiro":       sanitize(args["talhao"]),
		"area_plantada_unidade": "m²",
		"unidade_producao":      "kg",
	}
	if v, _ := parseArgToFloat(args["area"]); v > 0 {
		sugestao["area_plantada"] = v
	}
	if u := sanitize(args["area_unidade"]); u != "" {
		sugestao["area_plantada_unidade"] = u
	}
	if v, _ := parseArgToFloat(args["producao_esperada"]); v > 0 {
		sugestao["producao_anual"] = v
	}
	if u := sanitize(args["producao_unidade"]); u != "" {
		sugestao["unidade_producao"] = u
	}

	texto := sanitize(args["texto_produtor"])
	if texto == "" {
		texto = "Incluir " + produto + " no plano de manejo"
	}
	var pmo *int64
	if tenant.PmoID > 0 {
		pmo = &tenant.PmoID
	}
	err := s.supabase.InsertLogTreinamento(supabase.LogTreinamentoInsert{
		PmoID:         pmo,
		UserID:        tenant.UserID,
		TextoUsuario:  texto,
		JsonExtraido:  sugestao,
		TipoAtividade: "planejamento",
		ModeloIA:      "bot",
	})
	if err != nil {
		return nil, fmt.Errorf("não consegui guardar a sugestão: %w", err)
	}

	onde := "na Seção 2 do plano de manejo, no app"
	if ehMZ(tenant.Telefone) {
		onde = "no seu plano de manejo"
	}
	return map[string]interface{}{
		"status": "success",
		"message": fmt.Sprintf("Sugestão de %s guardada %s; o produtor confirma ou recusa lá (botões Adicionar/Ignorar). Diga isso em uma frase curta. Não é registo de plantio.",
			strings.ToLower(produto), onde),
	}, nil
}
