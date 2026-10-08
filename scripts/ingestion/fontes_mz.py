"""
fontes_mz.py — Baixa as fontes de Moçambique listadas em
pmo-bot-go/docs/knowledge_base_mz/FONTES.csv e confere o sha256 de cada uma.

Os PDFs não são versionados (DT-124: histórico enxuto); o manifesto é. Um sha256
diferente do registrado aborta: a fonte mudou desde a revisão, e alguém precisa
olhar de novo antes de atualizar o hash e reingerir.

Uso:
  python scripts/ingestion/fontes_mz.py
  python scripts/rag_ingest.py --dir pmo-bot-go/docs/knowledge_base_mz --pais MZ
"""

import csv
import hashlib
import os
import ssl
import sys
import urllib.request

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "pmo-bot-go", "docs", "knowledge_base_mz")


def sha256(caminho):
    h = hashlib.sha256()
    with open(caminho, "rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def main():
    with open(os.path.join(BASE, "FONTES.csv"), encoding="utf-8") as f:
        fontes = list(csv.DictReader(l for l in f if not l.startswith("#")))

    # O site do IIAM serve uma cadeia de certificado incompleta (o curl e o
    # Python recusam). A integridade fica garantida pelo sha256 abaixo, que é
    # o que de fato importa aqui.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    erros = 0
    for fonte in fontes:
        destino = os.path.join(BASE, fonte["arquivo"])
        if not (os.path.exists(destino) and sha256(destino) == fonte["sha256"]):
            req = urllib.request.Request(fonte["url"], headers={"User-Agent": "Mozilla/5.0 (manejo-org ingestao)"})
            with urllib.request.urlopen(req, context=ctx, timeout=300) as resp, open(destino, "wb") as out:
                out.write(resp.read())
        obtido = sha256(destino)
        if obtido != fonte["sha256"]:
            print(f"❌ {fonte['arquivo']}: sha256 {obtido} ≠ registrado {fonte['sha256']} — revisar a fonte antes de atualizar")
            erros += 1
        else:
            print(f"✅ {fonte['arquivo']}")
    sys.exit(1 if erros else 0)


if __name__ == "__main__":
    main()
