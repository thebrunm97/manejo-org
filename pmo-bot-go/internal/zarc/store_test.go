package zarc

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// A fixture é construída a partir do schema REAL (deploy/zarc/schema.sql), não
// de um CREATE TABLE copiado para cá. Assim, mudar o schema sem mexer no
// store.go quebra estes testes — que é exatamente o alarme que se quer ter.
// Também evita versionar um .sqlite binário no repositório.
func fixture(t *testing.T) *Store {
	t.Helper()

	raiz := filepath.Join("..", "..", "..")
	schema, err := os.ReadFile(filepath.Join(raiz, "deploy", "zarc", "schema.sql"))
	require.NoError(t, err, "schema.sql precisa existir — é a definição autoritativa")
	indexes, err := os.ReadFile(filepath.Join(raiz, "deploy", "zarc", "indexes.sql"))
	require.NoError(t, err)

	caminho := filepath.Join(t.TempDir(), "zarc-minimal.sqlite")
	db, err := sql.Open("sqlite", caminho)
	require.NoError(t, err)
	_, err = db.Exec(string(schema) + "\n" + string(indexes))
	require.NoError(t, err)

	// Dois municípios, um deles com acento no nome (é o que exercita a
	// normalização casada entre o Python do build e o Go daqui).
	_, err = db.Exec(`
		INSERT INTO municipios VALUES
			('3550308','SP','São Paulo','sao paulo','01','001'),
			('3203130','ES','João Neiva','joao neiva','02','006'),
			('3106200','MG','Belo Horizonte','belo horizonte','03','010');

		INSERT INTO culturas VALUES
			(1,'12016740174021','Sorgo Granífero 2ª Safra','sorgo granifero 2ª safra'),
			(2,'12016740174022','Cebola','cebola'),
			(3,'12016740174023','Batata Mesa','batata mesa');

		INSERT INTO manejos VALUES (1,'Sequeiro'), (2,'Irrigado');
		INSERT INTO solos (cod) VALUES (1), (2);
		INSERT INTO ciclos (cod) VALUES (21), (22);
		INSERT INTO climas VALUES (0,'Não se aplica');
	`)
	require.NoError(t, err)

	// Linha de controle real, conferida contra o CSV da safra 2026/2027:
	// Sorgo Granífero 2ª Safra em João Neiva/ES, ciclo 22, solo 1. A janela
	// atravessa a virada do ano (dec27→dec6), que é o caso difícil.
	sorgo := []byte{20, 30, 30, 30, 40, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 40, 40, 40, 30, 30, 30, 30, 30, 30, 20}
	// Cebola em São Paulo: perene/olerícola, entra com safra_ini = 0.
	cebola := make([]byte, 36)
	for i := 6; i <= 11; i++ {
		cebola[i] = 20
	}

	_, err = db.Exec(
		`INSERT INTO janelas (safra_ini, safra_fim, cultura_id, geocodigo, cod_ciclo,
		   cod_solo, cod_manejo, cod_clima, portaria, riscos) VALUES
		   (2026, 2027, 1, '3203130', 22, 1, 1, 0, 'Port. 272_de_22-07-2026', ?),
		   (0,    NULL, 2, '3550308', 21, 1, 1, 0, 'Port. 435_de_28-12-2023', ?)`,
		sorgo, cebola)
	require.NoError(t, err)
	require.NoError(t, db.Close())

	s, err := Open(caminho)
	require.NoError(t, err)
	t.Cleanup(func() { s.Close() })
	return s
}

func TestNormalizarCasaComOBuildPython(t *testing.T) {
	// Os valores esperados são os que scripts/ingestion/zarc_build.py grava em
	// nome_norm. Divergir aqui significa o bot não achar município nenhum.
	require.Equal(t, "sao paulo", Normalizar("São Paulo"))
	require.Equal(t, "joao neiva", Normalizar("João Neiva"))
	// NFD nao decompoe U+00AA ("a" ordinal): o indicador sobrevive à normalização,
	// em Go e em Python igualmente. O que importa é que os dois concordem.
	require.Equal(t, "sorgo granifero 2ª safra", Normalizar("Sorgo Granífero 2ª Safra"))
	require.Equal(t, "cebola", Normalizar("  CEBOLA  "))
}

func TestSepararCidadeUF(t *testing.T) {
	casos := []struct {
		entrada, cidade, uf string
	}{
		{"São Paulo,SP", "São Paulo", "SP"},
		{"Uberlândia, MG", "Uberlândia", "MG"},
		{"João Neiva/ES", "João Neiva", "ES"},
		{"Belo Horizonte - MG", "Belo Horizonte", "MG"},
		// Sem UF reconhecível: devolve a string inteira como cidade e UF vazia,
		// e é o handler que pede o estado ao produtor.
		{"Uberlândia", "Uberlândia", ""},
		{"Santa Rita do Sapucaí", "Santa Rita do Sapucaí", ""},
		{"", "", ""},
	}
	for _, c := range casos {
		cidade, uf := SepararCidadeUF(c.entrada)
		require.Equal(t, c.cidade, cidade, "cidade de %q", c.entrada)
		require.Equal(t, c.uf, uf, "uf de %q", c.entrada)
	}
}

