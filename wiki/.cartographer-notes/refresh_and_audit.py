"""
refresh_and_audit.py — reindexa o grafo do Cartographer e lista o que precisa
de revisão humana antes de considerar a wiki em dia.

Faz só os 3 primeiros passos da rotina de manutenção (ver README.md, "Como
(re)aplicar" e "Ciclo de vida da nota"):

  1. Reindexa o grafo (`cartographer index`) — barato, sem efeito colateral.
  2. Audita as notas (`cartographer notes audit --json`) — descobre quais
     ficaram com o hash de evidência desatualizado.
  3. Para cada nota `candidate`/`accepted` sinalizada (ignora as já
     `retired`), imprime o claim inteiro — arquivo, linha, texto da
     afirmação — para alguém (humano ou agente) decidir rapidamente se a
     afirmação continua verdadeira.

O QUE ESTE SCRIPT NÃO FAZ (de propósito): não reingere relatórios e não
aposenta notas. O hash de evidência do Cartographer é do arquivo inteiro, não
da linha citada — uma edição em qualquer lugar do arquivo invalida a nota
mesmo que o trecho citado continue correto. Decidir se uma nota sinalizada
ainda é verdade é sempre um julgamento, nunca automático:

  - Se a afirmação continua válida (só a linha/hash mudou):
      regenere `wiki-citations.json` se a nota veio de lá
      (`python wiki/.cartographer-notes/extract_citations.py`), ou reingira
      `wiki-divergencias.json` como está — o hash é recalculado contra o
      arquivo atual, criando uma nota nova e correta.
  - Aposente a nota velha só depois de confirmar que a nova está limpa:
      bun <cartographer>/src/cli/index.ts notes retire note:<id> \
        --reviewer "<nome>" --out .cartographer

Uso:
  python wiki/.cartographer-notes/refresh_and_audit.py

Saída: 0 se nada precisa de revisão, 1 se há notas sinalizadas para revisar
(útil para gate manual — não é um gate de CI, o julgamento é sempre humano).
"""

import json
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
OUT_DIR = REPO_ROOT / ".cartographer"
NOTES_PATH = OUT_DIR / "notes.jsonl"


def load_cartographer_cli() -> tuple[str, str]:
    """Lê bun/cli path de .mcp.json (mesma config que o MCP server usa)."""
    mcp_config = json.loads((REPO_ROOT / ".mcp.json").read_text(encoding="utf-8"))
    server = mcp_config["mcpServers"]["cartographer"]
    bun_path = server["command"]
    cli_args = [a for a in server["args"] if a != "mcp"]
    if len(cli_args) != 1:
        raise RuntimeError(f".mcp.json: esperava 1 arg (o path do cli), achei {cli_args}")
    return bun_path, cli_args[0]


def run_cartographer(bun_path: str, cli_path: str, *args: str) -> subprocess.CompletedProcess:
    cmd = [bun_path, cli_path, *args]
    return subprocess.run(cmd, capture_output=True, text=True, cwd=str(REPO_ROOT), timeout=300)


def load_notes_by_id() -> dict:
    notes = {}
    if not NOTES_PATH.exists():
        return notes
    for line in NOTES_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        note = json.loads(line)
        notes[note["id"]] = note  # última ocorrência vence (jsonl é append-only)
    return notes


def format_evidence(evidence: list) -> str:
    parts = []
    for ev in evidence:
        line = f"{ev['startLine']}" if ev.get("startLine") == ev.get("endLine") else f"{ev.get('startLine')}-{ev.get('endLine')}"
        parts.append(f"{ev['path']}:{line}" if ev.get("startLine") is not None else ev["path"])
    return ", ".join(parts)


def main() -> int:
    bun_path, cli_path = load_cartographer_cli()

    print("1/3 — reindexando o grafo...")
    result = run_cartographer(bun_path, cli_path, "index", "--root", str(REPO_ROOT), "--out", str(OUT_DIR))
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        return 2
    print("    ok.")

    print("2/3 — auditando notas...")
    result = run_cartographer(bun_path, cli_path, "notes", "audit", "--out", str(OUT_DIR), "--json")
    if result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        return 2
    audit = json.loads(result.stdout)
    print(f"    {audit['summary']['totalAnnotations']} notas no total, "
          f"{audit['summary']['staleRecommendedCount']} sinalizadas.")

    print("3/3 — separando o que precisa de revisão humana...")
    notes_by_id = load_notes_by_id()
    actionable = []
    for issue in audit["issues"]:
        note = notes_by_id.get(issue["annotationId"])
        if note is None or note.get("status") == "retired":
            continue  # já tratada numa rodada anterior
        actionable.append((issue, note))

    if not actionable:
        print("\nNada pendente — todas as notas ativas batem com o código atual.")
        return 0

    print(f"\n{len(actionable)} nota(s) precisam de revisão (confira se a afirmação ainda é verdade):\n")
    for issue, note in actionable:
        print(f"  [{note['id']}] status={note['status']} kind={note['kind']}")
        print(f"    claim: {note['summary']}")
        print(f"    evidência: {format_evidence(note['evidence'])}")
        print(f"    criada em: {note.get('createdAt')}")
        print()

    print(
        "Para cada uma: releia o trecho citado. Se ainda é verdade, reingira o\n"
        "relatório de origem (wiki-citations.json ou wiki-divergencias.json) para\n"
        "gerar uma nota nova com o hash atual, depois aposente a antiga com:\n"
        f'  bun "{cli_path}" notes retire <id> --reviewer "<nome>" --out .cartographer'
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
