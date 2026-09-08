package mcp

import (
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
			// pmo_id/phone_number removidos do schema (DT-67): o handler
			// sempre usou o TenantCtx da sessão para esses dois valores,
			// nunca os args — declará-los como obrigatórios aqui só fazia o
			// LLM gastar esforço preenchendo algo que era descartado.
			"fato": map[string]interface{}{
				"type":        "string",
				"description": "O fato a ser salvo na memória.",
			},
			"categoria": map[string]interface{}{
				"type":        "string",
				"description": "Categoria do fato (ex: cultura, infraestrutura, alerta_climatico, comportamento).",
			},
		},
		"required": []string{"fato", "categoria"},
	},
}

func (s *Server) handleSalvarMemoria(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	// SECURITY: pmo_id e telefone sempre do TenantCtx, nunca dos args (DT-67)
	pmoIDStr := fmt.Sprintf("%d", tenant.PmoID)
	phone := tenant.Telefone

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
