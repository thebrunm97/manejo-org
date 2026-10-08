package weather

import (
	"fmt"
	"testing"
)

func serie(mm ...float64) ([]string, []float64) {
	datas := make([]string, len(mm))
	for i := range mm {
		datas[i] = fmt.Sprintf("d%02d", i)
	}
	return datas, mm
}

func repetir(v float64, n int) []float64 {
	out := make([]float64, n)
	for i := range out {
		out[i] = v
	}
	return out
}

func juntar(partes ...[]float64) []float64 {
	var out []float64
	for _, p := range partes {
		out = append(out, p...)
	}
	return out
}

func TestAvaliarInicioChuvas(t *testing.T) {
	casos := []struct {
		nome   string
		mm     []float64
		hoje   int
		status string
		inicio string
	}{
		{
			nome:   "seco o tempo todo",
			mm:     repetir(0, 37),
			hoje:   30,
			status: "ainda_nao",
		},
		{
			// 25 mm no dia 5, depois chuva regular: estabelecida há mais de 10 dias.
			nome:   "chuvas estabelecidas",
			mm:     juntar(repetir(0, 5), []float64{25}, repetir(3, 31)),
			hoje:   30,
			status: "estabelecidas",
			inicio: "d05",
		},
		{
			// 22 mm em 3 dias (8+8+6), seguidos de 15 dias secos: semente perdida.
			nome:   "falso início",
			mm:     juntar(repetir(0, 5), []float64{8, 8, 6}, repetir(0, 15), repetir(0.5, 14)),
			hoje:   30,
			status: "falso_inicio",
		},
		{
			// Falso início cedo e início verdadeiro depois: vale o verdadeiro.
			nome:   "falso início seguido de início real",
			mm:     juntar([]float64{30}, repetir(0, 12), []float64{25}, repetir(4, 23)),
			hoje:   30,
			status: "estabelecidas",
			inicio: "d13",
		},
		{
			// Choveu forte há 3 dias e a previsão segue úmida: começou, mas cedo para dizer.
			nome:   "início recente",
			mm:     juntar(repetir(0, 27), []float64{21}, repetir(2, 9)),
			hoje:   30,
			status: "inicio_recente",
			inicio: "d27",
		},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			datas, mm := serie(c.mm...)
			s := AvaliarInicioChuvas(datas, mm, c.hoje)
			if s.Status != c.status || s.InicioProvavel != c.inicio {
				t.Errorf("= %s/%q, queria %s/%q", s.Status, s.InicioProvavel, c.status, c.inicio)
			}
			if s.Criterio == "" || s.Fonte == "" {
				t.Error("o indicador precisa dizer o critério e a fonte")
			}
		})
	}
}

func TestAvaliarInicioChuvasSomas(t *testing.T) {
	datas, mm := serie(juntar(repetir(1, 31), repetir(2, 7))...)
	s := AvaliarInicioChuvas(datas, mm, 30)
	if s.ChuvaUlt30dMM != 30 || s.ChuvaUlt10dMM != 10 || s.PrevisaoProx7d != 14 {
		t.Errorf("somas erradas: 30d=%v 10d=%v prev=%v", s.ChuvaUlt30dMM, s.ChuvaUlt10dMM, s.PrevisaoProx7d)
	}
}
