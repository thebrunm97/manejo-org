package mcp

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/thebrunm97/pmo-bot-go/internal/plantioref"
	"github.com/thebrunm97/pmo-bot-go/internal/zarc"
)

// servidorComZarc devolve um Server com uma base ZARC mínima ligada.
//
// O schema sai de deploy/zarc/schema.sql, o mesmo arquivo que o build de
// produção usa: uma mudança de schema que quebre o store aparece aqui.
// O driver do SQLite já vem registrado pelo import de internal/zarc.
func servidorComZarc(t *testing.T) *Server {
	t.Helper()

	raiz := filepath.Join("..", "..", "..")
	schema, err := os.ReadFile(filepath.Join(raiz, "deploy", "zarc", "schema.sql"))
	require.NoError(t, err)

	caminho := filepath.Join(t.TempDir(), "zarc.sqlite")
	db, err := sql.Open("sqlite", caminho)
	require.NoError(t, err)
	_, err = db.Exec(string(schema))
	require.NoError(t, err)

	// Cebola em São Paulo, indicada nos decêndios 7 a 12 (março e abril).
	riscos := make([]byte, 36)
	for i := 6; i <= 11; i++ {
		riscos[i] = 20
	}
	_, err = db.Exec(`
		INSERT INTO municipios VALUES ('3550308','SP','São Paulo','sao paulo','01','001');
		INSERT INTO culturas   VALUES (1,'12016740174022','Cebola','cebola');
		INSERT INTO manejos    VALUES (1,'Sequeiro');
		INSERT INTO solos (cod) VALUES (1);
		INSERT INTO ciclos (cod) VALUES (21);
	`)
	require.NoError(t, err)
	_, err = db.Exec(
		`INSERT INTO janelas (safra_ini, safra_fim, cultura_id, geocodigo, cod_ciclo,
		   cod_solo, cod_manejo, cod_clima, portaria, riscos)
		 VALUES (0, NULL, 1, '3550308', 21, 1, 1, 0, 'Port. 435_de_28-12-2023', ?)`,
		riscos)
	require.NoError(t, err)
	require.NoError(t, db.Close())

	store, err := zarc.Open(caminho)
	require.NoError(t, err)
	t.Cleanup(func() { store.Close() })

	s := NewServer(nil, nil, nil, nil)
	s.SetZarcStore(store)
	return s
}

// servidorComReferencia liga a tabela REAL embarcada em internal/plantioref,
// não uma sintética: é ela que vai a produção, e o valor deste teste é
// justamente afirmar que o piloto (tomate, alface, cenoura) responde de
// verdade — sem base ZARC nenhuma.
func servidorComReferencia(t *testing.T) *Server {
	t.Helper()
	tab, err := plantioref.Carregar()
	require.NoError(t, err)

	s := NewServer(nil, nil, nil, nil)
	s.SetPlantioRef(tab)
	return s
}

// servidorComZarcEReferencia liga as duas fontes, para os testes de
// precedência: o dado oficial não pode nunca ser ofuscado pela referência.
func servidorComZarcEReferencia(t *testing.T) *Server {
	t.Helper()
	s := servidorComZarc(t)
	tab, err := plantioref.Carregar()
	require.NoError(t, err)
	s.SetPlantioRef(tab)
	return s
}

// O contrato desta ferramenta com o LLM é: falta de informação NUNCA vira erro.
// Vira um mapa com "status" e uma instrução em "message" para o agente conduzir
// a conversa — o mesmo padrão de tools_weather.go. Se algum destes caminhos
// passar a devolver error, o agente recebe uma falha genérica no lugar de uma
// instrução, e a resposta ao produtor degrada para "não consegui consultar".
func TestJanelaPlantioDegradaSemErro(t *testing.T) {
	ctx := context.Background()

	t.Run("sem base carregada", func(t *testing.T) {
		// Ambiente sem o arquivo de ~400 MB: staging e máquina do dev. A
		// checagem vem antes de qualquer outra de propósito — sem base, o
		// resto da validação não muda a resposta.
		s := NewServer(nil, nil, nil, nil)
		res, err := s.handleConsultarJanelaPlantio(ctx, map[string]interface{}{"cultura": "Cebola"}, TenantCtx{})
		require.NoError(t, err)
		require.Equal(t, "unavailable", exigeMapa(t, res)["status"])
	})

	casos := []struct {
		nome string
		args map[string]interface{}
	}{
		{"sem cultura informada", map[string]interface{}{}},
		{"cultura em branco", map[string]interface{}{"cultura": "   "}},
		// Sem propriedade na sessão e sem cidade na frase, não há de onde tirar
		// o município — o agente tem de perguntar.
		{"sem localização de nenhuma fonte", map[string]interface{}{"cultura": "Cebola"}},
		// UF é obrigatória no ZARC: há municípios homônimos entre estados.
		{"cidade sem UF", map[string]interface{}{"cultura": "Cebola", "cidade_informada": "São Paulo"}},
		{"município fora da base", map[string]interface{}{"cultura": "Cebola", "cidade_informada": "Xique-Xique, BA"}},
	}
	for _, c := range casos {
		t.Run(c.nome, func(t *testing.T) {
			s := servidorComZarc(t)
			res, err := s.handleConsultarJanelaPlantio(ctx, c.args, TenantCtx{})
			require.NoError(t, err, "falta de informação não pode virar erro")

			m := exigeMapa(t, res)
			require.Equal(t, "requires_user_input", m["status"])
			require.NotEmpty(t, m["message"], "o LLM precisa de uma instrução, não só de um status")
		})
	}
}

