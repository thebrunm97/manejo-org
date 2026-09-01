package mcp

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"
	"testing"
)

// forbiddenArgsKeys são os identificadores de tenant que nenhum handler pode
// ler de args (o mapa de argumentos vindo do LLM). Desde o DT-67, esses
// valores só podem chegar a um handler através de TenantCtx — resolvido e
// validado a partir da sessão do produtor ANTES do handler rodar, nunca do
// que o LLM (ou um usuário manipulando o prompt) escreveu. Um handler que lê
// qualquer uma destas chaves de args reabriria exatamente a vulnerabilidade
// que motivou o TenantCtx (era assim que handleConsultarBalancoFinanceiro
// vazava dados entre PMOs antes da correção pontual do DT-67 item 1).
var forbiddenArgsKeys = []string{
	"pmo_id",
	"pmo_ativo_id",
	"propriedade_id",
	"propriedade_ativa_id",
	"user_id",
	"telefone",
}

// TestNoHandlerReadsTenantIDsFromArgs varre estaticamente (via go/ast) todo
// arquivo tools_*.go não-teste do pacote, procurando por um índice de mapa
// args["chave-proibida"] literal. O objetivo é tornar a garantia "tenant
// nunca vem de args" verificável para QUALQUER handler futuro, não só os já
// corrigidos pelo DT-67 — sem esta checagem estática, nada impede um novo
// handler de reintroduzir amanhã o mesmo bug que este débito técnico
// eliminou hoje.
func TestNoHandlerReadsTenantIDsFromArgs(t *testing.T) {
	files, err := filepath.Glob("tools_*.go")
	if err != nil {
		t.Fatalf("falha ao listar arquivos: %v", err)
	}
	if len(files) == 0 {
		t.Fatal("nenhum arquivo tools_*.go encontrado — o glob quebrou?")
	}

	fset := token.NewFileSet()
	var violations []string

	for _, file := range files {
		if strings.HasSuffix(file, "_test.go") {
			continue
		}

		node, err := parser.ParseFile(fset, file, nil, 0)
		if err != nil {
			t.Fatalf("falha ao parsear %s: %v", file, err)
		}

		ast.Inspect(node, func(n ast.Node) bool {
			indexExpr, ok := n.(*ast.IndexExpr)
			if !ok {
				return true
			}
			ident, ok := indexExpr.X.(*ast.Ident)
			if !ok || ident.Name != "args" {
				return true
			}
			lit, ok := indexExpr.Index.(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				return true
			}
			key := strings.Trim(lit.Value, `"`)
			for _, forbidden := range forbiddenArgsKeys {
				if key == forbidden {
					pos := fset.Position(indexExpr.Pos())
					violations = append(violations, fmt.Sprintf("%s:%d: args[%q]", file, pos.Line, key))
				}
			}
			return true
		})
	}

	if len(violations) > 0 {
		t.Errorf("handlers lendo identificadores de tenant de args (proibido desde o DT-67):\n%s", strings.Join(violations, "\n"))
	}
}

// TestAllRegisteredToolsAreWellFormed itera GetAllMCPTools() para garantir
// que toda ferramenta registrada por InitializeTools tem nome, handler e
// unicidade coerentes. O compilador já garante que todo handler tem a
// assinatura ToolHandler nova (ctx, args, TenantCtx) — o que ele não
// garante, e este teste cobre, é que o registro em si (nomes, ponteiros de
// handler) não tenha buracos.
func TestAllRegisteredToolsAreWellFormed(t *testing.T) {
	s := NewServer(nil, nil, nil, nil)
	s.InitializeTools()

	tools := s.GetAllMCPTools()
	if len(tools) == 0 {
		t.Fatal("nenhuma ferramenta registrada — InitializeTools quebrou?")
	}

	seen := make(map[string]bool)
	for _, tool := range tools {
		name := tool.Definition.Name
		if name == "" {
			t.Error("ferramenta registrada com Definition.Name vazio")
			continue
		}
		if tool.Handler == nil {
			t.Errorf("ferramenta %q registrada sem Handler", name)
		}
		if seen[name] {
			t.Errorf("ferramenta %q registrada mais de uma vez", name)
		}
		seen[name] = true
	}
}
