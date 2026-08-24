//go:build ignore

package main

import (
	"fmt"
	"github.com/mitchellh/mapstructure"
	"strconv"
	"strings"
	"errors"
	"encoding/json"
)

type RegistrarColheitaSchema struct {
	Quantidade string `json:"quantidade" validate:"required"`
}

func parseArgToFloat(val interface{}) (float64, error) {
	if val == nil {
		return 0, errors.New("value is nil")
	}
	switch v := val.(type) {
	case float64: return v, nil
	case string: return strconv.ParseFloat(strings.ReplaceAll(v, ",", "."), 64)
	default:
		strVal := fmt.Sprintf("%v", val)
		return strconv.ParseFloat(strings.ReplaceAll(strVal, ",", "."), 64)
	}
}

func main() {
	args := map[string]interface{}{
		"quantidade": json.Number("50"),
	}
	
	schema := &RegistrarColheitaSchema{}
	decoder, _ := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
		Result:           schema,
		TagName:          "json",
		Squash:           true,
		WeaklyTypedInput: true,
	})
	
	err := decoder.Decode(args)
	fmt.Printf("Decode error: %v\n", err)
	fmt.Printf("Schema: %+v\n", schema)
	
	fmt.Printf("args after decode: %+v\n", args)
	
	qtd, err := parseArgToFloat(args["quantidade"])
	fmt.Printf("qtd: %f, err: %v\n", qtd, err)
}