func TestJanelaPlantioEncontraJanela(t *testing.T) {
	s := servidorComZarc(t)

	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura":          "cebola", // minúsculo e sem acento, como o produtor escreve
		"cidade_informada": "Sao Paulo, SP",
	}, TenantCtx{})
	require.NoError(t, err)

	m := exigeMapa(t, res)
	require.Equal(t, "ok", m["status"])
	janelas, ok := m["janelas"].([]zarc.Janela)
	require.True(t, ok)
	require.Len(t, janelas, 1)
	require.Equal(t, "Cebola", janelas[0].Cultura)
	require.Equal(t, "Port. 435_de_28-12-2023", janelas[0].Portaria,
		"a Portaria é o que dá valor de auditoria à resposta — não pode sumir")
	require.NotEmpty(t, janelas[0].Periodos)
}

func TestJanelaPlantioCulturaNaoZoneada(t *testing.T) {
	s := servidorComZarc(t)

	// Tomate não existe no ZARC. É o caso mais comum do nosso público, e tem
	// de ser uma resposta útil — com as culturas que existem — e não um erro.
	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura":          "Tomate",
		"cidade_informada": "São Paulo/SP",
	}, TenantCtx{})
	require.NoError(t, err)

	m := exigeMapa(t, res)
	require.Equal(t, "nao_zoneada", m["status"])
	require.Equal(t, []string{"Cebola"}, m["culturas_zoneadas"])
	require.Contains(t, m["message"], "NÃO invente datas",
		"sem esta instrução o modelo preenche a lacuna com data inventada")
}

// A ferramenta tem de estar registrada e com o schema que o TestCheckTools
// valida. Este teste cobre o que aquele não cobre: que o nome não mudou por
// acidente e que "cultura" continua sendo o único parâmetro obrigatório —
// exigir a cidade quebraria o caso normal, em que ela vem da sessão.
func TestJanelaPlantioRegistradaComSchemaEsperado(t *testing.T) {
	s := NewServer(nil, nil, nil, nil)
	s.InitializeTools()

	tool, ok := s.tools["consultar_janela_plantio"]
	require.True(t, ok, "ferramenta não registrada em InitializeTools")
	require.Equal(t, CategoryRAG, tool.Category, "é leitura de dado de referência")

	props, ok := tool.Definition.Parameters["properties"].(map[string]interface{})
	require.True(t, ok)
	require.Contains(t, props, "cultura")
	require.Contains(t, props, "cidade_informada")

	require.Equal(t, []string{"cultura"}, tool.Definition.Parameters["required"],
		"a cidade vem da propriedade da sessão; exigi-la do LLM quebraria o fluxo normal")
}

// --- internal/plantioref: janelas de referência para culturas fora do ZARC ---

func TestJanelaPlantioCaiNaReferenciaQuandoZarcNaoZoneia(t *testing.T) {
	s := servidorComZarcEReferencia(t)

	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura":          "tomate",
		"cidade_informada": "São Paulo/SP",
	}, TenantCtx{})
	require.NoError(t, err)

	m := exigeMapa(t, res)
	require.Equal(t, "referencia_nao_oficial", m["status"])
	require.NotEmpty(t, m["janelas_referencia"])
	msg, _ := m["message"].(string)
	require.Contains(t, msg, "NÃO é o ZARC")
	require.Contains(t, msg, "crédito rural")
	require.Contains(t, msg, "seguro agrícola")
}

