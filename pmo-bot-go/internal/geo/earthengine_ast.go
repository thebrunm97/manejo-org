package geo

import (
	"bytes"
	"text/template"
)

// GEE AST Templates for Sentinel-2 (Global Lazy Evaluation)
const rgbASTTemplate = `{"result":"0","values":{"0":{"functionInvocationValue":{"arguments":{"image":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"id":{"constantValue":"COPERNICUS/S2_SR_HARMONIZED"}},"functionName":"ImageCollection.load"}},"filter":{"functionInvocationValue":{"arguments":{"rightField":{"constantValue":"system:time_start"},"leftValue":{"functionInvocationValue":{"arguments":{"start":{"constantValue":"{{.StartDate}}"},"end":{"constantValue":"{{.EndDate}}"}},"functionName":"DateRange"}}},"functionName":"Filter.dateRangeContains"}}},"functionName":"Collection.filter"}},"filter":{"functionInvocationValue":{"arguments":{"leftField":{"constantValue":"CLOUDY_PIXEL_PERCENTAGE"},"rightValue":{"constantValue":20}},"functionName":"Filter.lessThan"}}},"functionName":"Collection.filter"}}},"functionName":"reduce.median"}},"bands":{"constantValue":["B4","B3","B2"]},"min":{"constantValue":0},"max":{"constantValue":3000}},"functionName":"Image.visualize"}}}}`

const ndviASTTemplate = `{"result":"0","values":{"0":{"functionInvocationValue":{"arguments":{"image":{"functionInvocationValue":{"arguments":{"input":{"functionInvocationValue":{"arguments":{"input":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"collection":{"functionInvocationValue":{"arguments":{"id":{"constantValue":"COPERNICUS/S2_SR_HARMONIZED"}},"functionName":"ImageCollection.load"}},"filter":{"functionInvocationValue":{"arguments":{"rightField":{"constantValue":"system:time_start"},"leftValue":{"functionInvocationValue":{"arguments":{"start":{"constantValue":"{{.StartDate}}"},"end":{"constantValue":"{{.EndDate}}"}},"functionName":"DateRange"}}},"functionName":"Filter.dateRangeContains"}}},"functionName":"Collection.filter"}},"filter":{"functionInvocationValue":{"arguments":{"leftField":{"constantValue":"CLOUDY_PIXEL_PERCENTAGE"},"rightValue":{"constantValue":20}},"functionName":"Filter.lessThan"}}},"functionName":"Collection.filter"}}},"functionName":"reduce.median"}},"bandNames":{"constantValue":["B8","B4"]}},"functionName":"Image.normalizedDifference"}},"names":{"constantValue":["NDVI"]}},"functionName":"Image.rename"}},"min":{"constantValue":0},"max":{"constantValue":1},"palette":{"constantValue":["FFFFFF","CE7E45","DF923D","F1B555","FCD163","99B718","74A901","66A000","529400","3E8601","207401","056201","004C00","023B01","012E01","011D01","011301"]}},"functionName":"Image.visualize"}}}}`

var (
	rgbTpl  = template.Must(template.New("rgb").Parse(rgbASTTemplate))
	ndviTpl = template.Must(template.New("ndvi").Parse(ndviASTTemplate))
)

type ASTParams struct {
	StartDate string
	EndDate   string
}

// GenerateSentinel2RGBAST gera o JSON da AST para True Color
func GenerateSentinel2RGBAST(startDate, endDate string) (string, error) {
	params := ASTParams{
		StartDate: startDate,
		EndDate:   endDate,
	}

	var buf bytes.Buffer
	if err := rgbTpl.Execute(&buf, params); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// GenerateSentinel2NDVIAST gera o JSON da AST para NDVI
func GenerateSentinel2NDVIAST(startDate, endDate string) (string, error) {
	params := ASTParams{
		StartDate: startDate,
		EndDate:   endDate,
	}

	var buf bytes.Buffer
	if err := ndviTpl.Execute(&buf, params); err != nil {
		return "", err
	}

	return buf.String(), nil
}
