package mcp

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/thebrunm97/pmo-bot-go/internal/domain"
	"github.com/thebrunm97/pmo-bot-go/internal/supabase"
	"github.com/thebrunm97/pmo-bot-go/internal/utils"
)

// LoteAves é o estado de um lote de aves somado a partir dos eventos do
// caderno (entrada, mortalidade, abate...). Não há tabela de lotes: o lote
// existe enquanto houver eventos com o seu nome.
type LoteAves struct {
	Nome       string
	Finalidade string
	Inicio     string // data da primeira entrada (YYYY-MM-DD)
	Entradas   float64
	Mortas     float64
	Abatidas   float64
	Saidas     float64
	Ovos7d     float64
	Vacina     string
	DataVacina string
	PesoMedio  float64
	DataPeso   string
}

// Vivas: aves que ainda estão no lote.
func (l *LoteAves) Vivas() float64 { return l.Entradas - l.Mortas - l.Abatidas - l.Saidas }

// ResumirLotes soma os eventos por lote, na ordem em que os lotes apareceram.
// regs vem do mais antigo para o mais recente (ListarAvicultura).
func ResumirLotes(regs []supabase.RegistroAve, agora time.Time) []*LoteAves {
	semana := agora.AddDate(0, 0, -6).Format("2006-01-02")
	por := map[string]*LoteAves{}
	var ordem []*LoteAves
	for _, r := range regs {
		nome := strings.TrimSpace(r.Lote)
		if nome == "" {
			nome = "Sem lote"
		}
		l, ok := por[strings.ToLower(nome)]
		if !ok {
			l = &LoteAves{Nome: nome}
			por[strings.ToLower(nome)] = l
			ordem = append(ordem, l)
		}
		d := r.DetalhesTecnicos
		evento, _ := d["evento"].(string)
		switch evento {
		case "entrada":
			l.Entradas += r.QuantidadeValor
			if l.Inicio == "" {
				l.Inicio = r.DataRegistro
			}
			if f, _ := d["finalidade"].(string); f != "" {
				l.Finalidade = f
			}
		case "mortalidade":
			l.Mortas += r.QuantidadeValor
		case "abate":
			l.Abatidas += r.QuantidadeValor
		case "saida":
			l.Saidas += r.QuantidadeValor
		case "postura":
			if r.DataRegistro >= semana {
				l.Ovos7d += r.QuantidadeValor
			}
		case "vacinacao":
			l.Vacina, _ = d["vacina"].(string)
			l.DataVacina = r.DataRegistro
		case "pesagem":
			l.PesoMedio, l.DataPeso = r.QuantidadeValor, r.DataRegistro
		}
		if evento == "abate" || evento == "saida" {
			if p, err := parseArgToFloat(d["peso_medio_kg"]); err == nil && p > 0 {
				l.PesoMedio, l.DataPeso = p, r.DataRegistro
			}
		}
	}
	return ordem
}

// escolherLote decide em que lote gravar o evento. Devolve o nome do lote, ou
// uma pergunta para o produtor quando não dá para saber.
func escolherLote(lotes []*LoteAves, pedido, evento string) (string, string) {
	pedido = strings.TrimSpace(pedido)
	if pedido != "" {
		for _, l := range lotes {
			if strings.EqualFold(l.Nome, pedido) {
				return l.Nome, ""
			}
		}
		if evento == "entrada" {
			return pedido, ""
		}
		return "", fmt.Sprintf("Não há lote %q. %s", pedido, listaLotes(lotes))
	}

	if evento == "entrada" {
		existe := map[string]bool{}
		for _, l := range lotes {
			existe[strings.ToLower(l.Nome)] = true
		}
		for n := len(lotes) + 1; ; n++ {
			if nome := fmt.Sprintf("Lote %d", n); !existe[strings.ToLower(nome)] {
				return nome, ""
			}
		}
	}

	var ativos []*LoteAves
	for _, l := range lotes {
		if l.Vivas() > 0 {
			ativos = append(ativos, l)
		}
	}
	switch len(ativos) {
	case 0:
		return "", "Ainda não há lote de aves registado. Pergunte ao produtor quantas aves tem, se são de corte ou de postura e desde quando, e registe primeiro a entrada (evento=entrada)."
	case 1:
		return ativos[0].Nome, ""
	}
	return "", "Há mais de um lote; pergunte ao produtor qual. " + listaLotes(ativos)
}