// O teste que impede a regressão que a feature inteira existe para evitar: se
// o retorno de referência se parecer com o do ZARC, o LLM funde os dois na
// mesma frase e o produtor não distingue dado oficial de literatura.
func TestRetornoDeReferenciaNaoPareceZarc(t *testing.T) {
	s := servidorComReferencia(t)

	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura":          "alface",
		"cidade_informada": "Belo Horizonte, MG",
	}, TenantCtx{})
	require.NoError(t, err)

	m := exigeMapa(t, res)
	require.Equal(t, "referencia_nao_oficial", m["status"])

	_, temJanelasOficiais := m["janelas"]
	require.False(t, temJanelasOficiais, "retorno de referência não pode ter a chave \"janelas\", reservada ao ZARC oficial")
	_, temPortaria := m["portaria"]
	require.False(t, temPortaria, "retorno de referência não pode ter \"portaria\"")

	// A palavra "risco" aparece de propósito na mensagem — é o próprio texto
	// que instrui o LLM a NÃO inventar percentual de risco. O que não pode
	// existir é um CAMPO de risco, como zarc.Periodo tem ("risco_percentual").
	serializado, err := json.Marshal(m)
	require.NoError(t, err)
	require.NotContains(t, string(serializado), "risco_percentual", "retorno de referência não pode ter um campo de risco percentual, exclusivo do ZARC")

	// dd/mm é o formato exclusivo do ZARC (zarc.Periodo). Checado só nos campos
	// voltados ao produtor — mes_inicio/mes_fim (por extenso) e a mensagem —
	// não no JSON inteiro, que inclui a fonte_url e teria falsos positivos
	// (ex.: um id de documento como ".../1355126/2502095/..." bate ##/##).
	refs, ok := m["janelas_referencia"].([]plantioref.JanelaRef)
	require.True(t, ok, "janelas_referencia deveria ser []plantioref.JanelaRef")
	for _, r := range refs {
		require.NotRegexp(t, `\d{2}/\d{2}`, r.MesInicio, "mes_inicio deve estar por extenso, nunca dd/mm")
		require.NotRegexp(t, `\d{2}/\d{2}`, r.MesFim, "mes_fim deve estar por extenso, nunca dd/mm")
	}
	require.NotRegexp(t, `\d{2}/\d{2}`, m["message"], "a mensagem ao LLM não pode conter datas dd/mm")
}

func TestJanelaPlantioUsaReferenciaSemBaseZarc(t *testing.T) {
	s := servidorComReferencia(t) // sem SetZarcStore

	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura":          "cenoura",
		"cidade_informada": "Uberlândia, MG",
	}, TenantCtx{})
	require.NoError(t, err)

	m := exigeMapa(t, res)
	require.NotEqual(t, "unavailable", m["status"], "referência não depende do arquivo do ZARC")
	require.Equal(t, "referencia_nao_oficial", m["status"])
}

func TestZarcOficialTemPrecedenciaSobreReferencia(t *testing.T) {
	s := servidorComZarcEReferencia(t)

	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura":          "cebola",
		"cidade_informada": "Sao Paulo, SP",
	}, TenantCtx{})
	require.NoError(t, err)

	m := exigeMapa(t, res)
	require.Equal(t, "ok", m["status"], "dado oficial não pode ser ofuscado pela referência quando ambos existem")
	janelas, ok := m["janelas"].([]zarc.Janela)
	require.True(t, ok)
	require.NotEmpty(t, janelas[0].Portaria)
}

func TestSemZarcNemReferenciaMantemNaoZoneada(t *testing.T) {
	s := servidorComZarcEReferencia(t)

	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura":          "quiabo", // fora do ZARC e fora do piloto de referência
		"cidade_informada": "Sao Paulo, SP",
	}, TenantCtx{})
	require.NoError(t, err)

	m := exigeMapa(t, res)
	require.Equal(t, "nao_zoneada", m["status"])
	require.Contains(t, m["message"], "NÃO invente datas")
	culturasRef, ok := m["culturas_com_referencia"].([]string)
	require.True(t, ok)
	require.NotEmpty(t, culturasRef, "com a camada de referência ligada, o bot deveria poder oferecer o piloto")
}

func exigeMapa(t *testing.T, res interface{}) map[string]interface{} {
	t.Helper()
	m, ok := res.(map[string]interface{})
	require.True(t, ok, "handler deve devolver map[string]interface{}")
	return m
}
