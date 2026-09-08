// Package zarc lê a tábua de risco do Zoneamento Agrícola de Risco Climático
// (ZARC/MAPA) a partir de um SQLite somente-leitura.
//
// O arquivo é construído FORA de produção, por scripts/ingestion/zarc_build.py,
// e montado como volume :ro no contêiner do bot. Não existe escrita em nenhum
// ponto deste pacote, e o mount read-only é a garantia de que não vai passar a
// existir por descuido — a base é dado público do MAPA, não estado da aplicação.
//
// Por que um arquivo e não um banco: o ZARC é somente-leitura, imutável entre
// safras e consultado por lookup pontual. Ver o cabeçalho de zarc_build.py para
// as alternativas descartadas (Supabase free e Postgres dedicado na VPS).
package zarc

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"strings"
	"time"
	"unicode"

	_ "modernc.org/sqlite" // SQLite puro Go: o Dockerfile compila com CGO_ENABLED=0

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// Store é a base do ZARC aberta para leitura.
type Store struct {
	db  *sql.DB
	sha string // sha256 do arquivo, logado no startup para rastrear a versão no ar

	// safraVigente sai de SELECT MAX(safra_ini) no Open, não do calendário.
	// A safra que vale é a que está DENTRO do arquivo: uma heurística de mês
	// erraria justamente na virada de safra, que é quando alguém pergunta.
	safraVigente int
}

// Periodo é uma faixa contígua de decêndios com o mesmo nível de risco, já
// traduzida em datas. O produtor não quer saber o que é "decêndio 7".
type Periodo struct {
	Risco  int    `json:"risco_percentual"` // 20, 30 ou 40
	Inicio string `json:"inicio"`           // "01/03"
	Fim    string `json:"fim"`              // "20/03"
}

// Janela é uma combinação de ciclo, solo e manejo com seus períodos indicados.
type Janela struct {
	Cultura  string    `json:"cultura"`
	Ciclo    string    `json:"ciclo,omitempty"`
	Solo     string    `json:"solo,omitempty"`
	Manejo   string    `json:"manejo,omitempty"`
	Portaria string    `json:"portaria,omitempty"`
	Periodos []Periodo `json:"periodos"`
}

// Open abre a base em modo somente-leitura.
//
// Um erro aqui NÃO é fatal para o bot: quem chama registra a ferramenta como
// indisponível e o resto do sistema segue. Ambientes de teste e a máquina do
// desenvolvedor normalmente não têm o arquivo de 300 MB.
func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", "file:"+path+"?mode=ro&_pragma=query_only(1)")
	if err != nil {
		return nil, fmt.Errorf("abrindo base ZARC em %s: %w", path, err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("base ZARC ilegível em %s: %w", path, err)
	}

	s := &Store{db: db, sha: hashArquivo(path)}
	if err := db.QueryRow(`SELECT COALESCE(MAX(safra_ini), 0) FROM janelas`).Scan(&s.safraVigente); err != nil {
		db.Close()
		return nil, fmt.Errorf("base ZARC sem tabela janelas utilizável: %w", err)
	}
	return s, nil
}

func (s *Store) Close() error { return s.db.Close() }

// SHA identifica qual build da base está carregado — o mesmo valor impresso
// pelo zarc_build.py e guardado no MANIFEST.txt junto do backup.
func (s *Store) SHA() string { return s.sha }

// SafraVigente é a safra mais recente presente no arquivo.
func (s *Store) SafraVigente() int { return s.safraVigente }

// ResolverMunicipio casa cidade+uf contra o nome normalizado gravado no build.
// Devolve string vazia (sem erro) quando não encontra: município desconhecido é
// um caso de perguntar ao produtor, não uma falha do sistema.
func (s *Store) ResolverMunicipio(ctx context.Context, cidade, uf string) (string, error) {
	var geo string
	err := s.db.QueryRowContext(ctx,
		`SELECT geocodigo FROM municipios WHERE nome_norm = ? AND uf = ?`,
		Normalizar(cidade), strings.ToUpper(strings.TrimSpace(uf)),
	).Scan(&geo)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return geo, nil
}

