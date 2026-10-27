package mcp

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// maxLinhasConsulta: quantas linhas cabem numa mensagem de WhatsApp sem virar
// rolagem. O resto vai resumido no "e mais N" (e, na fase 2, no link do app).
const maxLinhasConsulta = 8

var tituloGrupo = map[string][2]string{ // [BR, MZ]
	"":         {"Registros", "Registos"},
	"plantio":  {"Plantios", "Sementeiras e plantios"},
	"colheita": {"Colheitas", "Colheitas"},
	"manejo":   {"Manejos e aplicações", "Manejos e aplicações"},
	"compra":   {"Compras", "Compras"},
	"venda":    {"Vendas", "Vendas"},
}

func (s *Server) handleConsultarRegistros(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	grupo, _ := args["tipo"].(string)
	if grupo == "todos" {
		grupo = ""
	}
	if _, ok := supabase.GruposAtividade[grupo]; grupo != "" && !ok {
		return nil, fmt.Errorf("tipo desconhecido: %s", grupo)
	}
	f := supabase.FiltroCaderno{PmoID: tenant.PmoID, Grupo: grupo}
	f.Desde, _ = args["data_inicio"].(string)
	f.Ate, _ = args["data_fim"].(string)
	f.Produto, _ = args["produto"].(string)
	f.Talhao, _ = args["talhao"].(string)
	for _, d := range []string{f.Desde, f.Ate} {
		if d != "" {
			if _, err := time.Parse("2006-01-02", d); err != nil {
				return nil, fmt.Errorf("data inválida %q (use AAAA-MM-DD)", d)
			}
		}
	}

	modo, _ := args["modo"].(string)
	agora := time.Now().In(utils.TimezoneSistema())
	if modo == "resumo" {
		// Resumo é sempre de todos os tipos; sem período, vale o mês corrente.
		f.Grupo, grupo = "", ""
		if f.Desde == "" && f.Ate == "" {
			f.Desde = agora.Format("2006-01") + "-01"
		}
	}

	regs, err := s.supabase.ConsultarCaderno(ctx, f)
	if err != nil {
		return nil, fmt.Errorf("erro ao consultar o caderno de campo: %w", err)
	}

	var texto string
	switch modo {
	case "resumo":
		texto = TextoResumo(tenant.Telefone, f, regs, agora)
	case "total":
		texto = TextoTotais(tenant.Telefone, grupo, f, regs, agora)
	default:
		texto = TextoConsulta(tenant.Telefone, grupo, f, regs, agora)
		// A mensagem mostra só maxLinhasConsulta; o resto fica no app.
		if len(regs) > maxLinhasConsulta {
			if link, err := s.linkApp(tenant.UserID, "/caderno"); err == nil {
				texto += "\n\n" + textoLink(tenant.Telefone, "Ver todos no app", link)
			} else {
				log.Printf("⚠️ [Consulta] link do app falhou: %v", err)
			}
		}
	}

	return map[string]interface{}{
		"status":     "success",
		"quantidade": len(regs),
		// O orquestrador envia resposta_direta tal como está, sem o LLM.
		"resposta_direta": texto,
		"message":         "Lista pronta enviada ao produtor. Não invente, não some nem recalcule registos.",
	}, nil
}

// linkApp gera o link de entrada no app já logado (token opaco de uso único,
// 10 min) abrindo direto em destino. Destinos aceitos: ver AuthCallback.tsx.
func (s *Server) linkApp(userID, destino string) (string, error) {
	if userID == "" {
		return "", fmt.Errorf("produtor sem conta")
	}
	base := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if base == "" {
		return "", fmt.Errorf("FRONTEND_URL vazia")
	}
	token, err := s.supabase.GenerateOpaqueToken(userID)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%s/auth/callback?code=%s&next=%s", base, url.QueryEscape(token), url.QueryEscape(destino)), nil
}

func textoLink(phone, rotulo, link string) string {
	return fmt.Sprintf("🔗 %s (válido por 10 minutos, só uma vez):\n%s", rotulo, link)
}

var destinosApp = map[string]string{"caderno": "/caderno", "financeiro": "/financeiro"}

func (s *Server) handleEnviarLinkApp(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	nome, _ := args["destino"].(string)
	destino, ok := destinosApp[nome]
	if !ok {
		destino, nome = "/caderno", "caderno"
	}
	link, err := s.linkApp(tenant.UserID, destino)
	if err != nil {
		return nil, fmt.Errorf("não consegui gerar o link: %w", err)
	}
	rotulo := map[string]string{"caderno": "Abrir o caderno de campo no app", "financeiro": "Abrir o financeiro no app"}[nome]
	return map[string]interface{}{
		"status":          "success",
		"resposta_direta": textoLink(tenant.Telefone, rotulo, link),
		"message":         "Link enviado ao produtor.",
	}, nil
}

