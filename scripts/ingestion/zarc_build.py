"""
zarc_build.py — Constrói a base local do ZARC (SQLite) a partir dos dados abertos do MAPA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISÃO ARQUITETURAL — ARQUIVO SQLITE, NÃO BANCO DE DADOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A tábua de risco do ZARC é dado público, somente-leitura, imutável entre
safras e consultado por lookup pontual (município × cultura). Esse perfil não
justifica um serviço de banco: justifica um arquivo.

Duas alternativas foram descartadas antes desta:

  Supabase  — a organização está no plano free, teto de 500 MB, e o banco de
              produção já usa 46 MB. Só a safra corrente + perenes passariam
              do teto, e estourá-lo põe o projeto inteiro em modo restrito.

  Postgres  — cabia com folga nos 200 GB da VPS, mas traria senha, pool de
  na VPS      conexões, tuning de shared_buffers, healthcheck, túnel SSH para
              ingestão e mais uma porta para vigiar. Infraestrutura dimensionada
              pelo tamanho do dado, não pelo uso real: os produtores vão fazer
              essa consulta raramente, ao menos até se habituarem.

O que sobrou: este script roda na máquina do desenvolvedor, produz um
`zarc.sqlite`, e o arquivo é copiado pronto para a VPS por scp e montado :ro no
contêiner do bot. "Migração de banco em produção" vira "deploy de asset
estático". Atualizar de safra = trocar o arquivo e reiniciar.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PARTICULARIDADES DA FONTE (verificadas em 2026-09-08)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  * O portal devolve 403 para requisições sem User-Agent de navegador, e
    também para HEAD. Só GET com UA funciona.
  * O portal IGNORA o header Range: não existe download parcial. É o arquivo
    inteiro (211 MB da safra corrente, 535 MB dos perenes) ou nada. Por isso o
    cache em disco não é otimização, é requisito de sanidade.
  * Os CSVs são `;` e UTF-8 COM BOM — daí o encoding utf-8-sig.
  * SafraFin nem sempre é numérico: nas culturas perenes vem a string
    "SEM SAFRA".
  * A coluna Portaria tem formato inconsistente ENTRE arquivos:
    "Port.272_de_22-07-2026" (sem espaço) e "Port. 438_de_28-12-2023" (com).
  * dec1..dec36 são os decêndios do ano civil, com o risco em porcentagem:
    0 (não indicado), 20, 30 ou 40.

Uso:
  python scripts/ingestion/zarc_build.py                    # safra corrente + perenes (padrão)
  python scripts/ingestion/zarc_build.py --safras all       # as 11 safras + perenes
  python scripts/ingestion/zarc_build.py --validate         # só valida um arquivo já gerado

Dependências:
  pip install requests        # sqlite3 e unicodedata são da biblioteca padrão
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import logging
import re
import sqlite3
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
except ImportError as e:
    sys.exit(f"Missing dependency: {e}. Run: pip install requests")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_SQL = PROJECT_ROOT / "deploy" / "zarc" / "schema.sql"
INDEXES_SQL = PROJECT_ROOT / "deploy" / "zarc" / "indexes.sql"
DEFAULT_OUT = PROJECT_ROOT / "data" / "zarc.sqlite"
DEFAULT_CACHE = PROJECT_ROOT / ".cache" / "zarc"

CKAN_PACKAGE = "tabua-de-risco-zoneamento-agricola-de-risco-climatico"
CKAN_API = f"https://dados.agricultura.gov.br/api/3/action/package_show?id={CKAN_PACKAGE}"

# O portal recusa requisições sem UA de navegador (403, sem corpo).
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# Linhas de 56 colunas com nomes longos de cultura chegam perto do default de
# csv em alguns ambientes; subir o limite é mais barato que depurar depois.
csv.field_size_limit(1_000_000)

BATCH = 50_000

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("zarc")


# ── Normalização ───────────────────────────────────────────────────────────────

def normalizar(s: str) -> str:
    """Minúsculas e sem diacríticos.

    internal/zarc/store.go:Normalizar replica isto em Go com NFD + descarte de
    marcas de combinação. As duas TÊM de produzir a mesma string: é por
    nome_norm que o bot acha "São Paulo" quando o produtor escreve "sao paulo".
    """
    decomposto = unicodedata.normalize("NFD", (s or "").strip())
    sem_acento = "".join(c for c in decomposto if not unicodedata.combining(c))
    return unicodedata.normalize("NFC", sem_acento).lower()


_PORTARIA_RE = re.compile(r"^Port\.\s*", re.IGNORECASE)


def normalizar_portaria(p: str) -> str:
    """Colapsa "Port.272_de_..." e "Port. 438_de_..." na mesma forma."""
    p = (p or "").strip()
    return _PORTARIA_RE.sub("Port. ", p) if p else ""


# ── Descoberta dos recursos no CKAN ────────────────────────────────────────────

_SAFRA_RE = re.compile(r"(\d{4})[-/](\d{4})")


def descobrir_recursos() -> dict:
    """Lê o catálogo CKAN e devolve {chave: {nome, url, safra_ini}}.

    Consultar o catálogo em vez de fixar as URLs faz a safra nova ser
    reconhecida sozinha quando o MAPA publicar — que é exatamente o momento em
    que alguém vai rodar este script.
    """
    r = requests.get(CKAN_API, headers={"User-Agent": UA}, timeout=60)
    r.raise_for_status()
    recursos = r.json()["result"]["resources"]

    out = {}
    for rec in recursos:
        if (rec.get("format") or "").upper() != "CSV":
            continue
        nome = rec.get("name") or ""
        url = rec.get("url") or ""
        m = _SAFRA_RE.search(nome) or _SAFRA_RE.search(url)
        if m:
            chave = f"{m.group(1)}-{m.group(2)}"
            out[chave] = {"nome": nome, "url": url, "safra_ini": int(m.group(1))}
        elif "perene" in url.lower() or "perene" in nome.lower():
            # safra_ini = 0: a partição lógica das perenes/olerícolas.
            out["perene"] = {"nome": nome, "url": url, "safra_ini": 0}
    return out


def selecionar(recursos: dict, modo: str) -> list:
    """Traduz --safras em chaves de recurso.

    Aceita 'all', 'corrente' (padrão) ou uma lista separada por vírgula, que é
    a forma que o MANIFEST.txt imprime como receita de recriação — sem isso, o
    comando sugerido no manifesto não rodaria.
    """
    safras = sorted((k for k in recursos if k != "perene"), reverse=True)

    if modo == "all":
        return (["perene"] if "perene" in recursos else []) + safras

    pedidas = [p.strip() for p in modo.split(",") if p.strip()]
    if pedidas and all(p in recursos for p in pedidas):
        return pedidas

    desconhecidas = [p for p in pedidas if p not in recursos and p != "corrente"]
    if desconhecidas:
        logger.warning("safra(s) não encontrada(s) no catálogo: %s — usando 'corrente'",
                       ", ".join(desconhecidas))

    escolhidas = []
    if "perene" in recursos:
        escolhidas.append("perene")
    if safras:
        escolhidas.append(safras[0])  # corrente = a mais recente publicada
    return escolhidas


def baixar(url: str, destino: Path) -> Path:
    if destino.exists() and destino.stat().st_size > 0:
        logger.info("cache: %s (%.1f MB)", destino.name, destino.stat().st_size / 1e6)
        return destino
    destino.parent.mkdir(parents=True, exist_ok=True)
    logger.info("baixando %s", url.rsplit("/", 1)[-1])
    parcial = destino.with_suffix(destino.suffix + ".part")
    with requests.get(url, headers={"User-Agent": UA}, stream=True, timeout=300) as r:
        r.raise_for_status()
        total = 0
        marco = 0
        with open(parcial, "wb") as f:
            for chunk in r.iter_content(chunk_size=1 << 20):
                f.write(chunk)
                total += len(chunk)
                if total - marco >= (50 << 20):
                    marco = total
                    logger.info("  … %.0f MB", total / 1e6)
    parcial.rename(destino)  # só vira o arquivo final se o download completou
    logger.info("baixado: %s (%.1f MB)", destino.name, destino.stat().st_size / 1e6)
    return destino


# ── Construção do SQLite ───────────────────────────────────────────────────────

def _int(v, padrao):
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return padrao


class Builder:
    def __init__(self, con: sqlite3.Connection):
        self.con = con
        self.municipios = {}
        self.culturas = {}        # nome -> id
        self.culturas_rows = []
        self.solos = set()
        self.ciclos = set()
        self.manejos = {}
        self.climas = {}
        self.total = 0

    def cultura_id(self, nome: str, cod: str) -> int:
        cid = self.culturas.get(nome)
        if cid is None:
            cid = len(self.culturas) + 1
            self.culturas[nome] = cid
            self.culturas_rows.append((cid, cod, nome, normalizar(nome)))
        return cid

    def carregar_csv(self, caminho: Path, safra_ini_padrao: int) -> int:
        lote = []
        lidas = 0
        with open(caminho, encoding="utf-8-sig", newline="") as f:
            leitor = csv.reader(f, delimiter=";")
            cabecalho = next(leitor)
            col = {nome: i for i, nome in enumerate(cabecalho)}
            dec_idx = [col[f"dec{i}"] for i in range(1, 37)]
            for linha in leitor:
                if len(linha) < len(cabecalho):
                    continue  # linha truncada no fim do arquivo
                lidas += 1

                safra_ini = _int(linha[col["SafraIni"]], safra_ini_padrao)
                # "SEM SAFRA" aparece em SafraFin nas perenes — não é numérico.
                safra_fim = _int(linha[col["SafraFin"]], None)

                nome_cultura = linha[col["Nome_cultura"]].strip()
                cid = self.cultura_id(nome_cultura, linha[col["Cod_Cultura"]].strip())

                geo = linha[col["geocodigo"]].strip()
                if geo not in self.municipios:
                    self.municipios[geo] = (
                        geo,
                        linha[col["UF"]].strip(),
                        linha[col["municipio"]].strip(),
                        normalizar(linha[col["municipio"]]),
                        linha[col["Cod_Meso"]].strip(),
                        linha[col["Cod_Micro"]].strip(),
                    )

                cod_solo = _int(linha[col["Cod_Solo"]], 0)
                cod_ciclo = _int(linha[col["Cod_Ciclo"]], 0)
                cod_manejo = _int(linha[col["Cod_Outros_Manejos"]], 0)
                cod_clima = _int(linha[col["Cod_Clima"]], 0)
                self.solos.add(cod_solo)
                self.ciclos.add(cod_ciclo)
                self.manejos.setdefault(cod_manejo, linha[col["Nome_Outros_Manejos"]].strip())
                self.climas.setdefault(cod_clima, linha[col["Nome_Clima"]].strip())

                # 36 bytes, um por decêndio. Os valores da fonte são 0/20/30/40,
                # que cabem num byte — o min() evita um OverflowError silencioso
                # caso algum dia apareça outro valor.
                riscos = bytes(min(_int(linha[i], 0) or 0, 255) for i in dec_idx)

                lote.append((
                    safra_ini, safra_fim, cid, geo, cod_ciclo, cod_solo,
                    cod_manejo, cod_clima,
                    normalizar_portaria(linha[col["Portaria"]]), riscos,
                ))
                if len(lote) >= BATCH:
                    self._gravar(lote)
                    lote = []
                    if lidas % 500_000 == 0:
                        logger.info("  … %s linhas", f"{lidas:,}".replace(",", "."))
        if lote:
            self._gravar(lote)
        self.total += lidas
        return lidas

    def _gravar(self, lote: list) -> None:
        self.con.executemany(
            "INSERT INTO janelas (safra_ini, safra_fim, cultura_id, geocodigo, cod_ciclo,"
            " cod_solo, cod_manejo, cod_clima, portaria, riscos)"
            " VALUES (?,?,?,?,?,?,?,?,?,?)",
            lote,
        )
        self.con.commit()

    def gravar_dimensoes(self) -> None:
        self.con.executemany("INSERT INTO municipios VALUES (?,?,?,?,?,?)", self.municipios.values())
        self.con.executemany("INSERT INTO culturas VALUES (?,?,?,?)", self.culturas_rows)
        self.con.executemany("INSERT INTO solos (cod) VALUES (?)", [(c,) for c in sorted(self.solos)])
        self.con.executemany("INSERT INTO ciclos (cod) VALUES (?)", [(c,) for c in sorted(self.ciclos)])
        self.con.executemany("INSERT INTO manejos VALUES (?,?)", sorted(self.manejos.items()))
        self.con.executemany("INSERT INTO climas VALUES (?,?)", sorted(self.climas.items()))
        self.con.commit()


def abrir_novo(destino: Path) -> sqlite3.Connection:
    destino.parent.mkdir(parents=True, exist_ok=True)
    if destino.exists():
        destino.unlink()
    con = sqlite3.connect(destino)
    # Build descartável: se der errado, apaga e refaz. Durabilidade a cada
    # transação aqui só custaria tempo — o arquivo só vale depois de pronto.
    con.execute("PRAGMA journal_mode = OFF")
    con.execute("PRAGMA synchronous = OFF")
    con.execute("PRAGMA temp_store = MEMORY")
    con.execute("PRAGMA cache_size = -200000")  # ~200 MB
    con.executescript(SCHEMA_SQL.read_text(encoding="utf-8"))
    return con


def sha256(caminho: Path) -> str:
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def escrever_manifest(caminho: Path) -> Path:
    """Grava o MANIFEST.txt que acompanha o arquivo no backup do Drive.

    Sai da tabela `meta` do próprio SQLite, não de variáveis do processo: assim
    o manifesto pode ser regerado de um arquivo antigo, e nunca descreve um
    build diferente do que está ali dentro. É o que torna a recriação
    verificável meses depois — sem isso, "qual safra é este arquivo?" vira
    arqueologia.
    """
    con = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True)
    meta = dict(con.execute("SELECT chave, valor FROM meta").fetchall())
    contagens = {
        t: con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
        for t in ("janelas", "municipios", "culturas")
    }
    con.close()

    fontes = json.loads(meta.get("fontes", "[]"))
    linhas = [
        "ZARC — Zoneamento Agricola de Risco Climatico (MAPA)",
        "Base local do Manejo.ORG, gerada por scripts/ingestion/zarc_build.py",
        "",
        f"arquivo   : {caminho.name}",
        f"tamanho   : {caminho.stat().st_size / 1e6:.1f} MB",
        f"sha256    : {sha256(caminho)}",
        f"build_utc : {meta.get('build_utc', '?')}",
        f"safras    : {meta.get('safras', '?')}",
        "",
        "conteudo:",
        f"  janelas    : {contagens['janelas']:,}".replace(",", "."),
        f"  municipios : {contagens['municipios']:,}".replace(",", "."),
        f"  culturas   : {contagens['culturas']:,}".replace(",", "."),
        "",
        "fontes (dados abertos do MAPA, licenca CC-BY):",
    ]
    for f in fontes:
        linhas.append(f"  [{f['chave']}] {f['linhas']} linhas")
        linhas.append(f"      {f['url']}")
    linhas += [
        "",
        "Para recriar este arquivo do zero:",
        f"  python scripts/ingestion/zarc_build.py --safras {meta.get('safras', 'corrente')}",
        "",
        "Este backup e conveniencia, nao rede de seguranca: a fonte e publica e",
        "o script reconstroi tudo. O Drive so evita rebaixar ~750 MB e reprocessar.",
    ]

    destino = caminho.with_suffix(caminho.suffix + ".MANIFEST.txt")
    destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return destino


# ── Validação ──────────────────────────────────────────────────────────────────

def validar(caminho: Path) -> bool:
    """Portão antes do scp. Sai com código != 0 se algo estiver errado."""
    con = sqlite3.connect(f"file:{caminho}?mode=ro", uri=True)
    ok = True

    def checa(rotulo: str, condicao: bool, detalhe: str = "") -> None:
        nonlocal ok
        logger.info("%s %s%s", "OK  " if condicao else "FALHA", rotulo,
                    f" — {detalhe}" if detalhe else "")
        ok = ok and condicao

    for tabela in ("municipios", "culturas", "janelas", "solos", "ciclos", "manejos"):
        n = con.execute(f"SELECT count(*) FROM {tabela}").fetchone()[0]
        checa(f"{tabela}: {n:,} linhas".replace(",", "."), n > 0)

    ruins = con.execute("SELECT count(*) FROM janelas WHERE length(riscos) != 36").fetchone()[0]
    checa("todos os riscos têm 36 bytes", ruins == 0, f"{ruins} fora do padrão")

    sp = con.execute(
        "SELECT geocodigo FROM municipios WHERE nome_norm = 'sao paulo' AND uf = 'SP'"
    ).fetchone()
    checa("São Paulo/SP resolve para 3550308", bool(sp) and sp[0] == "3550308")

    orfas = con.execute(
        "SELECT count(*) FROM janelas j LEFT JOIN municipios m ON m.geocodigo = j.geocodigo"
        " WHERE m.geocodigo IS NULL"
    ).fetchone()[0]
    checa("nenhuma janela órfã de município", orfas == 0, f"{orfas} órfãs")

    # Linha de controle conferida à mão contra o CSV da safra 2026/2027:
    # Sorgo Granífero 2ª Safra, João Neiva/ES, ciclo 22, solo 1.
    #
    # Vale como controle justamente porque a janela ATRAVESSA a virada do ano:
    # começa no decêndio 27 (fim de setembro) e termina no 6 (fim de fevereiro),
    # com os decêndios 7 a 26 zerados no meio. Qualquer decodificador que trate
    # os 36 bytes como uma linha do tempo com começo e fim quebra aqui.
    ctrl = con.execute(
        "SELECT j.riscos FROM janelas j JOIN culturas c ON c.id = j.cultura_id"
        " WHERE j.geocodigo = '3203130' AND c.nome LIKE 'Sorgo Granífero 2%'"
        "   AND j.cod_ciclo = 22 AND j.cod_solo = 1"
    ).fetchone()
    if ctrl is None:
        logger.info("--   linha de controle de João Neiva ausente (safra 2026/2027 não carregada)")
    else:
        esperado = bytes(
            [20, 30, 30, 30, 40, 40] + [0] * 20
            + [40, 40, 40, 30, 30, 30, 30, 30, 30, 20]
        )
        checa("linha de controle João Neiva/ES confere", bytes(ctrl[0]) == esperado,
              f"obtido {list(bytes(ctrl[0])[:8])}")

    con.close()
    return ok


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> int:
    p = argparse.ArgumentParser(description="Constrói a base local do ZARC (SQLite).")
    p.add_argument(
        "--safras", default="corrente",
        help="'corrente' (padrão: mais recente + perenes), 'all', ou uma safra (ex: 2024-2025)",
    )
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    p.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE)
    p.add_argument("--validate", action="store_true", help="só valida o arquivo em --out e sai")
    args = p.parse_args()

    if args.validate:
        if not args.out.exists():
            logger.error("arquivo não encontrado: %s", args.out)
            return 1
        logger.info("validando %s", args.out)
        if not validar(args.out):
            return 1
        logger.info("manifesto: %s", escrever_manifest(args.out))
        return 0

    logger.info("consultando catálogo CKAN do MAPA…")
    recursos = descobrir_recursos()
    chaves = selecionar(recursos, args.safras)
    if not chaves:
        logger.error("nenhum recurso selecionado para --safras=%s", args.safras)
        return 1
    logger.info("recursos: %s", ", ".join(chaves))

    con = abrir_novo(args.out)
    b = Builder(con)
    fontes = []
    for chave in chaves:
        rec = recursos[chave]
        arquivo = baixar(rec["url"], args.cache_dir / rec["url"].rsplit("/", 1)[-1])
        logger.info("carregando %s (safra_ini=%d)…", chave, rec["safra_ini"])
        n = b.carregar_csv(arquivo, rec["safra_ini"])
        logger.info("  %s: %s linhas", chave, f"{n:,}".replace(",", "."))
        fontes.append({"chave": chave, "url": rec["url"], "linhas": n})

    b.gravar_dimensoes()

    con.executescript(INDEXES_SQL.read_text(encoding="utf-8"))
    con.executemany("INSERT INTO meta VALUES (?,?)", [
        ("build_utc", datetime.now(timezone.utc).isoformat(timespec="seconds")),
        ("fontes", json.dumps(fontes, ensure_ascii=False)),
        ("safras", ",".join(chaves)),
        ("total_janelas", str(b.total)),
    ])
    con.commit()
    logger.info("ANALYZE + VACUUM…")
    con.execute("ANALYZE")
    con.execute("VACUUM")
    con.close()

    tamanho = args.out.stat().st_size
    digest = sha256(args.out)
    logger.info("gerado: %s", args.out)
    logger.info("tamanho: %.1f MB | linhas: %s | sha256: %s",
                tamanho / 1e6, f"{b.total:,}".replace(",", "."), digest)

    logger.info("validando…")
    if not validar(args.out):
        logger.error("VALIDAÇÃO FALHOU — não suba este arquivo para produção")
        return 1
    logger.info("manifesto: %s", escrever_manifest(args.out))
    logger.info("pronto para o scp")
    return 0


if __name__ == "__main__":
    sys.exit(main())
