package mcp

import (
	"context"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/zae"
)

// mensagemReferenciaMZ é a instrução ao LLM para toda janela de Moçambique.
// Mesma lógica do retorno "referencia_nao_oficial" do Brasil (plantioref): a
// forma da resposta precisa impedir que o produtor tome uma referência
// publicada por zoneamento oficial — que lá nem existe.
const mensagemReferenciaMZ = "ATENÇÃO — Moçambique NÃO tem zoneamento oficial de risco climático como o ZARC do Brasil. " +
	"Estas são janelas de sementeira de REFERÊNCIA do calendário agrícola da FAO, por zona agroecológica do IIAM. " +
	"Ao responder você é OBRIGADO a: (1) dizer que é uma referência publicada, não uma recomendação oficial nem validada por agrónomo local; " +
	"(2) citar a fonte e o ano; (3) usar as datas exatamente como vieram (dd/mm, podem atravessar a virada do ano) — " +
	"NÃO invente percentuais de risco, datas nem épocas que não vieram; " +
	"(4) se vier mais de uma zona, ou localizacao_aproximada=true, explicar que a zona depende de onde fica a machamba no distrito e mostrar cada opção. " +
	"As observações vêm em inglês: traduza só o essencial. Use o vocabulário de Moçambique (sementeira, machamba, 1ª e 2ª época). " +
	"Lembre que, no sequeiro, a 1ª época depende do início efetivo das chuvas: se vier inicio_das_chuvas, diga em uma frase se as chuvas " +
	"já se estabeleceram (estabelecidas), começaram há pouco (inicio_recente), tiveram falso início ou ainda não chegaram — como indicativo. Responda curto."

// mensagemVariedadesMZ orienta o uso de variedades_iiam. A ficha é o texto da
// fonte; os campos estruturados podem estar vazios (não extraídos).
const mensagemVariedadesMZ = "Se vier variedades_iiam: são variedades libertadas pelo IIAM (Catálogo 2011-2022). Cite no máximo 3 que " +
	"façam sentido para a pergunta, com o ciclo e o que a FICHA diz (use só o texto da ficha — não complete dado ausente) e a página. " +
	"Se houver nota_curadoria, mencione-a. "

// janelaMocambique responde a consulta de janela para uma machamba em
// Moçambique, a partir de internal/zae. Nunca devolve erro: falta de dado é um
// status com instrução, como no resto de tools_zarc.go.
func (s *Server) janelaMocambique(ctx context.Context, cultura, distrito, provincia string) map[string]interface{} {
	if s.zae == nil {
		return map[string]interface{}{
			"status":  "unavailable",
			"message": "A consulta de janela de sementeira para Moçambique não está disponível neste ambiente. Diga isso ao produtor e NÃO invente datas.",
		}
	}

	nomeProvincia := zae.Provincias[provincia]
	zonas, porProvincia, ok := s.zae.ResolverZonas(distrito, provincia)
	if !ok {
		return map[string]interface{}{
			"status": "requires_user_input",
			"message": fmt.Sprintf(
				"Não reconheci o distrito %q na província %s. Peça ao produtor para confirmar o distrito e a província da machamba.",
				distrito, nomeProvincia),
		}
	}

	aproximada := porProvincia
	var janelas []zae.Janela
	disponiveis := map[string]bool{}
	for _, z := range zonas {
		if z.Cobertura == "parcial" {
			aproximada = true
		}
		janelas = append(janelas, s.zae.Buscar(cultura, z.Zona)...)
		for _, c := range s.zae.CulturasDaZona(z.Zona) {
			disponiveis[c] = true
		}
	}

	base := map[string]interface{}{
		"pais":                       "Moçambique",
		"distrito":                   distrito,
		"provincia":                  nomeProvincia,
		"cultura":                    cultura,
		"zonas_agroecologicas":       zonas,
		"localizacao_aproximada":     aproximada,
		"zona_inferida_da_provincia": porProvincia,
	}

	// Variedades libertadas pelo IIAM para a cultura — vêm mesmo sem janela de
	// época (tomate, por exemplo, tem variedades no catálogo e não tem janela
	// na FAO): ajudam o produtor a escolher o que semear.
	if vs := s.zae.Variedades(cultura); len(vs) > 0 {
		base["variedades_iiam"] = vs
	}

	if len(janelas) == 0 {
		lista := make([]string, 0, len(disponiveis))
		for c := range disponiveis {
			lista = append(lista, c)
		}
		sort.Strings(lista)
		log.Printf("🌍 [MCP] ZAE/MZ sem dado para %q em %s (%s), zonas %v", cultura, distrito, provincia, zonas)
		base["status"] = "sem_dado"
		base["culturas_com_dado_na_zona"] = lista
		base["message"] = mensagemVariedadesMZ + "Não há janela de sementeira publicada para esta cultura nesta zona de Moçambique (a fonte, o calendário da FAO, " +
			"ainda cobre poucas culturas por zona). Diga isso ao produtor com honestidade, ofereça as culturas que têm dado se forem úteis " +
			"e sugira confirmar com os serviços distritais de extensão agrária. NÃO invente datas."
		return base
	}

	// Sequeiro de 1ª época depende de as chuvas "pegarem": anexa o indicador.
	// Falha de rede não derruba a resposta — só fica sem o indicador.
	if s.inicioChuvas != nil && temPrimeiraEpoca(janelas) {
		ctxChuva, cancel := context.WithTimeout(ctx, 15*time.Second)
		situacao, err := s.inicioChuvas(ctxChuva, distrito, "MZ")
		cancel()
		if err != nil {
			log.Printf("⚠️ [MCP] ZAE/MZ: indicador de chuvas indisponível para %s: %v", distrito, err)
		} else {
			base["inicio_das_chuvas"] = situacao
		}
	}

	log.Printf("🌍 [MCP] ZAE/MZ: %d janela(s) para %q em %s (%s)", len(janelas), cultura, distrito, provincia)
	base["status"] = "referencia_nao_oficial"
	base["janelas_referencia"] = janelas
	base["message"] = mensagemReferenciaMZ + " " + mensagemVariedadesMZ
	return base
}

func temPrimeiraEpoca(js []zae.Janela) bool {
	for _, j := range js {
		if j.Epoca == "1ª época" {
			return true
		}
	}
	return false
}

// paisDoTenant devolve o país (ISO alfa-2) da propriedade ativa do produtor.
// Sem propriedade, usa o DDI do telefone; sem nenhum dos dois, "" (sem filtro).
func (s *Server) paisDoTenant(tenant TenantCtx) string {
	if s.supabase != nil && tenant.PropriedadeID != 0 {
		if loc, err := s.supabase.GetPropriedadeLocalizacao(tenant.PropriedadeID); err == nil {
			if loc.Pais == "BR" && ddiMocambique(tenant.Telefone) {
				if _, ok := zae.ProvinciaISO(loc.UF); ok {
					return "MZ"
				}
			}
			return loc.Pais
		}
	}
	if ddiMocambique(tenant.Telefone) {
		return "MZ"
	}
	return ""
}

func ddiMocambique(telefone string) bool { return strings.HasPrefix(telefone, "258") }