// TextoConsulta monta a resposta pronta para o WhatsApp.
func TextoConsulta(phone, grupo string, f supabase.FiltroCaderno, regs []supabase.RegistroCaderno, agora time.Time) string {
	mz := ehMZ(phone)
	pais := 0
	if mz {
		pais = 1
	}
	periodo := descreverPeriodo(f.Desde, f.Ate, agora)
	filtro := ""
	if f.Produto != "" {
		filtro += " de " + f.Produto
	}
	if f.Talhao != "" {
		filtro += " em " + f.Talhao
	}

	if len(regs) == 0 {
		nada := "Não encontrei registros"
		if mz {
			nada = "Não encontrei registos"
		}
		if grupo != "" {
			nada += " de " + strings.ToLower(tituloGrupo[grupo][pais])
		}
		return nada + filtro + periodo + "."
	}

	var b strings.Builder
	palavra := "registro"
	if mz {
		palavra = "registo"
	}
	if len(regs) != 1 {
		palavra += "s"
	}
	fmt.Fprintf(&b, "📒 *%s*%s%s — %d %s\n", tituloGrupo[grupo][pais], filtro, periodo, len(regs), palavra)

	moeda := utils.MoedaSimboloPara(phone)
	var total float64
	for i, r := range regs {
		total += r.ValorTotal
		if i >= maxLinhasConsulta {
			continue
		}
		b.WriteString("\n• " + linhaRegistro(r, grupo == "", moeda, agora))
	}
	if n := len(regs) - maxLinhasConsulta; n > 0 {
		fmt.Fprintf(&b, "\n…e mais %d.", n)
	}
	// Só soma dinheiro quando o grupo é de um sentido só: juntar compra com
	// venda daria um número sem significado.
	if total > 0 && (grupo == "compra" || grupo == "venda") {
		rotulo := "Total gasto"
		if grupo == "venda" {
			rotulo = "Total vendido"
		}
		fmt.Fprintf(&b, "\n\n*%s:* %s %s", rotulo, utils.FormatarValor(total), moeda)
	}
	return b.String()
}

func linhaRegistro(r supabase.RegistroCaderno, comTipo bool, moeda string, agora time.Time) string {
	var partes []string
	partes = append(partes, dataCurta(r.DataRegistro, agora))
	if comTipo && r.TipoAtividade != "" {
		partes = append(partes, rotuloAtividade(r.TipoAtividade))
	}

	if prod := rotuloProduto(r); prod != "" {
		partes = append(partes, prod)
	}

	if r.QuantidadeValor > 0 {
		q := numeroCurto(r.QuantidadeValor) + " " + strings.TrimSpace(r.QuantidadeUnidade)
		if peso := pesoUnidade(r.DetalhesTecnicos); peso > 0 {
			q += " (" + numeroCurto(peso*r.QuantidadeValor) + " kg)"
		}
		partes = append(partes, strings.TrimSpace(q))
	}
	if t := strings.TrimSpace(r.TalhaoCanteiro); t != "" {
		partes = append(partes, t)
	}
	if r.ValorTotal > 0 {
		partes = append(partes, utils.FormatarValor(r.ValorTotal)+" "+moeda)
	}
	return strings.Join(partes, " · ")
}

// rotuloProduto: "adubo (Ureia)" quando a composição acrescenta algo.
func rotuloProduto(r supabase.RegistroCaderno) string {
	prod := strings.TrimSpace(r.Produto)
	if comp, _ := r.DetalhesTecnicos["composicao"].(string); strings.TrimSpace(comp) != "" && !strings.EqualFold(comp, prod) {
		if prod == "" {
			return strings.TrimSpace(comp)
		}
		return prod + " (" + strings.TrimSpace(comp) + ")"
	}
	return prod
}

// unidadeChave junta "saco"/"sacos"/"Sacos" e "Kg"/"kg" na mesma soma.
func unidadeChave(u string) string {
	u = strings.ToLower(strings.TrimSpace(u))
	if len(u) > 2 && strings.HasSuffix(u, "s") {
		u = strings.TrimSuffix(u, "s")
	}
	return u
}

// totalProduto acumula as quantidades de um produto, separadas por unidade
// (não dá para somar caixas com kg).
type totalProduto struct {
	nome     string
	registos int
	qtd      map[string]float64
	unidade  map[string]string // chave → forma escrita pelo produtor
	ordem    []string
	kg       float64 // peso total quando a unidade tem peso conhecido (sacos de 50 kg)
	valor    float64
}

