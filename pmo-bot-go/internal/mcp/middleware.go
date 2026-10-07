package mcp

import (
	"context"
	"fmt"
	"log"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/mitchellh/mapstructure"
)

// ToolOptions defines the configuration for a tool's middleware validation.
type ToolOptions struct {
	// Schema is a pointer to a struct that represents the tool's expected arguments.
	// Used for mapstructure mapping and go-playground/validator validation.
	// It MUST be a pointer (e.g., &PlantioSchema{}).
	Schema interface{}

	// RequiresConfirmation indicates if the tool needs explicit human confirmation before execution.
	// Applies mainly to critical database mutation operations (INSERT/UPDATE).
	RequiresConfirmation bool

	// CustomValidator allows for custom business logic validation.
	// It is called after the schema validation passes.
	CustomValidator func(schema interface{}) error
}

// MotivoConfirmacaoPendente marca o resultado de uma ferramenta que NÃO
// executou porque falta a confirmação do produtor. O orquestrador usa isso
// para não deixar o LLM anunciar como feito algo que não foi gravado.
const MotivoConfirmacaoPendente = "confirmacao_pendente"

// Validator instance (thread-safe, can be shared)
var validate = validator.New()

// wrapWithMiddleware wraps a tool's base handler with validation, dry-run, and confirmation checks.
func wrapWithMiddleware(opts ToolOptions, baseHandler ToolHandler) ToolHandler {
	checado := checkBeforeExecute(opts, baseHandler)
	return func(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
		res, err := checado(ctx, args, tenant)
		// Quando a ferramenta NÃO executa (validação ou confirmação pendente),
		// só o LLM ficava sabendo — e ele reescreve o motivo como quiser
		// (num teste E2E virou "tive um problema ao registrar"). Sem este log
		// não havia como saber por que um registro não foi gravado.
		if m, ok := res.(map[string]interface{}); ok && m["status"] == "requires_user_input" {
			log.Printf("⏸️ [MCP-GUARD] Ferramenta não executada: %v | args=%v", m["message"], args)
		}
		return res, err
	}
}

func checkBeforeExecute(opts ToolOptions, baseHandler ToolHandler) ToolHandler {
	return func(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
		
		// 1. Schema Check
		if opts.Schema != nil {
			// Instância nova a cada chamada: antes o decode ia direto em
			// opts.Schema, um único ponteiro compartilhado por todas as
			// chamadas da ferramenta — corrida entre produtores simultâneos
			// e, pior, campo que sobrava da chamada anterior fazia o
			// "required" passar mesmo quando o LLM não mandou o campo.
			schema := reflect.New(reflect.TypeOf(opts.Schema).Elem()).Interface()

			// Convert map[string]interface{} to the provided struct
			decoder, err := mapstructure.NewDecoder(&mapstructure.DecoderConfig{
				Result:           schema,
				TagName:          "json",
				Squash:           true,
				WeaklyTypedInput: true,
			})
			if err != nil {
				return nil, fmt.Errorf("erro interno ao configurar o parser mapstructure: %w", err)
			}
			if err := decoder.Decode(args); err != nil {
				// Return a friendlier error to the LLM so it can try to self-correct instead of throwing a hard error
				return map[string]interface{}{
					"status":  "requires_user_input",
					"message": fmt.Sprintf("Erro ao converter os dados enviados para o formato esperado: %v. Verifique os tipos de dados fornecidos (ex: número vs string) e tente novamente.", err),
				}, nil
			}

			// Validate using go-playground/validator
			if err := validate.Struct(schema); err != nil {
				return formatValidationError(err)
			}

			// Custom Validation (Business Rules)
			if opts.CustomValidator != nil {
				if err := opts.CustomValidator(schema); err != nil {
					return map[string]interface{}{
						"status":  "requires_user_input",
						"message": fmt.Sprintf("A validação da regra de negócio falhou: %s. Por favor, instrua o usuário sobre o que está errado e peça os dados corretos ou o que fazer em seguida.", err.Error()),
					}, nil
				}
			}
		}

		// 2. Dry-Run Check
		// The LLM can send "dry_run": true as an argument if it just wants to validate the payload.
		if isDryRun, ok := args["dry_run"].(bool); ok && isDryRun {
			return map[string]interface{}{
				"status":  "success",
				"message": "DRY-RUN: Os dados foram validados com sucesso e estão corretos para gravação. Se esta ação exigir confirmação, peça-a agora ao usuário antes de executar a ação real (chamando novamente a ferramenta sem o dry_run).",
			}, nil
		}

		// 3. Confirmation Check
		if opts.RequiresConfirmation {
			if isConfirmed, ok := args["confirmed"].(bool); !ok || !isConfirmed {
				// The tool requires confirmation, but the LLM didn't provide confirmed: true
				return map[string]interface{}{
					"status":  "requires_user_input",
					"motivo":  MotivoConfirmacaoPendente,
					"message": "Atenção: Esta é uma operação crítica que modifica dados. Você DEVE pedir permissão explícita ao usuário antes de prosseguir. Responda ao usuário com: 'Confirma a execução desta ação na sua fazenda?'",
				}, nil
			}
		}

		// All checks passed, execute the real handler
		return baseHandler(ctx, args, tenant)
	}
}

// formatValidationError converts validator errors into LLM-friendly messages
func formatValidationError(err error) (map[string]interface{}, error) {
	if validationErrors, ok := err.(validator.ValidationErrors); ok {
		var missing []string
		var invalid []string

		for _, fieldErr := range validationErrors {
			switch fieldErr.Tag() {
			case "required":
				missing = append(missing, fieldErr.Field())
			default:
				invalid = append(invalid, fmt.Sprintf("%s (falhou na regra: %s)", fieldErr.Field(), fieldErr.Tag()))
			}
		}

		msgParts := []string{"Erro de Validação dos Argumentos da Ferramenta:"}
		if len(missing) > 0 {
			msgParts = append(msgParts, fmt.Sprintf("- Faltam campos obrigatórios: %s.", strings.Join(missing, ", ")))
		}
		if len(invalid) > 0 {
			msgParts = append(msgParts, fmt.Sprintf("- Campos com valores inválidos: %s.", strings.Join(invalid, ", ")))
		}
		msgParts = append(msgParts, "Por favor, peça ao usuário as informações que faltam ou corrija os valores antes de tentar novamente.")

		return map[string]interface{}{
			"status":  "requires_user_input",
			"message": strings.Join(msgParts, "\n"),
		}, nil
	}

	// Se não for um ValidationErrors, apenas propaga o erro genérico
	return nil, err
}