// BuscarJanelas devolve as janelas de plantio para o município e a cultura.
//
// A cultura casa por PREFIXO, não por igualdade. Os nomes do MAPA são longos e
// qualificados — "Sorgo Granífero 2ª Safra", "Café Arábica Produção", "Batata
// Mesa" — e o produtor no WhatsApp diz "sorgo", "café", "batata". Igualdade
// exata devolveria "não zoneada" para praticamente toda pergunta real. O
// prefixo também é o que faz uma pergunta sobre batata trazer as janelas de
// mesa E de indústria, que é a resposta certa.
//
// Slice vazio com erro nil significa "cultura não zoneada pelo ZARC", que é um
// resultado legítimo e frequente: o ZARC não cobre tomate, alface, couve nem
// cenoura, que estão entre as culturas mais comuns do nosso público.
//
// A busca cobre DUAS safras de uma vez, e isso não é detalhe de implementação:
// as culturas que mais importam aqui — cebola, alho, batata, mandioca, banana —
// vivem no arquivo "Perene, Olerícola e Sem Safra", que entra com safra_ini = 0.
// Só os grãos ficam nas safras datadas. Filtrar por uma safra só faria "cebola"
// voltar como não zoneada mesmo estando na base.
func (s *Store) BuscarJanelas(ctx context.Context, geocodigo, cultura string) ([]Janela, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT c.nome, ci.descricao, so.descricao, ma.nome, j.portaria, j.riscos
		  FROM janelas j
		  JOIN culturas c        ON c.id  = j.cultura_id
		  LEFT JOIN ciclos  ci   ON ci.cod = j.cod_ciclo
		  LEFT JOIN solos   so   ON so.cod = j.cod_solo
		  LEFT JOIN manejos ma   ON ma.cod = j.cod_manejo
		 WHERE j.geocodigo = ? AND c.nome_norm LIKE ? || '%'
		   AND j.safra_ini IN (0, ?)`,
		geocodigo, Normalizar(cultura), s.safraVigente)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	ano := time.Now().Year()
	var out []Janela
	for rows.Next() {
		var j Janela
		var ciclo, solo, manejo, portaria sql.NullString
		var riscos []byte
		if err := rows.Scan(&j.Cultura, &ciclo, &solo, &manejo, &portaria, &riscos); err != nil {
			return nil, err
		}
		// Ciclo e solo ficam nulos até o OCR do dicionário do MAPA rodar: as
		// descrições só existem naquele PDF, que é digitalizado.
		j.Ciclo, j.Solo, j.Manejo, j.Portaria = ciclo.String, solo.String, manejo.String, portaria.String
		j.Periodos = decodificarRiscos(riscos, ano)
		// Linha sem nenhum decêndio indicado não é janela — é ruído da fonte.
		if len(j.Periodos) > 0 {
			out = append(out, j)
		}
	}
	return out, rows.Err()
}

// CulturasDisponiveis alimenta a resposta de "cultura não zoneada": em vez de um
// beco sem saída, o bot lista o que o ZARC cobre naquele município.
func (s *Store) CulturasDisponiveis(ctx context.Context, geocodigo string) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT c.nome
		  FROM janelas j
		  JOIN culturas c ON c.id = j.cultura_id
		 WHERE j.geocodigo = ? AND j.safra_ini IN (0, ?)
		 ORDER BY c.nome`, geocodigo, s.safraVigente)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var nome string
		if err := rows.Scan(&nome); err != nil {
			return nil, err
		}
		out = append(out, nome)
	}
	return out, rows.Err()
}

