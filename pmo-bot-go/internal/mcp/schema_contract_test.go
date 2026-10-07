package mcp

import (
	"context"
	"reflect"
	"sort"
	"strings"
	"testing"
)

// TestSchemaDeValidacaoBateComParametrosAnunciados garante que todo campo
// obrigatório do Schema de validação (Options.Schema, checado em
// wrapWithMiddleware) existe nos parâmetros que a ferramenta anuncia ao LLM.
//
// Sem isso, a ferramenta nunca executa: o LLM preenche os nomes anunciados, o
// validador procura outros e devolve "faltam campos obrigatórios" para
// sempre. Foi o caso de registrar_compra_insumo (anunciava produto /
// quantidade_valor / valor_total; o schema exigia item / quantidade /
// valor_pago) — achado pelo teste E2E de despesa.
func TestSchemaDeValidacaoBateComParametrosAnunciados(t *testing.T) {
	s := &Server{tools: make(map[string]Tool)}
	s.InitializeTools()

	nomes := make([]string, 0, len(s.tools))
	for nome := range s.tools {
		nomes = append(nomes, nome)
	}
	sort.Strings(nomes)

	for _, nome := range nomes {
		tool := s.tools[nome]
		if tool.Options == nil || tool.Options.Schema == nil {
			continue
		}
		props, _ := tool.Definition.Parameters["properties"].(map[string]interface{})

		for _, campo := range camposObrigatorios(tool.Options.Schema) {
			if _, ok := props[campo]; !ok {
				t.Errorf("%s: schema exige %q, que não está entre os parâmetros anunciados ao LLM", nome, campo)
			}
		}
	}
}

// camposObrigatorios devolve as tags json dos campos com validate:"required..."
// do struct apontado por schema.
func camposObrigatorios(schema interface{}) []string {
	tipo := reflect.TypeOf(schema)
	for tipo.Kind() == reflect.Ptr {
		tipo = tipo.Elem()
	}
	var out []string
	for i := 0; i < tipo.NumField(); i++ {
		f := tipo.Field(i)
		jsonNome := strings.Split(f.Tag.Get("json"), ",")[0]
		if jsonNome == "" || jsonNome == "-" {
			continue
		}
		for _, regra := range strings.Split(f.Tag.Get("validate"), ",") {
			if regra == "required" {
				out = append(out, jsonNome)
			}
		}
	}
	return out
}

// Regressão: o decode ia direto num Schema compartilhado entre chamadas, então
// um campo obrigatório que veio na chamada anterior "sobrava" e fazia a
// validação da chamada seguinte passar sem ele.
func TestSchemaNaoVazaEntreChamadas(t *testing.T) {
	executou := 0
	h := wrapWithMiddleware(ToolOptions{Schema: &RegistrarLimpezaToolSchema{}}, func(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
		executou++
		return "ok", nil
	})

	if _, err := h(context.Background(), map[string]interface{}{"item_area": "galpão", "tipo_limpeza": "varrição"}, TenantCtx{}); err != nil {
		t.Fatal(err)
	}
	res, err := h(context.Background(), map[string]interface{}{"item_area": "galpão"}, TenantCtx{})
	if err != nil {
		t.Fatal(err)
	}

	if executou != 1 {
		t.Fatalf("a segunda chamada, sem tipo_limpeza, não deveria executar (executou %d vezes; resposta: %v)", executou, res)
	}
}
