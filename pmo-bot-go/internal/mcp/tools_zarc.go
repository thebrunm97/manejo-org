package mcp

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/zae"
	"github.com/thebrunm97/pmo-bot-go/internal/zarc"
)

// handleConsultarJanelaPlantio responde "posso plantar X agora aqui?" com a
// tábua de risco oficial do ZARC (MAPA) — a mesma base que lastreia crédito
// rural e seguro agrícola, e por isso defensável numa auditoria de PMO.
//
// Quando o ZARC não zoneia a cultura — o caso mais comum do nosso público:
// tomate, alface, couve, cenoura e a maioria das hortaliças não têm tábua de
// risco climático — cai para internal/plantioref, uma tabela CURADA de
// literatura agronômica. Ver o doc daquele pacote para a fronteira entre as
// duas fontes; ela é estrutural, não só retórica, e o handler abaixo reforça
// isso no "status" e na "message" de cada retorno.
//
// Segue o contrato de tools_weather.go: quando falta informação, NÃO devolve
// erro. Devolve um mapa com "status" e uma instrução em "message" para o LLM
// conduzir a conversa. Erro de verdade fica reservado para falha de infra.
func (s *Server) handleConsultarJanelaPlantio(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	// Só é "unavailable" se NENHUMA das duas fontes existir. A referência não
	// depende do arquivo de ~400 MB do ZARC — só da UF — e por isso continua
	// disponível em staging e na máquina do desenvolvedor mesmo sem ele.
	if s.zarc == nil && s.plantioRef == nil && s.zae == nil {
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

	cidade, uf, pais, resposta := s.localizacaoParaZarc(args, tenant)
	if resposta != nil {
		return resposta, nil
	}

	// Moçambique não tem ZARC: vai para a tabela de referência por zona
	// agroecológica (tools_zae.go). O caminho do Brasil abaixo não muda.
	if pais == "MZ" {
		return s.janelaMocambique(ctx, cultura, cidade, uf), nil
	}
	if s.zarc == nil && s.plantioRef == nil {
		return map[string]interface{}{
			"status":  "unavailable",
			"message": "A consulta de janela de plantio não está disponível neste ambiente. Diga isso ao produtor e NÃO invente datas de plantio.",
		}, nil
	}

	var disponiveis []string

	if s.zarc != nil {
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

		if len(janelas) > 0 {
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

		// Caminho frequente e legítimo, não uma falha: o ZARC não cobre
		// tomate, alface, couve nem cenoura. Antes de desistir, tenta a
		// referência curada logo abaixo — culturas_zoneadas é reunido aqui
		// porque só existe enquanto há uma base ZARC para perguntar.
		var errCult error
		disponiveis, errCult = s.zarc.CulturasDisponiveis(ctx, geo)
		if errCult != nil {
			log.Printf("⚠️ [MCP] ZARC: falha ao listar culturas de %s: %v", geo, errCult)
		}
		log.Printf("🌱 [MCP] ZARC sem zoneamento para %q em %s (%s)", cultura, cidade, geo)
	}

	// Fallback: tabela curada de referência (não-oficial), para as culturas
	// que o ZARC não zoneia. Ver internal/plantioref.
	if refs := s.plantioRef.Buscar(cultura, uf); len(refs) > 0 {
		log.Printf("📗 [MCP] Referência (não-ZARC): %d janela(s) para %q em %s/%s",
			len(refs), cultura, cidade, uf)
		return map[string]interface{}{
			"status":             "referencia_nao_oficial",
			"cultura":            cultura,
			"municipio":          cidade,
			"uf":                 uf,
			"abrangencia":        refs[0].Abrangencia,
			"janelas_referencia": refs,
			"culturas_zoneadas":  disponiveis,
			"message": "ATENÇÃO — isto NÃO é o ZARC. O ZARC/MAPA não zoneia esta cultura, e o que segue é uma janela de REFERÊNCIA " +
				"da literatura agronômica: granularidade de MÊS, SEM risco climático percentual e SEM portaria. " +
				"Ao responder você é OBRIGADO a: (1) dizer com todas as letras que é uma orientação de referência, não a janela oficial; " +
				"(2) avisar que NÃO vale para crédito rural nem para seguro agrícola; " +
				"(3) citar a fonte e o ano de cada janela. " +
				"Use os meses exatamente como vieram — não converta em datas, não cite dias, não invente decêndios nem percentuais de risco. " +
				"Feche lembrando que a época ideal ainda depende do microclima e do histórico da propriedade.",
		}, nil
	}

	return map[string]interface{}{
		"status":                  "nao_zoneada",
		"cultura":                 cultura,
		"municipio":               cidade,
		"uf":                      uf,
		"culturas_zoneadas":       disponiveis,
		"culturas_com_referencia": s.plantioRef.Culturas(),
		"message": "O ZARC não zoneia esta cultura neste município, e também não há referência de literatura cadastrada para ela. " +
			"Explique ao produtor que não existe janela oficial de plantio, ofereça as culturas zoneadas ou com referência disponíveis " +
			"se forem úteis, e NÃO invente datas.",
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
func (s *Server) localizacaoParaZarc(args map[string]interface{}, tenant TenantCtx) (string, string, string, map[string]interface{}) {
	pedir := func(msg string) (string, string, string, map[string]interface{}) {
		return "", "", "", map[string]interface{}{"status": "requires_user_input", "message": msg}
	}

	if v, ok := args["cidade_informada"].(string); ok && strings.TrimSpace(v) != "" {
		// "Boane, Maputo" / "Chókwè - Gaza": província de Moçambique no fim.
		// Nenhuma província (nem código ISO) colide com UF brasileira.
		if distrito, prov, okMZ := zae.SepararDistritoProvincia(v); okMZ {
			return distrito, prov, "MZ", nil
		}
		cidade, uf := zarc.SepararCidadeUF(v)
		if uf == "" {
			return pedir(fmt.Sprintf(
				"O produtor informou %q sem o estado (ou, em Moçambique, sem a província). O ZARC precisa da UF porque há municípios com o mesmo nome em estados diferentes. Peça o estado — ou a província, se ele estiver em Moçambique.",
				v))
		}
		return cidade, uf, "BR", nil
	}

	if s.supabase == nil || tenant.PropriedadeID == 0 {
		return pedir("Localização não encontrada no cadastro. Pergunte ao produtor a cidade e o estado da propriedade (em Moçambique: distrito e província).")
	}

	loc, err := s.supabase.GetPropriedadeLocalizacao(tenant.PropriedadeID)
	if err != nil {
		log.Printf("⚠️ [MCP] ZARC: falha ao obter localização da propriedade %d: %v", tenant.PropriedadeID, err)
		return pedir("Localização não encontrada no cadastro. Pergunte ao produtor a cidade e o estado da propriedade (em Moçambique: distrito e província).")
	}

	pais := loc.Pais
	// Propriedade criada antes de existir o campo país (default BR), de um
	// produtor com DDI de Moçambique e província moçambicana no cadastro.
	if pais == "BR" && strings.HasPrefix(tenant.Telefone, "258") {
		if _, okProv := zae.ProvinciaISO(loc.UF); okProv {
			pais = "MZ"
		}
	}

	if pais == "MZ" {
		prov, okProv := zae.ProvinciaISO(loc.UF)
		if strings.TrimSpace(loc.Cidade) == "" || !okProv {
			return pedir("A machamba está cadastrada sem distrito ou província. Pergunte ao produtor o distrito e a província.")
		}
		return loc.Cidade, prov, "MZ", nil
	}

	if strings.TrimSpace(loc.Cidade) == "" || strings.TrimSpace(loc.UF) == "" {
		return pedir("A propriedade está cadastrada sem a cidade ou o estado. Peça ao produtor a cidade e o estado.")
	}
	return loc.Cidade, strings.ToUpper(strings.TrimSpace(loc.UF)), pais, nil
}
