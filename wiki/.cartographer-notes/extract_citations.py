#!/usr/bin/env python3
"""Varre wiki/**/*.md em busca de citações `caminho/arquivo.ext:linha[-linha]`
e gera um relatório de claims para `cartographer notes ingest`.

Regras:
- Citação precisa ter extensão reconhecida e número de linha explícito.
  Menção de caminho sem linha não vira claim (evidência fraca demais para
  hash de trecho).
- Nomes de arquivo "soltos" (sem diretório, ex.: `handler.go:846`) são
  resolvidos usando o último caminho totalmente qualificado com o mesmo
  basename visto ANTES no mesmo documento. Ambíguo ou não resolvido = descartado.
- Todo alvo é confirmado como arquivo real no repositório antes de virar claim.
- Citações que reproduzem exatamente (path, startLine, endLine) já usadas em
  wiki-divergencias.json são puladas, para não duplicar evidência já curada
  manualmente.
- Uma claim por (documento, arquivo-alvo): agrega todas as linhas citadas
  daquele arquivo naquele documento em uma lista de evidências.
"""
import json
import os
import re
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WIKI_DIR = os.path.join(REPO_ROOT, "wiki")
CURATED_REPORT = os.path.join(os.path.dirname(__file__), "wiki-divergencias.json")
OUT_REPORT = os.path.join(os.path.dirname(__file__), "wiki-citations.json")

EXCLUDED_DIRS = {".obsidian", ".cartographer-notes"}

# path token: pelo menos um separador de diretório OU basename solto,
# seguido de extensão reconhecida, ":" e número de linha.
CITATION_RE = re.compile(
    r"(?<![\w/.\-])"
    r"(?P<path>[A-Za-z0-9_][A-Za-z0-9_./\-]*\.(?:go|ts|tsx|js|jsx|sql|py|md|json|yml|yaml))"
    r":(?P<start>\d+)(?:-(?P<end>\d+))?"
    r"(?![\w])"
)

KIND_BY_FOLDER = {
    "concepts": "workflow",
    "entities": "purpose",
    "components": "purpose",
}


def load_curated_evidence_keys():
    keys = set()
    if not os.path.isfile(CURATED_REPORT):
        return keys
    with open(CURATED_REPORT, encoding="utf-8") as f:
        data = json.load(f)
    for claim in data.get("claims", []):
        for ev in claim.get("evidence", []):
            keys.add((ev["path"], ev.get("startLine"), ev.get("endLine")))
    return keys


def list_wiki_docs():
    docs = []
    for root, dirs, files in os.walk(WIKI_DIR):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for name in files:
            if name.endswith(".md"):
                docs.append(os.path.join(root, name))
    return sorted(docs)


def h1_title(text):
    m = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    return m.group(1).strip() if m else None


def repo_relpath(p):
    return p.replace("\\", "/")


def file_line_count(abs_path):
    try:
        with open(abs_path, encoding="utf-8", errors="replace") as f:
            return sum(1 for _ in f)
    except OSError:
        return None


def excerpt_for(text, match_start):
    line_start = text.rfind("\n", 0, match_start) + 1
    line_end = text.find("\n", match_start)
    if line_end == -1:
        line_end = len(text)
    line = text[line_start:line_end].strip()
    line = re.sub(r"[`>#|]", "", line)
    line = re.sub(r"\s+", " ", line).strip()
    return line[:180]


def kind_for_doc(doc_path):
    rel = os.path.relpath(doc_path, WIKI_DIR).replace("\\", "/")
    folder = rel.split("/")[0]
    return KIND_BY_FOLDER.get(folder, "workflow")


def main():
    curated_keys = load_curated_evidence_keys()
    docs = list_wiki_docs()

    claims = []
    stats = {"docs": len(docs), "citations_found": 0, "resolved": 0,
              "unresolved_bare": 0, "missing_file": 0, "skipped_curated": 0,
              "line_out_of_range": 0}

    for doc_path in docs:
        with open(doc_path, encoding="utf-8") as f:
            text = f.read()
        title = h1_title(text) or os.path.splitext(os.path.basename(doc_path))[0]
        doc_rel = repo_relpath(os.path.relpath(doc_path, REPO_ROOT))

        # mapa basename -> caminho qualificado, na ordem em que aparecem
        basename_map = {}
        # (target_path) -> lista de (start,end,excerpt)
        per_target = {}

        for m in CITATION_RE.finditer(text):
            stats["citations_found"] += 1
            raw_path = m.group("path")
            start = int(m.group("start"))
            end = int(m.group("end")) if m.group("end") else start

            if "/" in raw_path:
                target_rel = raw_path
                basename_map[os.path.basename(raw_path)] = raw_path
                stats["resolved"] += 1
            else:
                target_rel = basename_map.get(raw_path)
                if target_rel is None:
                    stats["unresolved_bare"] += 1
                    continue
                stats["resolved"] += 1

            target_abs = os.path.join(REPO_ROOT, target_rel)
            if not os.path.isfile(target_abs):
                stats["missing_file"] += 1
                continue

            key = (target_rel, start, end)
            if key in curated_keys:
                stats["skipped_curated"] += 1
                continue

            n_lines = file_line_count(target_abs)
            if n_lines is not None and start > n_lines:
                stats["line_out_of_range"] += 1
                continue

            excerpt = excerpt_for(text, m.start())
            per_target.setdefault(target_rel, []).append((start, end, excerpt))

        for target_rel, hits in per_target.items():
            hits.sort(key=lambda h: h[0])
            evidence = [
                {"path": target_rel, "startLine": s, "endLine": e}
                for s, e, _ in hits
            ]
            excerpts = "; ".join(dict.fromkeys(x[2] for x in hits if x[2]))[:280]
            summary = (
                f"[{title}] ({doc_rel}) referencia {target_rel} nas linhas "
                f"{', '.join(f'{s}-{e}' if s != e else str(s) for s, e, _ in hits)}. "
                f"Contexto: {excerpts}"
            ).strip()
            claims.append({
                "kind": kind_for_doc(doc_path),
                "summary": summary[:600],
                "target": target_rel,
                "evidence": evidence,
            })

    report = {"target": "wiki-citations", "claims": claims}
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"docs escaneados: {stats['docs']}", file=sys.stderr)
    print(f"citações encontradas: {stats['citations_found']}", file=sys.stderr)
    print(f"resolvidas: {stats['resolved']}", file=sys.stderr)
    print(f"basename ambíguo/não resolvido: {stats['unresolved_bare']}", file=sys.stderr)
    print(f"arquivo alvo inexistente: {stats['missing_file']}", file=sys.stderr)
    print(f"linha fora do range do arquivo: {stats['line_out_of_range']}", file=sys.stderr)
    print(f"já cobertas por wiki-divergencias.json: {stats['skipped_curated']}", file=sys.stderr)
    print(f"claims geradas: {len(claims)}", file=sys.stderr)
    print(f"escrito em: {OUT_REPORT}", file=sys.stderr)


if __name__ == "__main__":
    main()