func somarPorProduto(regs []supabase.RegistroCaderno) []*totalProduto {
	por := map[string]*totalProduto{}
	var lista []*totalProduto
	for _, r := range regs {
		nome := rotuloProduto(r)
		if nome == "" {
			nome = "sem produto"
		}
		k := strings.ToLower(nome)
		t := por[k]
		if t == nil {
			t = &totalProduto{nome: nome, qtd: map[string]float64{}, unidade: map[string]string{}}
			por[k] = t
			lista = append(lista, t)
		}
		t.registos++
		t.valor += r.ValorTotal
		if r.QuantidadeValor > 0 {
			u := unidadeChave(r.QuantidadeUnidade)
			if _, ok := t.qtd[u]; !ok {
				t.ordem = append(t.ordem, u)
				t.unidade[u] = strings.TrimSpace(r.QuantidadeUnidade)
			}
			t.qtd[u] += r.QuantidadeValor
			if peso := pesoUnidade(r.DetalhesTecnicos); peso > 0 {
				t.kg += peso * r.QuantidadeValor
			}
		}
	}
	// Mais registos primeiro; a ordem de chegada (mais recente) desempata.
	sort.SliceStable(lista, func(i, j int) bool { return lista[i].registos > lista[j].registos })
	return lista
}

func (t *totalProduto) quantidades() string {
	var partes []string
	for _, u := range t.ordem {
		partes = append(partes, strings.TrimSpace(numeroCurto(t.qtd[u])+" "+t.unidade[u]))
	}
	s := strings.Join(partes, " + ")
	if t.kg > 0 && !(len(t.ordem) == 1 && t.ordem[0] == "kg") {
		s += " (" + numeroCurto(t.kg) + " kg)"
	}
	return s
}

// TextoTotais responde "quanto colhi de tomate?": soma por produto em vez de
// listar registo a registo.
func TextoTotais(phone, grupo string, f supabase.FiltroCaderno, regs []supabase.RegistroCaderno, agora time.Time) string {
	if len(regs) == 0 {
		return TextoConsulta(phone, grupo, f, regs, agora)
	}
	mz := ehMZ(phone)
	pais := 0
	palavra := "registro"
	if mz {
		pais, palavra = 1, "registo"
	}
	filtro := ""
	if f.Produto != "" {
		filtro += " de " + f.Produto
	}
	if f.Talhao != "" {
		filtro += " em " + f.Talhao
	}

	var b strings.Builder
	fmt.Fprintf(&b, "📊 *Totais — %s*%s%s\n", strings.ToLower(tituloGrupo[grupo][pais]), filtro, descreverPeriodo(f.Desde, f.Ate, agora))
	moeda := utils.MoedaSimboloPara(phone)
	totais := somarPorProduto(regs)
	var dinheiro float64
	for i, t := range totais {
		dinheiro += t.valor
		if i >= maxLinhasConsulta {
			continue
		}
		linha := "\n• " + t.nome
		if q := t.quantidades(); q != "" {
			linha += ": " + q
		}
		n := palavra
		if t.registos != 1 {
			n += "s"
		}
		linha += fmt.Sprintf(" — %d %s", t.registos, n)
		if t.valor > 0 && (grupo == "compra" || grupo == "venda") {
			linha += " · " + utils.FormatarValor(t.valor) + " " + moeda
		}
		b.WriteString(linha)
	}
	if n := len(totais) - maxLinhasConsulta; n > 0 {
		fmt.Fprintf(&b, "\n…e mais %d produtos.", n)
	}
	if dinheiro > 0 && (grupo == "compra" || grupo == "venda") {
		rotulo := "Total gasto"
		if grupo == "venda" {
			rotulo = "Total vendido"
		}
		fmt.Fprintf(&b, "\n\n*%s:* %s %s", rotulo, utils.FormatarValor(dinheiro), moeda)
	}
	b.WriteString(avisoLimite(regs, f, mz))
	return b.String()
}