func listaLotes(lotes []*LoteAves) string {
	if len(lotes) == 0 {
		return "Nenhum lote registado."
	}
	var partes []string
	for _, l := range lotes {
		info := numeroCurto(l.Vivas()) + " aves"
		if l.Finalidade != "" {
			info = l.Finalidade + ", " + info
		}
		partes = append(partes, l.Nome+" ("+info+")")
	}
	return "Lotes: " + strings.Join(partes, "; ") + "."
}

func pedirAoProdutor(msg string) map[string]interface{} {
	return map[string]interface{}{"status": "requires_user_input", "message": msg}
}

func (s *Server) handleRegistrarAvicultura(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	evento := strings.ToLower(sanitize(args["evento"]))
	ev, ok := domain.EventosAvicultura[evento]
	if !ok {
		return pedirAoProdutor("Evento desconhecido. Use: entrada, postura, mortalidade, vacinacao, pesagem, abate ou saida."), nil
	}
	qtd, _ := parseArgToFloat(args["quantidade"])
	if qtd <= 0 {
		return pedirAoProdutor("Falta a quantidade (aves, ovos ou peso médio em kg). Pergunte ao produtor."), nil
	}
	finalidade := strings.ToLower(sanitize(args["finalidade"]))
	if evento == "entrada" && finalidade == "" {
		return pedirAoProdutor("Pergunte se as aves são de corte (carne) ou de postura (ovos)."), nil
	}
	vacina := sanitize(args["vacina"])
	if evento == "vacinacao" && vacina == "" {
		return pedirAoProdutor("Pergunte qual vacina foi dada (ex.: Newcastle, Gumboro, Bouba)."), nil
	}

	agora := time.Now().In(utils.TimezoneSistema())
	data := sanitize(args["data"])
	if data == "" {
		data = agora.Format("2006-01-02")
	}

	regs, err := s.supabase.ListarAvicultura(ctx, tenant.PmoID)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler os lotes de aves: %w", err)
	}
	lotes := ResumirLotes(regs, agora)
	lote, pergunta := escolherLote(lotes, sanitize(args["lote"]), evento)
	if pergunta != "" {
		return pedirAoProdutor(pergunta), nil
	}
	var atual *LoteAves
	for _, l := range lotes {
		if l.Nome == lote {
			atual = l
		}
	}
	if ev.Saida && atual != nil && qtd > atual.Vivas() {
		return pedirAoProdutor(fmt.Sprintf("O %s tem só %s aves registadas; confirme o número com o produtor.", lote, numeroCurto(atual.Vivas()))), nil
	}

	payload := map[string]interface{}{
		"data":               data,
		"evento":             evento,
		"lote":               lote,
		"produto":            domain.ProdutoAvicultura(evento, vacina),
		"quantidade_valor":   qtd,
		"quantidade_unidade": ev.Unidade,
	}
	for _, k := range []string{"finalidade", "raca", "vacina", "causa", "cliente", "observacao"} {
		if v := sanitize(args[k]); v != "" {
			payload[k] = v
		}
	}
	if finalidade != "" {
		payload["finalidade"] = finalidade
	}
	if p, _ := parseArgToFloat(args["peso_medio_kg"]); p > 0 {
		payload["peso_medio_kg"] = p
	}
	if v, _ := parseArgToFloat(args["valor_total"]); v > 0 {
		payload["valor_total"] = v
	}
	if rawPayloadID, ok := args["raw_payload_id"].(string); ok && rawPayloadID != "" {
		payload["raw_payload_id"] = rawPayloadID
	}

	resp, err := s.supabase.RegistrarOperacaoCampoRPC(ctx, map[string]interface{}{
		"pmo_id_arg":         tenant.PmoID,
		"propriedade_id_arg": tenant.PropriedadeID,
		"user_id_arg":        tenant.UserID,
		"tipo_arg":           "Avicultura",
		"payload_arg":        payload,
	}, data)
	if err != nil {
		return fmt.Sprintf("Erro ao registar o evento das aves: %v", err), nil
	}
	if resp["id"] == nil {
		return "Erro: o banco não devolveu o ID do registo; pode não ter sido salvo.", nil
	}

	// Estado do lote já com este evento, para o produtor ver na hora.
	vivas := qtd
	if atual != nil {
		vivas = atual.Vivas()
		switch {
		case evento == "entrada":
			vivas += qtd
		case ev.Saida:
			vivas -= qtd
		}
	}
	return map[string]interface{}{
		"status":       "success",
		"lote":         lote,
		"aves_no_lote": vivas,
		"message": fmt.Sprintf("Registado: %s (%s %s) no %s. O lote fica com %s aves. Confirme em uma frase curta, citando o lote e o total de aves.",
			payload["produto"], numeroCurto(qtd), ev.Unidade, lote, numeroCurto(vivas)),
	}, nil
}

