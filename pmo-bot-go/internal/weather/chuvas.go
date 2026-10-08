package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Início efetivo das chuvas — indicador para a sementeira de sequeiro.
//
// Em Moçambique (e no sul da África em geral) a 1ª época de sequeiro depende
// menos de uma data do calendário e mais de as chuvas "pegarem": semear após
// uma chuva isolada seguida de semanas secas perde a semente. Como não há
// tábua de risco climático (ZARC) por lá, este indicador complementa as
// janelas de referência de internal/zae.
//
// Critério (usado em agrometeorologia na África Austral, aqui simplificado):
//   - candidato a início: ≥ 20 mm acumulados em até 3 dias seguidos;
//   - falso início: depois do candidato, um período seco de ≥ 10 dias
//     seguidos (< 1 mm/dia) dentro dos 30 dias seguintes, contando a previsão.
// É sempre um INDICATIVO: dado de modelo (Open-Meteo), não estação local.

const (
	chuvaMinimaInicioMM  = 20.0
	diasJanelaInicio     = 3
	diaSecoMM            = 1.0
	diasSecosFalsoInicio = 10
	diasVigiaFalsoInicio = 30
	diasParaEstabelecer  = 10
)

// SituacaoChuvas é o resultado do indicador.
type SituacaoChuvas struct {
	// Status: "estabelecidas" | "inicio_recente" | "falso_inicio" | "ainda_nao".
	Status         string  `json:"status"`
	InicioProvavel string  `json:"inicio_provavel,omitempty"` // AAAA-MM-DD
	ChuvaUlt10dMM  float64 `json:"chuva_ultimos_10_dias_mm"`
	ChuvaUlt30dMM  float64 `json:"chuva_ultimos_30_dias_mm"`
	PrevisaoProx7d float64 `json:"chuva_prevista_7_dias_mm"`
	Criterio       string  `json:"criterio"`
	Fonte          string  `json:"fonte"`
}

const textoCriterio = "Início = pelo menos 20 mm em até 3 dias, sem 10 dias seguidos secos depois. Indicativo, a partir de dado de modelo (não estação local)."

// AvaliarInicioChuvas aplica o critério sobre a série diária. datas e mm têm o
// mesmo tamanho; hoje é o índice do dia atual (o que vem depois é previsão).
func AvaliarInicioChuvas(datas []string, mm []float64, hoje int) SituacaoChuvas {
	s := SituacaoChuvas{Criterio: textoCriterio, Fonte: "Open-Meteo (modelo meteorológico)"}
	if len(datas) != len(mm) || hoje < 0 || hoje >= len(mm) {
		s.Status = "ainda_nao"
		return s
	}

	for i := 0; i <= hoje; i++ {
		if hoje-i < 30 {
			s.ChuvaUlt30dMM += mm[i]
		}
		if hoje-i < 10 {
			s.ChuvaUlt10dMM += mm[i]
		}
	}
	for i := hoje + 1; i < len(mm); i++ {
		s.PrevisaoProx7d += mm[i]
	}

	s.Status = "ainda_nao"
	for i := 0; i <= hoje; i++ {
		// A janela começa num dia COM chuva: senão um dia seco antes da
		// chuvada viraria a "data de início".
		if mm[i] < diaSecoMM {
			continue
		}
		acumulado, fim := 0.0, -1
		for k := i; k < i+diasJanelaInicio && k <= hoje; k++ {
			acumulado += mm[k]
			if acumulado >= chuvaMinimaInicioMM {
				fim = k
				break
			}
		}
		if fim < 0 {
			continue
		}
		if periodoSeco(mm, fim+1, minInt(fim+diasVigiaFalsoInicio, len(mm)-1)) {
			s.Status = "falso_inicio"
			continue // procura um início válido mais adiante
		}
		s.InicioProvavel = datas[i]
		if hoje-fim >= diasParaEstabelecer {
			s.Status = "estabelecidas"
		} else {
			s.Status = "inicio_recente"
		}
		return s
	}
	return s
}

// periodoSeco diz se há diasSecosFalsoInicio dias seguidos < diaSecoMM em [de, ate].
func periodoSeco(mm []float64, de, ate int) bool {
	seguidos := 0
	for i := de; i <= ate && i < len(mm); i++ {
		if mm[i] < diaSecoMM {
			seguidos++
			if seguidos >= diasSecosFalsoInicio {
				return true
			}
		} else {
			seguidos = 0
		}
	}
	return false
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// InicioDasChuvas geocodifica o local DENTRO do país (ISO alfa-2) e avalia o
// início das chuvas com os últimos 30 dias observados + 7 de previsão.
func InicioDasChuvas(ctx context.Context, local, pais string) (*SituacaoChuvas, error) {
	cliente := &http.Client{Timeout: 20 * time.Second}

	geoURL := fmt.Sprintf("https://geocoding-api.open-meteo.com/v1/search?name=%s&count=1&language=pt&countryCode=%s",
		url.QueryEscape(local), url.QueryEscape(pais))
	var geo struct {
		Results []struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
		} `json:"results"`
	}
	if err := getJSON(ctx, cliente, geoURL, &geo); err != nil {
		return nil, fmt.Errorf("geocoding de %q (%s): %w", local, pais, err)
	}
	if len(geo.Results) == 0 {
		return nil, fmt.Errorf("local %q não encontrado no geocoding (%s)", local, pais)
	}

	serieURL := fmt.Sprintf("https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&daily=precipitation_sum&past_days=30&forecast_days=7&timezone=auto",
		geo.Results[0].Latitude, geo.Results[0].Longitude)
	var serie struct {
		Daily struct {
			Time []string   `json:"time"`
			Mm   []*float64 `json:"precipitation_sum"`
		} `json:"daily"`
	}
	if err := getJSON(ctx, cliente, serieURL, &serie); err != nil {
		return nil, fmt.Errorf("série de chuva: %w", err)
	}

	mm := make([]float64, len(serie.Daily.Mm))
	for i, v := range serie.Daily.Mm {
		if v != nil {
			mm[i] = *v
		}
	}
	// past_days=30 → os 30 primeiros são passado; o índice 30 é hoje.
	hoje := minInt(30, len(mm)-1)
	s := AvaliarInicioChuvas(serie.Daily.Time, mm, hoje)
	return &s, nil
}

func getJSON(ctx context.Context, c *http.Client, u string, destino interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(destino)
}
