package mcp

import (
	"log"
	"context"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"fmt"
)

func (s *Server) handleCriarNovoTalhao(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	if profile == nil { return nil, fmt.Errorf("unauthorized: missing profile") }
	pmoID := profile.PmoAtivoID
	userID := profile.ID
	propID := profile.PropriedadeAtivaID
	_ = pmoID
	_ = userID
	_ = propID
	nome, ok := args["nome_talhao"].(string)
	if !ok {
		return nil, fmt.Errorf("nome_talhao é obrigatório")
	}

	areaHectares, err := parseArgToFloat(args["area_hectares"])
	if err != nil {
		return nil, fmt.Errorf("area_hectares é obrigatório e deve ser numérico: %w", err)
	}

	cultura, _ := args["cultura"].(string)

	// Estes valores são injetados pelo FSM por segurança
	var pmoIDPtr *int64
	if pmoID > 0 {
		val := int64(pmoID)
		pmoIDPtr = &val
	}

	propriedadeIDFloat := float64(propID)
	
	log.Printf("🏗️ [MCP-TOOL] Criando novo talhão '%s' para PMO %v na Propriedade %d", nome, pmoIDPtr, int64(propriedadeIDFloat))

	id, err := s.supabase.CriarTalhao(nome, areaHectares, cultura, pmoIDPtr, int64(propriedadeIDFloat), userID)
	if err != nil {
		return nil, fmt.Errorf("erro ao criar talhão: %w", err)
	}

	return fmt.Sprintf("Talhão '%s' criado com sucesso com ID %d. Você já pode visualizar e desenhar o polígono no painel web.", nome, id), nil
}

func (s *Server) handleCriarNovosCanteiros(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	if profile == nil { return nil, fmt.Errorf("unauthorized: missing profile") }
	pmoID := profile.PmoAtivoID
	userID := profile.ID
	propID := profile.PropriedadeAtivaID
	_ = pmoID
	_ = userID
	_ = propID
	talhaoIDFloat, err := parseArgToFloat(args["talhao_id"])
	if err != nil {
		return nil, fmt.Errorf("talhao_id é obrigatório e deve ser numérico: %w", err)
	}

	quantidadeFloat, err := parseArgToFloat(args["quantidade"])
	if err != nil {
		return nil, fmt.Errorf("quantidade é obrigatória e deve ser numérica: %w", err)
	}

	idInicialFloat, err := parseArgToFloat(args["identificador_inicial"])
	if err != nil {
		return nil, fmt.Errorf("identificador_inicial é obrigatório e deve ser numérico: %w", err)
	}

	log.Printf("🏗️ [MCP-TOOL] Criando %d canteiros para talhão %d", int(quantidadeFloat), int64(talhaoIDFloat))

	err = s.supabase.CriarCanteirosEmLote(int64(talhaoIDFloat), int(quantidadeFloat), int(idInicialFloat))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar canteiros em lote: %w", err)
	}

	return fmt.Sprintf("%d canteiros criados com sucesso para o talhão ID %d.", int(quantidadeFloat), int64(talhaoIDFloat)), nil
}

func (s *Server) handleCriarInfraestruturaFazenda(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	if profile == nil { return nil, fmt.Errorf("unauthorized: missing profile") }
	pmoID := profile.PmoAtivoID
	userID := profile.ID
	propID := profile.PropriedadeAtivaID
	_ = pmoID
	_ = userID
	_ = propID
	nome, ok := args["nome_talhao"].(string)
	if !ok {
		return nil, fmt.Errorf("nome_talhao é obrigatório")
	}

	areaHectares, err := parseArgToFloat(args["area_hectares"])
	if err != nil {
		return nil, fmt.Errorf("area_hectares é obrigatório e deve ser numérico: %w", err)
	}

	qtdCanteirosFloat, _ := parseArgToFloat(args["quantidade_canteiros"])
	cultura, _ := args["cultura"].(string)

	// Injeção de segurança do FSM
	var pmoIDPtr *int64
	if pmoID > 0 {
		val := int64(pmoID)
		pmoIDPtr = &val
	}
	propriedadeIDFloat := float64(propID)
	
	log.Printf("🏗️ [MCP-TOOL] Criando infraestrutura unificada para PMO %v na Propriedade %d: %s", pmoIDPtr, int64(propriedadeIDFloat), nome)

	res, err := s.supabase.CriarInfraestruturaCompleta(nome, areaHectares, cultura, pmoIDPtr, int64(propriedadeIDFloat), userID, int(qtdCanteirosFloat))
	if err != nil {
		return nil, fmt.Errorf("erro na infraestrutura unificada: %w", err)
	}

	return res, nil
}

func (s *Server) handleSelecionarFazenda(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	if profile == nil { return nil, fmt.Errorf("unauthorized: missing profile") }
	pmoID := profile.PmoAtivoID
	userID := profile.ID
	propID := profile.PropriedadeAtivaID
	_ = pmoID
	_ = userID
	_ = propID
	log.Printf("🚜 [MCP-TOOL] handleSelecionarFazenda Args: %+v", args)

	
		nome, _ := args["nome_propriedade"].(string)

	// Regra de Negócio: Verificar se a fazenda é CONVENCIONAL
	fazenda, err := s.supabase.FetchPropriedade(propID)
	if err != nil {
		log.Printf("⚠️ [MCP-TOOL] Erro ao buscar modalidade da fazenda %d: %v", propID, err)
	}

	var pmoIDPtr *int64
	feedbackExtra := ""
	if fazenda != nil && fazenda["modalidade"] == "CONVENCIONAL" {
		log.Printf("🚜 [MCP-TOOL] Fazenda CONVENCIONAL detectada. Forçando PMO para NULL.")
		pmoIDPtr = nil // NULL no Postgres
		feedbackExtra = " (Propriedade Convencional - PMO desativado)"
	} else if fazenda != nil {
		log.Printf("🚜 [MCP-TOOL] Fazenda ORGÂNICA/HÍBRIDA detectada. Mantendo PMO atual se existir.")
	}

	err = s.supabase.UpdateActivePropriedade(userID, propID, pmoIDPtr)
	if err != nil {
		return fmt.Sprintf("Erro ao trocar de fazenda: %v", err), nil
	}

	if nome == "" {
		nome = fmt.Sprintf("ID %d", propID)
	}

	return fmt.Sprintf("Fazenda '%s'%s selecionada com sucesso. Agora todas as suas atividades serão registradas nesta propriedade.", nome, feedbackExtra), nil
}

func (s *Server) handleSelecionarPMO(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	if profile == nil { return nil, fmt.Errorf("unauthorized: missing profile") }
	pmoID := profile.PmoAtivoID
	userID := profile.ID
	propID := profile.PropriedadeAtivaID
	_ = pmoID
	_ = userID
	_ = propID
	log.Printf("📅 [MCP-TOOL] handleSelecionarPMO Args: %+v", args)

	
		ano, _ := args["ano_safra"].(string)

	err := s.supabase.UpdateActivePMO(userID, pmoID)
	if err != nil {
		return fmt.Sprintf("Erro ao trocar de PMO: %v", err), nil
	}

	if ano == "" {
		ano = fmt.Sprintf("ID %d", pmoID)
	}

	return fmt.Sprintf("Plano de Manejo (PMO) '%s' selecionado com sucesso. Agora suas atividades e infraestruturas serão vinculadas a este plano.", ano), nil
}
