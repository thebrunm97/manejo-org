package mcp

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/zarc"
)

// handleConsultarJanelaPlantio responde "posso plantar X agora aqui?" com a
// tábua de risco oficial do ZARC (MAPA) — a mesma base que lastreia crédito
// rural e seguro agrícola, e por isso defensável numa auditoria de PMO.
//
// Segue o contrato de tools_weather.go: quando falta informação, NÃO devolve
// erro. Devolve um mapa com "status" e uma instrução em "message" para o LLM
// conduzir a conversa. Erro de verdade fica reservado para falha de infra.
func (s *Server) handleConsultarJanelaPlantio(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	if s.zarc == nil {
		return map[string]interface{}{
			"status":  "unavailable",
			"message": "A consulta de janela de plantio não está disponível neste ambiente. Diga isso ao produtor e NÃO invente datas de plantio.",
		}, nil
	}

	cultura, _ := args["cultura"].(string)
	if strings.TrimSpace(cultura) == "" {
		return map[string]interface{}{
			"status":  "requires_user_input",
			"message": "Pergunte ao produtor qual cultura ele pretende plantar.",
		}, nil
	}

	log.Printf("🌱 [MCP] handleConsultarJanelaPlantio executado com args: %v", args)

	cidade, uf, resposta := s.localizacaoParaZarc(args, tenant)
	if resposta != nil {
		return resposta, nil
	}

	inicio := time.Now()
	geo, err := s.zarc.ResolverMunicipio(ctx, cidade, uf)
	if err != nil {
		return nil, fmt.Errorf("erro ao resolver município no ZARC: %w", err)
	}
	if geo == "" {
		return map[string]interface{}{
			"status": "requires_user_input",
			"message": fmt.Sprintf(
				"Não reconheci o município %q (%s) na base do ZARC. Peça ao produtor para confirmar a cidade e o estado.",
				cidade, uf),
		}, nil
	}

	janelas, err := s.zarc.BuscarJanelas(ctx, geo, cultura)
	if err != nil {
		return nil, fmt.Errorf("erro ao consultar ZARC: %w", err)
	}

	// Caminho frequente e legítimo, não uma falha: o ZARC cobre cebola, alho,
	// batata, mandioca, banana e citros, mas NÃO cobre tomate, alface, couve
	// nem cenoura — que estão entre as culturas mais comuns do nosso público.
	// O retorno é estruturado para que, no futuro, encaminhar ao RAG de
	// literatura não exija mudar a assinatura desta ferramenta.
	if len(janelas) == 0 {
		disponiveis, errCult := s.zarc.CulturasDisponiveis(ctx, geo)
		if errCult != nil {
			log.Printf("⚠️ [MCP] ZARC: falha ao listar culturas de %s: %v", geo, errCult)
		}
		log.Printf("🌱 [MCP] ZARC sem zoneamento para %q em %s (%s)", cultura, cidade, geo)
		return map[string]interface{}{
			"status":            "nao_zoneada",
			"cultura":           cultura,
			"municipio":         cidade,
			"uf":                uf,
			"culturas_zoneadas": disponiveis,
			"message": "O ZARC não zoneia esta cultura neste município. Explique ao produtor que não existe janela oficial de plantio para ela, " +
				"ofereça as culturas zoneadas disponíveis se forem úteis, e NÃO invente datas.",
		}, nil
	}

	log.Printf("🌱 [MCP] ZARC: %d janelas para %q em %s (%s) em %s",
		len(janelas), cultura, cidade, geo, time.Since(inicio))

	return map[string]interface{}{
		"status":    "ok",
		"municipio": cidade,
		"uf":        uf,
		"cultura":   cultura,
		"janelas":   janelas,
		"mensagem": "Janelas de plantio oficiais do ZARC/MAPA. Formate para WhatsApp de forma curta: os períodos e o risco de cada um " +
			"(20% é o mais seguro, 40% o mais arriscado). Cite a Portaria como fonte — é o que dá valor de auditoria ao dado. " +
			"Os períodos são do ano civil e podem atravessar a virada do ano.",
	}, nil
}

// localizacaoParaZarc resolve cidade e UF para a consulta.
//
// Regra do DT-67, a mesma do balanço financeiro: a propriedade vem da SESSÃO,
// nunca dos argumentos do LLM. "cidade_informada" existe só para o caso em que
// o produtor pergunta explicitamente sobre outro município — exatamente como na
// ferramenta de clima. Um valor de tenant vindo dos args seria alucinação, e a
// consulta correria com a service_role key, que ignora RLS.
//
// Devolve um terceiro valor não-nulo quando não deu para resolver: nesse caso é
// esse mapa que deve ser retornado ao LLM, sem erro.
func (s *Server) localizacaoParaZarc(args map[string]interface{}, tenant TenantCtx) (string, string, map[string]interface{}) {
	if v, ok := args["cidade_informada"].(string); ok && strings.TrimSpace(v) != "" {
		cidade, uf := zarc.SepararCidadeUF(v)
		if uf == "" {
			return "", "", map[string]interface{}{
				"status": "requires_user_input",
				"message": fmt.Sprintf(
					"O produtor informou %q sem o estado. O ZARC precisa da UF porque há municípios com o mesmo nome em estados diferentes. Peça o estado.",
					v),
			}
		}
		return cidade, uf, nil
	}

	if s.supabase == nil || tenant.PropriedadeID == 0 {
		return "", "", map[string]interface{}{
			"status":  "requires_user_input",
			"message": "Localização não encontrada no cadastro. Pergunte ao produtor a cidade e o estado da propriedade.",
		}
	}

	loc, err := s.supabase.GetPropriedadeLocation(tenant.PropriedadeID)
	if err != nil {
		log.Printf("⚠️ [MCP] ZARC: falha ao obter localização da propriedade %d: %v", tenant.PropriedadeID, err)
		return "", "", map[string]interface{}{
			"status":  "requires_user_input",
			"message": "Localização não encontrada no cadastro. Pergunte ao produtor a cidade e o estado da propriedade.",
		}
	}

	cidade, uf := zarc.SepararCidadeUF(loc)
	if uf == "" {
		return "", "", map[string]interface{}{
			"status":  "requires_user_input",
			"message": "A propriedade está cadastrada sem o estado. Peça ao produtor a cidade e o estado.",
		}
	}
	return cidade, uf, nil
}
