package mcp

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// Depois de registrar uma compra, o bot pode perguntar o que falta para o
// registro servir de algo: o TIPO do insumo, quando o nome é genérico
// ("adubo"), e o PESO por unidade, quando a unidade não tem peso ("saco").
// A compra nunca espera pela resposta: fica gravada e o complemento entra
// depois (rpc_complementar_compra_insumo).

// produtosGenericos: nomes que não dizem que insumo é. "Esterco" ou "ureia"
// já dizem; "adubo" não.
var produtosGenericos = map[string]bool{
	"adubo": true, "adubos": true, "fertilizante": true, "fertilizantes": true,
	"remedio": true, "remedios": true, "veneno": true, "venenos": true,
	"defensivo": true, "defensivos": true, "agrotoxico": true, "agrotoxicos": true,
	"pesticida": true, "pesticidas": true, "insumo": true, "insumos": true,
	"produto": true, "adubo organico": true, "adubo quimico": true, "adubo foliar": true,
}

// unidadesSemPeso: embalagens cujo peso varia (saco de 25 ou de 50 kg).
var unidadesSemPeso = map[string]bool{
	"saco": true, "sacos": true, "saca": true, "sacas": true, "carrinho": true, "carrinhos": true,
	"balde": true, "baldes": true, "lata": true, "latas": true, "caixa": true, "caixas": true,
	"pacote": true, "pacotes": true, "fardo": true, "fardos": true, "carroca": true, "carrocas": true,
}

func ehMZ(phone string) bool { return strings.HasPrefix(strings.TrimPrefix(phone, "+"), "258") }

// FaltasDaCompra diz o que perguntar sobre uma compra recém-registrada.
func FaltasDaCompra(produto, unidade, marca, composicao string) (faltaTipo, faltaPeso bool) {
	faltaTipo = produtosGenericos[utils.Normalize(strings.TrimSpace(produto))] &&
		strings.TrimSpace(marca) == "" && strings.TrimSpace(composicao) == ""
	faltaPeso = unidadesSemPeso[utils.Normalize(strings.TrimSpace(unidade))]
	return
}

// PerguntaComplemento monta a pergunta curta, em pt-MZ para +258.
func PerguntaComplemento(phone, produto, unidade string, faltaTipo, faltaPeso bool) string {
	if !faltaTipo && !faltaPeso {
		return ""
	}
	mz := ehMZ(phone)
	unidSing := strings.TrimSuffix(strings.TrimSpace(unidade), "s")
	var partes []string
	if faltaTipo {
		exemplo := "esterco, ureia, NPK 12-24-12"
		if n := utils.Normalize(produto); strings.Contains(n, "remedio") || strings.Contains(n, "veneno") ||
			strings.Contains(n, "defensivo") || strings.Contains(n, "agrotoxico") || strings.Contains(n, "pesticida") {
			exemplo = "nome do produto que vem no rótulo"
		}
		partes = append(partes, fmt.Sprintf("que %s era (%s)?", strings.ToLower(produto), exemplo))
	}
	if faltaPeso {
		partes = append(partes, fmt.Sprintf("quantos kg tem cada %s?", unidSing))
	}
	pergunta := strings.Join(partes, " E ")
	pergunta = strings.ToUpper(pergunta[:1]) + pergunta[1:]
	if mz {
		return "Para completar o registo: " + strings.ToLower(pergunta[:1]) + pergunta[1:] + "\n_Se não souber, pode ignorar._"
	}
	return "Pra completar o registro: " + strings.ToLower(pergunta[:1]) + pergunta[1:] + "\n_Se não souber, pode ignorar._"
}

// resultadoCompra é o retorno de registrar_compra_insumo depois de gravar.
// Se o peso da embalagem já é conhecido de compras anteriores, completa na
// hora; o que ainda faltar vai em "complemento" para o estado da conversa.
func (s *Server) resultadoCompra(ctx context.Context, tenant TenantCtx, compraID, produto, unidade string, quantidade float64, marca, composicao string, repetida bool) map[string]interface{} {
	mz := ehMZ(tenant.Telefone)
	msg := fmt.Sprintf("Compra de '%s' registrada com sucesso.", produto)
	if mz {
		msg = fmt.Sprintf("Compra de '%s' registada com sucesso.", produto)
	}
	res := map[string]interface{}{"status": "success", "message": msg, "compra_id": compraID}
	if repetida || s.supabase == nil {
		return res
	}

	faltaTipo, faltaPeso := FaltasDaCompra(produto, unidade, marca, composicao)
	if faltaPeso {
		if peso, ok := s.supabase.PesoUnidadeConhecido(ctx, tenant.UserID, produto, unidade); ok {
			if err := s.supabase.ComplementarCompraInsumo(ctx, compraID, tenant.UserID, "", peso); err != nil {
				log.Printf("⚠️ [Compra] Falha ao aplicar peso conhecido: %v", err)
			} else {
				faltaPeso = false
				res["message"] = fmt.Sprintf("%s (%s de %s kg, como da última vez)", strings.TrimSuffix(msg, "."),
					strings.TrimSuffix(unidade, "s"), formatarKg(peso))
			}
		}
	}
	if !faltaTipo && !faltaPeso {
		return res
	}
	res["complemento"] = map[string]interface{}{
		"compra_id":  compraID,
		"produto":    produto,
		"unidade":    unidade,
		"quantidade": quantidade,
		"falta_tipo": faltaTipo,
		"falta_peso": faltaPeso,
		"pergunta":   PerguntaComplemento(tenant.Telefone, produto, unidade, faltaTipo, faltaPeso),
	}
	// Para o LLM não fazer a mesma pergunta com outras palavras: o sistema
	// acrescenta a pergunta ao fim da resposta.
	res["instrucao"] = "Confirme o registro em uma frase. NÃO pergunte detalhes do insumo nem da embalagem: o sistema já pergunta."
	return res
}

func formatarKg(f float64) string {
	if f == float64(int64(f)) {
		return fmt.Sprintf("%d", int64(f))
	}
	return strings.Replace(fmt.Sprintf("%.1f", f), ".", ",", 1)
}
