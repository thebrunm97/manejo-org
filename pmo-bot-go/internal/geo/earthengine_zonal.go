package geo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"text/template"
)

// AST para estatística zonal: compõe a mediana de NDVI do período e reduz pela
// geometria do talhão, devolvendo a média dos pixels.
//
// A diferença para ndviASTTemplate é onde a cadeia termina: lá o NDVI vira
// imagem colorida (Image.visualize) para virar tile; aqui ele para na banda
// NDVI crua, porque visualizar converte para RGB de 8 bits e a média sairia em
// 0..255 em vez de -1..1.
const ndviZonalASTTemplate = `{"result":"0","values":{"0":{"functionInvocationValue":{"arguments":{"image":{"functionInvocationValue":{"arguments":{"input":{"functionInvocationValue":{"arguments":{"input":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"id":{"constantValue":"COPERNICUS/S2_SR_HARMONIZED"}},"functionName":"ImageCollection.load"}},"filter":{"functionInvocationValue":{"arguments":{"rightField":{"constantValue":"system:time_start"},"leftValue":{"functionInvocationValue":{"arguments":{"start":{"constantValue":"{{.StartDate}}"},"end":{"constantValue":"{{.EndDate}}"}},"functionName":"DateRange"}}},"functionName":"Filter.dateRangeContains"}}},"functionName":"Collection.filter"}},"filter":{"functionInvocationValue":{"arguments":{"leftField":{"constantValue":"CLOUDY_PIXEL_PERCENTAGE"},"rightValue":{"constantValue":{{.CloudThreshold}}}},"functionName":"Filter.lessThan"}}},"functionName":"Collection.filter"}}},"functionName":"reduce.median"}},"bandNames":{"constantValue":["B8","B4"]}},"functionName":"Image.normalizedDifference"}},"names":{"constantValue":["NDVI"]}},"functionName":"Image.rename"}},"reducer":{"functionInvocationValue":{"arguments":{"reducer1":{"functionInvocationValue":{"arguments":{},"functionName":"Reducer.mean"}},"reducer2":{"functionInvocationValue":{"arguments":{},"functionName":"Reducer.count"}},"sharedInputs":{"constantValue":true}},"functionName":"Reducer.combine"}},"geometry":{"functionInvocationValue":{"arguments":{"coordinates":{"constantValue":{{.Coordinates}}},"geodesic":{"constantValue":false},"evenOdd":{"constantValue":true}},"functionName":"GeometryConstructors.Polygon"}},"scale":{"constantValue":{{.Scale}}},"maxPixels":{"constantValue":100000000},"bestEffort":{"constantValue":true}},"functionName":"Image.reduceRegion"}}}}`

var ndviZonalTpl = template.Must(template.New("ndviZonal").Parse(ndviZonalASTTemplate))

type zonalASTParams struct {
	StartDate      string
	EndDate        string
	Coordinates    string
	Scale          int
	CloudThreshold int
}

// GenerateSentinel2NDVIZonalAST monta a AST que devolve a média de NDVI dentro
// de um polígono. coordinates é o anel do polígono em GeoJSON
// ([[[lng,lat],...]]), exatamente como vem do campo geometry do talhão.
func GenerateSentinel2NDVIZonalAST(coordinates [][][]float64, startDate, endDate string) (string, error) {
	if len(coordinates) == 0 || len(coordinates[0]) < 4 {
		return "", fmt.Errorf("polígono inválido: são necessários ao menos 4 pontos (anel fechado)")
	}

	coordJSON, err := json.Marshal(coordinates)
	if err != nil {
		return "", fmt.Errorf("falha ao serializar coordenadas: %w", err)
	}

	params := zonalASTParams{
		StartDate:      startDate,
		EndDate:        endDate,
		Coordinates:    string(coordJSON),
		Scale:          10, // resolução nativa das bandas B4/B8 do Sentinel-2
		CloudThreshold: 20, // mesmo limite usado nas camadas de tile
	}

	var buf bytes.Buffer
	if err := ndviZonalTpl.Execute(&buf, params); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// ZonalResult é o que o Earth Engine devolve para uma redução por região.
type ZonalResult struct {
	Mean  *float64 `json:"NDVI_mean"`
	Count *float64 `json:"NDVI_count"`
}

// ComputeValue executa uma AST que resulta em valor (e não em tiles) através do
// endpoint value:compute da REST API do Earth Engine.
func (c *GEEClient) ComputeValue(ctx context.Context, astJSON string) (json.RawMessage, error) {
	type expressionPayload struct {
		Expression json.RawMessage `json:"expression"`
	}

	body, err := json.Marshal(expressionPayload{Expression: json.RawMessage(astJSON)})
	if err != nil {
		return nil, fmt.Errorf("falha ao serializar payload de cálculo: %w", err)
	}

	url := fmt.Sprintf("%s/projects/%s/value:compute", c.apiBaseURL, c.auth.ProjectID)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.auth.Client().Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro na chamada à GEE value:compute: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GEE value:compute retornou %d: %s", resp.StatusCode, string(respBody))
	}

	// A resposta vem embrulhada em {"result": ...}
	var wrapper struct {
		Result json.RawMessage `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&wrapper); err != nil {
		return nil, fmt.Errorf("erro ao decodificar resposta de value:compute: %w", err)
	}

	return wrapper.Result, nil
}

// ZonalNDVI devolve a média de NDVI do polígono no período, junto da contagem
// de pixels usados — a contagem é o que permite distinguir "vegetação fraca" de
// "quase sem pixel válido por causa de nuvem".
func (c *GEEClient) ZonalNDVI(ctx context.Context, coordinates [][][]float64, startDate, endDate string) (*ZonalResult, error) {
	ast, err := GenerateSentinel2NDVIZonalAST(coordinates, startDate, endDate)
	if err != nil {
		return nil, err
	}

	raw, err := c.ComputeValue(ctx, ast)
	if err != nil {
		return nil, err
	}

	var result ZonalResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("resposta zonal em formato inesperado (%s): %w", string(raw), err)
	}

	return &result, nil
}
