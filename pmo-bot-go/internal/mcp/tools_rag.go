package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/llm"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
)

func (s *Server) handleConsultarDadosFazenda(args map[string]interface{}) (interface{}, error) {
	pmoIDFloat, err := parseArgToFloat(args["pmo_id"])
	if err != nil {
		return nil, fmt.Errorf("pmo_id is required and must be numeric: %w", err)
	}
	pmoID := int64(pmoIDFloat)

	tabela, ok := args["tabela"].(string)
	if !ok {
		return nil, fmt.Errorf("tabela is required and must be a string")
	}

	log.Printf("📊 [MCP-TOOL] Consultando dados estruturados (%s) para PMO %d", tabela, pmoID)

	var data interface{}

	switch tabela {
	case "talhoes":
		data, err = s.supabase.FetchTalhoes(pmoID)
	case "canteiros":
		talhaoIDFloat, err := parseArgToFloat(args["talhao_id"])
		if err != nil {
			return nil, fmt.Errorf("talhao_id is required for canteiros table: %w", err)
		}
		data, err = s.supabase.FetchCanteiros(int64(talhaoIDFloat))
	case "caderno_recente":
		data, err = s.supabase.FetchCadernoRecentes(pmoID, 10)
	default:
		return nil, fmt.Errorf("tabela desconhecida: %s", tabela)
	}

	if err != nil {
		return nil, fmt.Errorf("erro ao buscar dados no Supabase: %w", err)
	}

	// Format as JSON string for the AI
	jsonBytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("erro ao formatar resposta: %w", err)
	}

	return string(jsonBytes), nil
}

func (s *Server) handleConsultarBaseConhecimento(args map[string]interface{}) (interface{}, error) {
	pmoIDFloat, err := parseArgToFloat(args["pmo_id"])
	if err != nil {
		return nil, fmt.Errorf("pmo_id is required and must be numeric: %w", err)
	}
	pmoID := int64(pmoIDFloat)

	pergunta, ok := args["pergunta"].(string)
	if !ok {
		return nil, fmt.Errorf("pergunta is required and must be a string")
	}

	// Optional category filter (e.g. "institucional", "academico", "movimentos_sociais")
	categoriaFiltro, _ := args["categoria_fonte"].(string)

	log.Printf("[MCP-TOOL] RAG query for PMO %d: %q (categoria_filtro=%q)", pmoID, pergunta, categoriaFiltro)

	// 1. Generate query embedding with asymmetric task prefix (gemini-embedding-2)
	embedding, err := s.embedder.GenerateQueryEmbedding(pergunta)
	if err != nil {
		return nil, fmt.Errorf("erro ao gerar embedding: %w", err)
	}

	// 2. Vector search in Supabase (threshold 0.55, top-K 6 to account for category filter)
	matches, err := s.supabase.MatchFarmDocuments(pmoID, embedding, 0.55, 6)
	if err != nil {
		return nil, fmt.Errorf("erro na busca vetorial: %w", err)
	}

	if len(matches) == 0 {
		return "Nenhuma informacao especifica encontrada na base de conhecimento para esta pergunta.", nil
	}

	// 2.5 META-RAG: Evaluate evidence chunks using CMM Judge
	var chunks []string
	for _, m := range matches {
		chunks = append(chunks, m.Content)
	}

	log.Printf("[META-RAG] Evaluating %d evidence chunks against query: %q", len(chunks), pergunta)
	evalCtx, evalCancel := context.WithTimeout(context.Background(), 20*time.Second)
	
	var evalResult llm.MetaRAGResult
	var evalErr error
	if s.llmProvider != nil {
		evalResult, evalErr = s.llmProvider.EvaluateEvidenceListwise(evalCtx, pergunta, chunks)
	} else {
		evalErr = fmt.Errorf("llmProvider not initialized on mcp.Server")
	}
	evalCancel()

	// Filter matches based on CMM Judge scores
	var filteredMatches []supabase.DocumentMatch

	if evalErr != nil {
		log.Printf("⚠️ [META-RAG] Juiz Agronômico falhou ou indisponível: %v. Aplicando FAIL-OPEN (repasse normal).", evalErr)
		filteredMatches = matches
	} else {
		evalMap := make(map[int]llm.EvidenceEvaluation)
		for _, ev := range evalResult.Evaluations {
			evalMap[ev.ChunkIndex] = ev
		}

		for i, m := range matches {
			ev, ok := evalMap[i]
			if !ok {
				// Default to strong relevance if missed by the LLM
				ev = llm.EvidenceEvaluation{
					ChunkIndex: i,
					Score:      5,
					Reasoning:  "Defaulting to strong relevance (not evaluated by judge)",
				}
			}

			switch ev.Score {
			case 4, 5:
				// Evidência forte: Repasse normal
				filteredMatches = append(filteredMatches, m)
			case 2, 3:
				// Evidência fraca/adaptável: Injetar alerta de extrapolação
				reasoning := strings.TrimSuffix(ev.Reasoning, ".")
				alerta := fmt.Sprintf("[ALERTA DE EXTRAPOLAÇÃO: O Juiz Agronômico avaliou esta evidência com nota %d. Motivo: %s. Adicione um aviso no início da sua resposta final para que o produtor não aplique essa técnica de forma cega]", ev.Score, reasoning)
				m.Content = alerta + "\n" + m.Content
				filteredMatches = append(filteredMatches, m)
			case 1:
				// Nota 1: Excluir chunk
				log.Printf("🗑️ [META-RAG] Chunk %d descartado (Nota 1). Documento: %s | Raciocínio: %s", i, m.DocumentName, ev.Reasoning)
			default:
				// Fallback: repasse normal
				filteredMatches = append(filteredMatches, m)
			}
		}
	}

	if len(filteredMatches) == 0 {
		return "Nenhuma informacao especifica encontrada na base de conhecimento para esta pergunta após filtragem de relevância.", nil
	}

	// 3. Format results, optionally filtering by categoria_fonte in the JSONB metadata
	var sb strings.Builder

	for _, m := range filteredMatches {
		// Category-filter: skip chunks that don't match the requested category
		if categoriaFiltro != "" {
			chunkCat, _ := m.Metadata["categoria_fonte"].(string)
			if chunkCat != categoriaFiltro {
				continue
			}
		}

		cleanName := m.DocumentName
		if idx := strings.LastIndex(cleanName, "."); idx > 0 {
			cleanName = cleanName[:idx]
		}
		cleanName = strings.ReplaceAll(cleanName, "_", " ")

		// Source label: include categoria_fonte so the LLM can cite provenance
		chunkCat, _ := m.Metadata["categoria_fonte"].(string)
		sourceLabel := cleanName
		if chunkCat != "" {
			sourceLabel = fmt.Sprintf("%s [%s]", cleanName, chunkCat)
		}

		if m.IsGlobal {
			sb.WriteString(fmt.Sprintf("De acordo com o material tecnico '%s':\n%s\n\n", sourceLabel, m.Content))
		} else {
			sb.WriteString(fmt.Sprintf("Baseado no seu documento interno '%s':\n%s\n\n", sourceLabel, m.Content))
		}
	}

	result := strings.TrimSpace(sb.String())
	if result == "" {
		return "Nenhum resultado encontrado para a categoria solicitada. Tente sem o filtro de categoria.", nil
	}

	return result, nil
}
