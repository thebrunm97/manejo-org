package mcp

import (
	"bufio"
	"encoding/json"
	"os"
	"testing"
)

// TestConjuntoRoteamentoValido confere eval/roteamento/mensagens.jsonl: ids
// únicos, intenção conhecida do roteador e ferramentas que existem. Se uma
// ferramenta for renomeada, este teste aponta os rótulos que ficaram velhos.
func TestConjuntoRoteamentoValido(t *testing.T) {
	f, err := os.Open("../../eval/roteamento/mensagens.jsonl")
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()

	s := &Server{tools: make(map[string]Tool)}
	s.InitializeTools()
	intencoes := map[string]bool{"AGRONOMY": true, "DATABASE": true, "CHAT": true, "CLARIFICATION": true, "SCHEDULING": true, "WORKFLOW": true}

	ids := map[string]bool{}
	sc := bufio.NewScanner(f)
	n := 0
	for sc.Scan() {
		n++
		var m struct {
			ID          string   `json:"id"`
			Texto       string   `json:"texto"`
			Intencao    string   `json:"intencao"`
			Ferramentas []string `json:"ferramentas"`
		}
		if err := json.Unmarshal(sc.Bytes(), &m); err != nil {
			t.Fatalf("linha %d: %v", n, err)
		}
		if m.ID == "" || ids[m.ID] || m.Texto == "" {
			t.Errorf("linha %d: id vazio/repetido ou texto vazio (%q)", n, m.ID)
		}
		ids[m.ID] = true
		if !intencoes[m.Intencao] {
			t.Errorf("%s: intenção %q não existe no roteador", m.ID, m.Intencao)
		}
		for _, nome := range m.Ferramentas {
			if _, ok := s.tools[nome]; !ok {
				t.Errorf("%s: ferramenta %q não está registrada", m.ID, nome)
			}
		}
	}
	if n < 200 {
		t.Errorf("conjunto pequeno demais: %d mensagens", n)
	}
}