// decodificarRiscos converte os 36 bytes (um por decêndio do ano civil, com o
// risco em porcentagem) em faixas contíguas de mesmo risco.
//
// Decêndio n: mês = (n-1)/3 + 1, terço = (n-1)%3, cobrindo os dias 1–10, 11–20
// e 21–fim do mês. O último terço vai até o fim real do mês, então fevereiro
// depende do ano — daí o parâmetro.
//
// Os 36 bytes são um CICLO, não uma linha do tempo com começo e fim: janelas de
// plantio atravessam a virada do ano com frequência. O sorgo 2ª safra em João
// Neiva/ES, por exemplo, vai do decêndio 27 (fim de setembro) ao 6 (fim de
// fevereiro). Sem o fechamento do ciclo no final desta função, esse plantio
// apareceria para o produtor como dois períodos soltos — "21/12 a 31/12" e
// "01/01 a 10/01" — em vez de um só, contínuo.
func decodificarRiscos(b []byte, ano int) []Periodo {
	if len(b) != 36 {
		return nil
	}
	var out []Periodo
	var atual *Periodo

	for i := 0; i < 36; i++ {
		risco := int(b[i])
		if risco == 0 {
			atual = nil // corta a faixa: decêndio não indicado
			continue
		}
		inicio, fim := limitesDecendio(i+1, ano)
		if atual != nil && atual.Risco == risco {
			atual.Fim = fim // estende a faixa em curso
			out[len(out)-1] = *atual
			continue
		}
		out = append(out, Periodo{Risco: risco, Inicio: inicio, Fim: fim})
		atual = &out[len(out)-1]
	}

	// Fecha o ciclo: se o ano termina e recomeça no mesmo risco, era uma faixa
	// só. Não se aplica quando há apenas um período — aí ele já cobre tudo.
	if len(out) > 1 && b[35] != 0 && b[35] == b[0] {
		ultimo := out[len(out)-1]
		out[0].Inicio = ultimo.Inicio
		out = out[:len(out)-1]
	}
	return out
}

// limitesDecendio devolve o primeiro e o último dia do decêndio, em "dd/mm".
func limitesDecendio(dec, ano int) (string, string) {
	mes := time.Month((dec-1)/3 + 1)
	terco := (dec - 1) % 3

	diaInicio := terco*10 + 1
	diaFim := diaInicio + 9
	if terco == 2 {
		// O terceiro decêndio absorve a sobra do mês: 21–28/29/30/31.
		diaFim = time.Date(ano, mes+1, 0, 0, 0, 0, 0, time.UTC).Day()
	}
	return fmt.Sprintf("%02d/%02d", diaInicio, mes), fmt.Sprintf("%02d/%02d", diaFim, mes)
}

// Normalizar produz minúsculas sem diacríticos.
//
// scripts/ingestion/zarc_build.py:normalizar faz o mesmo em Python (NFD +
// descarte de marcas de combinação). As duas TÊM de produzir a mesma string: é
// por nome_norm que "sao paulo" encontra "São Paulo".
func Normalizar(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	out, _, err := transform.String(t, strings.TrimSpace(s))
	if err != nil {
		return strings.ToLower(strings.TrimSpace(s))
	}
	return strings.ToLower(out)
}

// SepararCidadeUF quebra "Uberlândia, MG" em ("Uberlândia", "MG").
//
// Não há nada reaproveitável do caminho de clima: geocodeOpenMeteo faz um parse
// parecido, mas DESCARTA a UF, porque o Open-Meteo trabalha melhor só com o nome
// da cidade. Aqui a UF é obrigatória — há municípios homônimos entre estados
// (Bom Jesus existe em oito UFs).
//
// Aceita os separadores que GetPropriedadeLocation e o produtor produzem:
// vírgula, barra e hífen.
func SepararCidadeUF(s string) (cidade, uf string) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", ""
	}
	for _, sep := range []string{",", "/", " - ", "-"} {
		if i := strings.LastIndex(s, sep); i > 0 {
			possivelUF := strings.TrimSpace(s[i+len(sep):])
			// Só trata como UF se de fato parecer uma: senão "Santa Rita do
			// Sapucaí - Distrito" viraria cidade "Santa Rita do Sapucaí".
			if len(possivelUF) == 2 {
				return strings.TrimSpace(s[:i]), strings.ToUpper(possivelUF)
			}
		}
	}
	return s, ""
}

func hashArquivo(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return ""
	}
	return hex.EncodeToString(h.Sum(nil))
}