// TextoResumo responde "como foi o mês?": uma linha por tipo de atividade e o
// saldo entre vendas e compras registadas no caderno.
func TextoResumo(phone string, f supabase.FiltroCaderno, regs []supabase.RegistroCaderno, agora time.Time) string {
	mz := ehMZ(phone)
	periodo := descreverPeriodo(f.Desde, f.Ate, agora)
	if len(regs) == 0 {
		if mz {
			return "Não encontrei registos" + periodo + "."
		}
		return "Não encontrei registros" + periodo + "."
	}

	por := map[string][]supabase.RegistroCaderno{}
	outros := 0
	for _, r := range regs {
		g := grupoDe(r.TipoAtividade)
		if g == "" {
			outros++
			continue
		}
		por[g] = append(por[g], r)
	}

	moeda := utils.MoedaSimboloPara(phone)
	pais := 0
	if mz {
		pais = 1
	}
	var b strings.Builder
	fmt.Fprintf(&b, "📊 *Resumo*%s\n", periodo)
	var gasto, vendido float64
	for _, g := range []struct{ grupo, emoji string }{
		{"plantio", "🌱"}, {"manejo", "🧪"}, {"colheita", "🧺"}, {"compra", "🛒"}, {"venda", "💰"},
	} {
		rs := por[g.grupo]
		if len(rs) == 0 {
			continue
		}
		fmt.Fprintf(&b, "\n%s %s: %d", g.emoji, tituloGrupo[g.grupo][pais], len(rs))
		totais := somarPorProduto(rs)
		var soma float64
		for _, t := range totais {
			soma += t.valor
		}
		switch g.grupo {
		case "compra", "venda":
			if soma > 0 {
				b.WriteString(" — " + utils.FormatarValor(soma) + " " + moeda)
			}
			if g.grupo == "compra" {
				gasto = soma
			} else {
				vendido = soma
			}
		default:
			// Até 3 produtos, com a quantidade só na colheita (é o que o
			// produtor quer saber dela).
			var nomes []string
			for i, t := range totais {
				if i == 3 {
					nomes = append(nomes, "…")
					break
				}
				n := t.nome
				if q := t.quantidades(); g.grupo == "colheita" && q != "" {
					n += " " + q
				}
				nomes = append(nomes, n)
			}
			b.WriteString(" (" + strings.Join(nomes, ", ") + ")")
		}
	}
	if outros > 0 {
		fmt.Fprintf(&b, "\n📝 Outros: %d", outros)
	}
	if gasto > 0 || vendido > 0 {
		saldo := vendido - gasto
		sinal := ""
		if saldo < 0 {
			sinal, saldo = "−", -saldo
		}
		fmt.Fprintf(&b, "\n\n*Vendas − compras:* %s%s %s", sinal, utils.FormatarValor(saldo), moeda)
		b.WriteString("\n_Outras despesas ficam no balanço financeiro._")
	}
	b.WriteString(avisoLimite(regs, f, mz))
	return b.String()
}

func grupoDe(tipo string) string {
	for g, tipos := range supabase.GruposAtividade {
		for _, t := range tipos {
			if t == tipo {
				return g
			}
		}
	}
	return ""
}

// avisoLimite: a consulta traz no máximo 200 linhas; somas acima disso
// ficariam erradas sem avisar.
func avisoLimite(regs []supabase.RegistroCaderno, f supabase.FiltroCaderno, mz bool) string {
	limite := f.Limite
	if limite <= 0 || limite > 200 {
		limite = 200
	}
	if len(regs) < limite {
		return ""
	}
	if mz {
		return fmt.Sprintf("\n\n_Contas feitas com os %d registos mais recentes; escolha um período mais curto para ver tudo._", limite)
	}
	return fmt.Sprintf("\n\n_Contas feitas com os %d registros mais recentes; escolha um período mais curto para ver tudo._", limite)
}

func rotuloAtividade(tipo string) string {
	if g := grupoDe(tipo); g != "" {
		return map[string]string{
			"plantio": "Plantio", "colheita": "Colheita", "manejo": "Manejo",
			"compra": "Compra", "venda": "Venda",
		}[g]
	}
	return tipo
}

func pesoUnidade(d map[string]interface{}) float64 {
	switch v := d["peso_unidade_kg"].(type) {
	case float64:
		return v
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	}
	return 0
}

// dataCurta: "19/10" no ano corrente, "19/10/25" fora dele.
func dataCurta(iso string, agora time.Time) string {
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	if t.Year() == agora.Year() {
		return t.Format("02/01")
	}
	return t.Format("02/01/06")
}

func descreverPeriodo(desde, ate string, agora time.Time) string {
	switch {
	case desde != "" && ate != "":
		return " de " + dataCurta(desde, agora) + " a " + dataCurta(ate, agora)
	case desde != "":
		return " desde " + dataCurta(desde, agora)
	case ate != "":
		return " até " + dataCurta(ate, agora)
	}
	return ""
}

func numeroCurto(f float64) string {
	if f == float64(int64(f)) {
		return strconv.FormatInt(int64(f), 10)
	}
	return strings.Replace(strconv.FormatFloat(f, 'f', -1, 64), ".", ",", 1)
}