func (s *Server) handleConsultarAvicultura(ctx context.Context, args map[string]interface{}, tenant TenantCtx) (interface{}, error) {
	regs, err := s.supabase.ListarAvicultura(ctx, tenant.PmoID)
	if err != nil {
		return nil, fmt.Errorf("erro ao ler os lotes de aves: %w", err)
	}
	agora := time.Now().In(utils.TimezoneSistema())
	lotes := ResumirLotes(regs, agora)
	if pedido := sanitize(args["lote"]); pedido != "" {
		var so []*LoteAves
		for _, l := range lotes {
			if strings.EqualFold(l.Nome, pedido) {
				so = append(so, l)
			}
		}
		lotes = so
	}
	return map[string]interface{}{
		"status":          "success",
		"resposta_direta": TextoAvicultura(tenant.Telefone, lotes, agora),
		"message":         "Resumo das aves enviado ao produtor. Não recalcule os números.",
	}, nil
}

// TextoAvicultura: um bloco por lote ativo e uma linha com os encerrados.
func TextoAvicultura(phone string, lotes []*LoteAves, agora time.Time) string {
	mz := ehMZ(phone)
	var ativos, encerrados []*LoteAves
	for _, l := range lotes {
		if l.Vivas() > 0 {
			ativos = append(ativos, l)
		} else {
			encerrados = append(encerrados, l)
		}
	}
	if len(ativos) == 0 && len(encerrados) == 0 {
		if mz {
			return "Ainda não há aves registadas. Diga, por exemplo: *entraram 100 pintos de corte hoje*."
		}
		return "Ainda não há aves registradas. Diga, por exemplo: *entraram 100 pintinhos de corte hoje*."
	}
	sort.SliceStable(ativos, func(i, j int) bool { return ativos[i].Inicio < ativos[j].Inicio })

	var blocos []string
	for _, l := range ativos {
		var b strings.Builder
		b.WriteString("🐔 *" + l.Nome + "*")
		if l.Finalidade != "" {
			b.WriteString(" · " + l.Finalidade)
		}
		if l.Inicio != "" {
			b.WriteString(" · desde " + dataCurta(l.Inicio, agora))
		}
		fmt.Fprintf(&b, "\n• Aves: %s (entraram %s", numeroCurto(l.Vivas()), numeroCurto(l.Entradas))
		if l.Mortas > 0 {
			b.WriteString(" · morreram " + numeroCurto(l.Mortas))
		}
		if l.Abatidas > 0 {
			b.WriteString(" · abatidas " + numeroCurto(l.Abatidas))
		}
		if l.Saidas > 0 {
			b.WriteString(" · saíram " + numeroCurto(l.Saidas))
		}
		b.WriteString(")")
		if l.Entradas > 0 {
			b.WriteString("\n• Mortalidade: " + numeroCurto(arred1(100*l.Mortas/l.Entradas)) + "%")
		}
		if l.Ovos7d > 0 {
			porDia := l.Ovos7d / 7
			fmt.Fprintf(&b, "\n• Ovos: %s nos últimos 7 dias (%s/dia", numeroCurto(l.Ovos7d), numeroCurto(arred1(porDia)))
			if v := l.Vivas(); v > 0 {
				b.WriteString(" · " + numeroCurto(arred1(100*porDia/v)) + "% de postura")
			}
			b.WriteString(")")
		}
		if l.DataVacina != "" {
			b.WriteString("\n• Última vacina: " + l.Vacina + ", " + dataCurta(l.DataVacina, agora))
		}
		if l.PesoMedio > 0 {
			b.WriteString("\n• Peso médio: " + numeroCurto(arred1(l.PesoMedio)) + " kg (" + dataCurta(l.DataPeso, agora) + ")")
		}
		blocos = append(blocos, b.String())
	}
	if len(encerrados) > 0 {
		nomes := make([]string, len(encerrados))
		for i, l := range encerrados {
			nomes[i] = l.Nome
		}
		blocos = append(blocos, "_Lotes encerrados: "+strings.Join(nomes, ", ")+"_")
	}
	return strings.Join(blocos, "\n\n")
}

func arred1(f float64) float64 { return float64(int64(f*10+0.5)) / 10 }
