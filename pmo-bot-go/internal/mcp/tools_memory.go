package mcp

import (
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"context"
	"fmt"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
)

var SalvarMemoriaProdutorDef = llm.FerramentaAgnostica{
	Name:        "SalvarMemoriaProdutor",
	Description: "Salva um fato importante sobre o produtor ou a sua fazenda na memória de longo prazo (ex: trator quebrou, transição orgânica iniciada, preferência de sementes). O LLM deve usar esta ferramenta sempre que detectar algo que deva ser lembrado no futuro.",
	Parameters: map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"pmo_id": map[string]interface{}{
				"type":        "string",
				"description": "UUID do PMO injetado no contexto.",
			},
			"phone_number": map[string]interface{}{
				"type":        "string",
				"description": "Telefone do produtor injetado no contexto.",
			},
			"fato": map[string]interface{}{
				"type":        "string",
				"description": "O fato a ser salvo na memória.",
			},
			"categoria": map[string]interface{}{
				"type":        "string",
				"description": "Categoria do fato (ex: cultura, infraestrutura, alerta_climatico, comportamento).",
			},
		},
		"required": []string{"pmo_id", "phone_number", "fato", "categoria"},
	},
}

func (s *Server) handleSalvarMemoria(ctx context.Context, args map[string]interface{}, profile *supabase.Profile) (interface{}, error) {
	// SECURE SESSION INJECTION — pmo_id from profile ONLY, never from args
	if profile == nil {
		return nil, fmt.Errorf("unauthorized: missing profile")
	}
	// SECURITY: use profile values directly, args["pmo_id"] is ignored
	pmoIDStr := fmt.Sprintf("%d", profile.PmoAtivoID)
	phone := profile.Telefone

	fato, ok := args["fato"].(string)
	if !ok {
		return nil, fmt.Errorf("argumento 'fato' faltando ou invalido")
	}
	categoria, ok := args["categoria"].(string)
	if !ok {
		return nil, fmt.Errorf("argumento 'categoria' faltando ou invalido")
	}

	if pmoIDStr == "0" || phone == "" {
		return nil, fmt.Errorf("contexto de sessão inválido: PMO ou telefone não configurados")
	}

	// Gera o embedding usando a lógica já existente no Supabase client
	embedding, err := s.supabase.GetEmbedding(fato, "PRODUCAO")
	if err != nil {
		return nil, fmt.Errorf("falha ao gerar embedding: %v", err)
	}

	// Salva na memória persistente
	err = s.supabase.SaveUserMemory(ctx, pmoIDStr, phone, fato, categoria, embedding)
	if err != nil {
		return nil, fmt.Errorf("falha ao salvar no banco: %v", err)
	}

	return fmt.Sprintf("Fato salvo com sucesso na memória persistente (Categoria: %s).", categoria), nil
}
