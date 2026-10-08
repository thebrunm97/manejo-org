package mcp

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/thebrunm97/pmo-bot-go/internal/weather"
	"github.com/thebrunm97/pmo-bot-go/internal/zae"
)

func servidorComZae(t *testing.T) *Server {
	t.Helper()
	tab, err := zae.Carregar()
	require.NoError(t, err)
	s := NewServer(nil, nil, nil, nil)
	s.SetZaeTabela(tab)
	return s
}

func consultarMZ(t *testing.T, s *Server, cultura, local string) map[string]interface{} {
	t.Helper()
	res, err := s.handleConsultarJanelaPlantio(context.Background(), map[string]interface{}{
		"cultura": cultura, "cidade_informada": local,
	}, TenantCtx{})
	require.NoError(t, err, "falta de dado em Moçambique não pode virar erro")
	return exigeMapa(t, res)
}

func TestJanelaMocambiqueEncontraReferencia(t *testing.T) {
	m := consultarMZ(t, servidorComZae(t), "milho", "Boane, Maputo")

	require.Equal(t, "referencia_nao_oficial", m["status"])
	require.Equal(t, "Moçambique", m["pais"])
	require.Equal(t, false, m["localizacao_aproximada"], "Boane está inteiro na R1")

	janelas, ok := m["janelas_referencia"].([]zae.Janela)
	require.True(t, ok)
	require.NotEmpty(t, janelas)
	for _, j := range janelas {
		require.Equal(t, "R1", j.Zona)
		require.NotEmpty(t, j.Fonte, "sem revisor local, a fonte é a única garantia — não pode sumir")
		require.NotEmpty(t, j.FonteURL)
		require.NotEmpty(t, j.SementeiraInicio)
	}
	require.Contains(t, m["message"], "NÃO tem zoneamento oficial")
	_, temRisco := m["janelas"]
	require.False(t, temRisco, "resposta de Moçambique não pode ter o formato do ZARC")
}

func TestJanelaMocambiqueDistritoEmVariasZonas(t *testing.T) {
	m := consultarMZ(t, servidorComZae(t), "feijão", "Manhiça, Maputo")

	require.Equal(t, true, m["localizacao_aproximada"])
	zonas, ok := m["zonas_agroecologicas"].([]zae.ZonaDoDistrito)
	require.True(t, ok)
	require.Len(t, zonas, 3, "Manhiça cruza R1, R2 e R3")
}

func TestJanelaMocambiqueSemDadoNaoInventa(t *testing.T) {
	m := consultarMZ(t, servidorComZae(t), "tomate", "Boane, Maputo")

	require.Equal(t, "sem_dado", m["status"])
	require.NotEmpty(t, m["culturas_com_dado_na_zona"], "oferece o que existe em vez de beco sem saída")
	require.Contains(t, m["message"], "NÃO invente")
	require.Nil(t, m["janelas_referencia"])
}

func TestJanelaMocambiqueDistritoDesconhecido(t *testing.T) {
	// Maputo (província) não tem linha "*": distrito fora da lista pede confirmação.
	m := consultarMZ(t, servidorComZae(t), "milho", "Inventado, Maputo")
	require.Equal(t, "requires_user_input", m["status"])
}

func TestJanelaMocambiqueSemTabela(t *testing.T) {
	s := servidorComReferencia(t) // tabela do Brasil carregada, a de Moçambique não
	m := consultarMZ(t, s, "milho", "Boane, Maputo")
	require.Equal(t, "unavailable", m["status"])
}

func TestJanelaMocambiqueAnexaInicioDasChuvas(t *testing.T) {
	s := servidorComZae(t)
	var consultado string
	s.SetInicioChuvas(func(_ context.Context, local, pais string) (*weather.SituacaoChuvas, error) {
		consultado = local + "/" + pais
		return &weather.SituacaoChuvas{Status: "inicio_recente"}, nil
	})

	m := consultarMZ(t, s, "milho", "Boane, Maputo") // milho tem 1ª época na R1
	require.Equal(t, "Boane/MZ", consultado)
	situacao, ok := m["inicio_das_chuvas"].(*weather.SituacaoChuvas)
	require.True(t, ok)
	require.Equal(t, "inicio_recente", situacao.Status)
}

func TestJanelaMocambiqueSemIndicadorQuandoFalha(t *testing.T) {
	s := servidorComZae(t)
	s.SetInicioChuvas(func(context.Context, string, string) (*weather.SituacaoChuvas, error) {
		return nil, fmt.Errorf("sem rede")
	})
	m := consultarMZ(t, s, "milho", "Boane, Maputo")
	require.Equal(t, "referencia_nao_oficial", m["status"], "falha do indicador não derruba a resposta")
	require.Nil(t, m["inicio_das_chuvas"])
}

func TestPaisDoTenantPeloDDISemPropriedade(t *testing.T) {
	s := NewServer(nil, nil, nil, nil)
	require.Equal(t, "MZ", s.paisDoTenant(TenantCtx{Telefone: "258841234567"}))
	require.Equal(t, "", s.paisDoTenant(TenantCtx{Telefone: "5511999999999"}), "sem propriedade e sem DDI conhecido: sem filtro")
}

func TestJanelaMocambiqueIncluiVariedadesIIAM(t *testing.T) {
	m := consultarMZ(t, servidorComZae(t), "milho", "Boane, Maputo")
	vs, ok := m["variedades_iiam"].([]zae.Variedade)
	require.True(t, ok, "milho tem variedades no catálogo do IIAM")
	require.NotEmpty(t, vs)
	for _, v := range vs {
		require.Equal(t, "milho", v.Cultura)
		require.NotEmpty(t, v.Ficha, "o bot responde a partir do texto da ficha")
		require.Positive(t, v.Pagina)
	}
	require.Contains(t, m["message"], "variedades_iiam")
}

func TestJanelaMocambiqueSemJanelaMasComVariedades(t *testing.T) {
	// Tomate: sem janela na FAO para a R1, mas com variedades do IIAM.
	m := consultarMZ(t, servidorComZae(t), "tomate", "Boane, Maputo")
	require.Equal(t, "sem_dado", m["status"])
	vs, ok := m["variedades_iiam"].([]zae.Variedade)
	require.True(t, ok)
	require.NotEmpty(t, vs)
}

func TestJanelaMocambiqueMorangoDoManualDeHorticultura(t *testing.T) {
	m := consultarMZ(t, servidorComZae(t), "morango", "Boane, Maputo")
	require.Equal(t, "referencia_nao_oficial", m["status"])
	js := m["janelas_referencia"].([]zae.Janela)
	require.Len(t, js, 1)
	require.Equal(t, "21/03", js[0].SementeiraInicio)
	require.Contains(t, js[0].Fonte, "Horticultura em Moçambique")
}
