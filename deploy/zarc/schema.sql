-- deploy/zarc/schema.sql — estrutura da base ZARC (SQLite, somente-leitura em produção)
--
-- Gerada por scripts/ingestion/zarc_build.py a partir dos CSVs abertos do MAPA
-- (dados.agricultura.gov.br, licença CC-BY). Este arquivo é a definição
-- autoritativa do schema: o script o lê e executa, não duplica os CREATE TABLE.
--
-- Os índices NÃO estão aqui de propósito — ver indexes.sql. Criá-los antes da
-- carga faria cada INSERT manter a árvore B ordenada, o que em milhões de
-- linhas custa muito mais caro do que construir o índice uma vez no final.

-- ── Dimensões ────────────────────────────────────────────────────────────────

-- 5.573 municípios, extraídos do próprio CSV (colunas geocodigo/UF/municipio).
-- Não há dependência de uma fonte IBGE externa: a tábua de risco já carrega o
-- código IBGE de 7 dígitos em toda linha.
CREATE TABLE municipios (
    geocodigo  TEXT PRIMARY KEY,   -- código IBGE, 7 dígitos
    uf         TEXT NOT NULL,
    nome       TEXT NOT NULL,
    -- nome_norm é gravado já sem acento e em minúsculas. O Go replica a mesma
    -- normalização (NFD + descarte de diacríticos) em zarc.Normalizar; as duas
    -- precisam bater byte a byte, senão "São Paulo" não acha "sao paulo".
    nome_norm  TEXT NOT NULL,
    cod_meso   TEXT,
    cod_micro  TEXT
);

CREATE TABLE culturas (
    id           INTEGER PRIMARY KEY,
    cod_cultura  TEXT NOT NULL,    -- Cod_Cultura do MAPA, 14 dígitos
    nome         TEXT NOT NULL,
    nome_norm    TEXT NOT NULL
);

-- solos, ciclos e manejos existem desde o primeiro build mesmo sem descrição.
-- As descrições de solo e ciclo só constam do dicionário de dados do MAPA, que
-- é um PDF digitalizado (imagem, sem camada de texto) — dependem do OCR, que é
-- tarefa posterior e não bloqueante. Criá-las vazias agora é o que mantém os
-- LEFT JOIN de internal/zarc/store.go válidos desde o dia um.
CREATE TABLE solos (
    cod        INTEGER PRIMARY KEY,
    descricao  TEXT
);

CREATE TABLE ciclos (
    cod        INTEGER PRIMARY KEY,
    descricao  TEXT
);

-- Manejo e clima, ao contrário de solo e ciclo, vêm nomeados no próprio CSV
-- (Nome_Outros_Manejos, Nome_Clima) — não dependem do OCR.
CREATE TABLE manejos (
    cod   INTEGER PRIMARY KEY,
    nome  TEXT NOT NULL           -- Sequeiro | Irrigado | Irrigado com controle de geada
);

CREATE TABLE climas (
    cod   INTEGER PRIMARY KEY,
    nome  TEXT NOT NULL           -- "Não se aplica" na maioria das linhas
);

-- ── Fato ─────────────────────────────────────────────────────────────────────

CREATE TABLE janelas (
    -- safra_ini = 0 marca o arquivo "Perene, Olerícola e Sem Safra". É onde
    -- vivem quase todas as culturas do nosso público (cebola, alho, batata,
    -- mandioca, banana); só os grãos ficam nas safras datadas. Toda consulta
    -- precisa cobrir 0 E a safra vigente — ver BuscarJanelas no store.go.
    safra_ini   INTEGER NOT NULL,
    safra_fim   INTEGER,           -- NULL quando o CSV traz "SEM SAFRA"
    cultura_id  INTEGER NOT NULL REFERENCES culturas(id),
    geocodigo   TEXT    NOT NULL REFERENCES municipios(geocodigo),
    cod_ciclo   INTEGER NOT NULL,
    cod_solo    INTEGER NOT NULL,
    cod_manejo  INTEGER NOT NULL,
    cod_clima   INTEGER NOT NULL,
    portaria    TEXT,
    -- 36 bytes, um por decêndio do ano civil, com o risco em porcentagem
    -- (0 = não indicado, 20, 30 ou 40). Um byte por decêndio em vez de 36
    -- colunas: cabe num BLOB de 36 bytes e o Go decodifica direto de []byte.
    riscos      BLOB    NOT NULL
);

-- ── Metadados do build ───────────────────────────────────────────────────────

-- Responde "que safra está no ar?" e "de onde isso veio?" sem depender de
-- alguém ter anotado. É a mesma informação do MANIFEST.txt que acompanha o
-- arquivo no backup do Drive.
CREATE TABLE meta (
    chave  TEXT PRIMARY KEY,
    valor  TEXT NOT NULL
);