func TestResolverMunicipioIgnoraAcento(t *testing.T) {
	s := fixture(t)
	ctx := context.Background()

	geo, err := s.ResolverMunicipio(ctx, "São Paulo", "SP")
	require.NoError(t, err)
	require.Equal(t, "3550308", geo)

	geo, err = s.ResolverMunicipio(ctx, "sao paulo", "sp")
	require.NoError(t, err)
	require.Equal(t, "3550308", geo, "produtor digitando sem acento tem de achar o mesmo município")

	// Município inexistente não é erro: é caso de perguntar ao produtor.
	geo, err = s.ResolverMunicipio(ctx, "Cidade Que Não Existe", "SP")
	require.NoError(t, err)
	require.Empty(t, geo)
}

func TestBuscarJanelasEncontraCulturaPerene(t *testing.T) {
	s := fixture(t)

	// Regressão do bug que teria quebrado a funcionalidade para o público-alvo:
	// a cebola entra com safra_ini = 0 e o sorgo com 2026. Uma consulta que
	// filtrasse por uma safra só devolveria a cebola como "não zoneada".
	require.Equal(t, 2026, s.SafraVigente())

	janelas, err := s.BuscarJanelas(context.Background(), "3550308", "Cebola")
	require.NoError(t, err)
	require.Len(t, janelas, 1)
	require.Equal(t, "Cebola", janelas[0].Cultura)
	require.Equal(t, "Sequeiro", janelas[0].Manejo)
	require.Equal(t, "Port. 435_de_28-12-2023", janelas[0].Portaria)
}

func TestBuscarJanelasCulturaNaoZoneada(t *testing.T) {
	s := fixture(t)
	ctx := context.Background()

	// O ZARC não cobre tomate — o caso mais comum do nosso público. Tem de ser
	// resultado vazio SEM erro, para o handler responder "não zoneada".
	janelas, err := s.BuscarJanelas(ctx, "3550308", "Tomate")
	require.NoError(t, err)
	require.Empty(t, janelas)

	// Cultura existe na base, mas não naquele município.
	janelas, err = s.BuscarJanelas(ctx, "3106200", "Cebola")
	require.NoError(t, err)
	require.Empty(t, janelas)

	disponiveis, err := s.CulturasDisponiveis(ctx, "3550308")
	require.NoError(t, err)
	require.Equal(t, []string{"Cebola"}, disponiveis)
}

func TestDecodificarRiscosFechaOCicloDoAno(t *testing.T) {
	// Mesma linha de controle de João Neiva/ES. 2027 não é bissexto, então
	// fevereiro termina em 28 — fixar o ano mantém o teste determinístico.
	sorgo := []byte{20, 30, 30, 30, 40, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
		0, 0, 0, 0, 0, 0, 0, 0, 40, 40, 40, 30, 30, 30, 30, 30, 30, 20}

	p := decodificarRiscos(sorgo, 2027)
	require.Len(t, p, 5)

	// O decêndio 36 (21–31/12) e o 1 (01–10/01) têm o mesmo risco: são UMA
	// janela que atravessa o Ano-Novo, não duas soltas.
	require.Equal(t, Periodo{Risco: 20, Inicio: "21/12", Fim: "10/01"}, p[0])
	require.Equal(t, Periodo{Risco: 30, Inicio: "11/01", Fim: "10/02"}, p[1])
	require.Equal(t, Periodo{Risco: 40, Inicio: "11/02", Fim: "28/02"}, p[2])
	require.Equal(t, Periodo{Risco: 40, Inicio: "21/09", Fim: "20/10"}, p[3])
	require.Equal(t, Periodo{Risco: 30, Inicio: "21/10", Fim: "20/12"}, p[4])
}

func TestDecodificarRiscosCasosDeBorda(t *testing.T) {
	require.Nil(t, decodificarRiscos(nil, 2027))
	require.Nil(t, decodificarRiscos(make([]byte, 12), 2027), "tamanho errado não pode virar janela")
	require.Empty(t, decodificarRiscos(make([]byte, 36), 2027), "tudo zero é cultura sem indicação")

	// Ano inteiro liberado no mesmo risco: o fechamento do ciclo NÃO pode
	// colapsar o único período em algo sem sentido.
	tudo := make([]byte, 36)
	for i := range tudo {
		tudo[i] = 20
	}
	p := decodificarRiscos(tudo, 2027)
	require.Len(t, p, 1)
	require.Equal(t, Periodo{Risco: 20, Inicio: "01/01", Fim: "31/12"}, p[0])

	// Fevereiro em ano bissexto termina em 29.
	fev := make([]byte, 36)
	fev[5] = 30
	p = decodificarRiscos(fev, 2028)
	require.Equal(t, Periodo{Risco: 30, Inicio: "21/02", Fim: "29/02"}, p[0])
}

func TestOpenArquivoInexistenteNaoDerruba(t *testing.T) {
	// O bot precisa subir sem a base: é o caso normal em staging e na máquina
	// do desenvolvedor, onde ninguém quer os ~400 MB.
	s, err := Open(filepath.Join(t.TempDir(), "nao-existe.sqlite"))
	require.Error(t, err)
	require.Nil(t, s)
}
