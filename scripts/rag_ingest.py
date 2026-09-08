"""
rag_ingest.py — Ingestão de PDFs na base de conhecimento RAG (farm_documents)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISÃO ARQUITETURAL — EXTRATOR DE PDF: PyMuPDF (`fitz`)
Ver: docs/architecture/adr/007-pdf-extraction-pymupdf.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Por que PyMuPDF e não Docling (extrator anterior)?
────────────────────────────────────────────────────
O Docling (ADR-006) foi descartado em 2026-07-24 após confirmação de regressão
de encoding em PDFs da Embrapa com mapeamento CID de fontes:

  Docling:  "evapotranspirao"  /  "irriga??o"  /  "hortali?as"
  PyMuPDF:  "evapotranspiração"  /  "irrigação"  /  "hortaliças"   ✅

Causa técnica: o Docling não resolve o mapa glifo→caractere em fontes CID
(padrão em publicações Embrapa/MAPA geradas com InDesign/LaTeX). O PyMuPDF
usa a tabela ToUnicode do PDF, que nesses documentos contém os codepoints
corretos (Latin-1), e os converte internamente para str Python (UTF-8).

Evidência reproduzível:
  >>> import fitz
  >>> page = fitz.open("cartilha_embrapa.pdf")[3]
  >>> for ch in page.get_text()[:50]:
  ...     if ord(ch) > 127: print(f"chr({ord(ch):#x}) = {ch!r}")
  chr(0xe7) = 'ç'   # ç — correto
  chr(0xe3) = 'ã'   # ã — correto

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISÃO ARQUITETURAL — TABELA/EMBEDDING: farm_documents / OpenRouter bge-m3
Ver: docs/PLAN-rag-ingestion-unification.md (DT-07)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este script gravava em `knowledge_chunks` com embeddings Gemini (3072d) — uma
tabela que NENHUMA ferramenta do bot consulta. A tool `consultar_base_conhecimento`
chama a RPC `match_documents_with_context`, que só lê `farm_documents.embedding_1024`
(OpenRouter, modelo `baai/bge-m3`, 1024d) — o mesmo caminho que
`internal/supabase/client.go:GetEmbedding` usa para os demais embeddings do
bot. Resultado prático, antes desta mudança: nenhum dos 17 PDFs de
`pmo-bot-go/docs/knowledge_base/` era pesquisável pelo bot, porque a extração
boa (PyMuPDF) escrevia num lugar que ninguém lia.

A extração de metadados via LLM (título/autor/ano/instituição) foi removida
junto — `farm_documents` não tem colunas para isso, e nada mais lia a tabela
`knowledge_documents` onde esses metadados eram persistidos.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pipeline:
  1. Extrai texto dos PDFs com PyMuPDF (UTF-8 correto, preserva acentos)
  1b. Se um PDF não tiver camada de texto (escaneado puro), roda OCR via
      ocrmypdf/Tesseract (idioma Português) num container Docker antes de desistir
      — exige Docker Desktop rodando; sem ele, o arquivo é pulado com aviso.
  2. Limpa e divide em chunks semânticos (LangChain RecursiveCharacterTextSplitter)
  3. Gera embeddings via OpenRouter (baai/bge-m3, 1024d) — mesmo modelo do bot
  4. Faz upsert em farm_documents (on_conflict=chunk_hash), consultada pela RPC
     match_documents_with_context (a que a tool consultar_base_conhecimento usa)
  5. Mantém checkpoint por hash de arquivo, para não reprocessar sem necessidade

Uso:
  python scripts/rag_ingest.py                  # processa apenas arquivos novos/modificados
  python scripts/rag_ingest.py --force          # reindexa tudo (re-vetorização completa)
  python scripts/rag_ingest.py --dir <caminho>  # aponta para outro diretório de PDFs (testes)

Dependências:
  pip install pymupdf supabase langchain-text-splitters python-dotenv requests
  Docker Desktop rodando (só é usado se algum PDF precisar do fallback de OCR)
"""

import sys
import os
import re
import json
import time
import shutil
import hashlib
import logging
import argparse
import tempfile
import subprocess
import requests
from typing import List, Dict, Any, Tuple
from pathlib import Path

# Root of the project = parent of the 'scripts/' directory
SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# External Libraries
# Install: pip install pymupdf supabase langchain-text-splitters python-dotenv requests
try:
    import fitz  # PyMuPDF — UTF-8 safe, handles Portuguese accents correctly
    from supabase import create_client, Client
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from dotenv import load_dotenv, find_dotenv
except ImportError as e:
    print(
        f"Missing dependency: {e}. "
        "Run: pip install pymupdf supabase langchain-text-splitters python-dotenv requests"
    )
    sys.exit(1)

# ── Configuration ──────────────────────────────────────────────────────────────

# Load .env.prod / .env from the project root (works regardless of CWD)
env_file = find_dotenv(str(PROJECT_ROOT / ".env.prod"))
if not env_file:
    env_file = find_dotenv(str(PROJECT_ROOT / ".env"))
if not env_file:
    env_file = find_dotenv(".env.prod") or find_dotenv(".env")
if env_file:
    print(f"[ENV] {env_file}")
    load_dotenv(env_file)
else:
    print("[WARNING] Nenhum .env / .env.prod encontrado.")

SUPABASE_URL       = os.getenv("SUPABASE_URL")
SUPABASE_KEY       = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

missing = [v for v, k in [("SUPABASE_URL", SUPABASE_URL), ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY),
                           ("OPENROUTER_API_KEY", OPENROUTER_API_KEY)] if not k]
if missing:
    sys.exit(f"[ERROR] Variáveis de ambiente ausentes: {', '.join(missing)}")

# Mesmo modelo e provedor que internal/supabase/client.go:GetEmbedding usa para
# todo embedding do bot (PMO, insumos, etc.) — farm_documents.embedding_1024
# só é comparável entre si se todo mundo escrever no mesmo espaço vetorial.
EMBEDDING_MODEL         = "baai/bge-m3"
EMBEDDING_DIMENSIONS    = 1024
EMBEDDING_PINNED_PROVIDER = os.getenv("EMBEDDING_PINNED_PROVIDER") or "DeepInfra"
BATCH_SIZE              = 50
SLEEP_BETWEEN_BATCHES   = 10  # seconds — cortesia com rate limit da OpenRouter

# Paths are relative to the project root — NOT to CWD.
# Corpus real (17 PDFs) usado em produção pelo bot via consultar_base_conhecimento.
DEFAULT_INPUT_DIR = PROJECT_ROOT / "pmo-bot-go" / "docs" / "knowledge_base"
CHECKPOINT_FILE    = PROJECT_ROOT / "ingest_checkpoint.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── Client initialisation ──────────────────────────────────────────────────────
sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── PDF extraction (PyMuPDF) ───────────────────────────────────────────────────

def extract_pdf_text(filepath: Path) -> str:
    """Extract all text from a PDF, preserving UTF-8 accents (ã, ç, ê, ô…)."""
    doc = fitz.open(str(filepath))
    pages: List[str] = [page.get_text() for page in doc if page.get_text().strip()]
    doc.close()
    return "\n\n".join(pages)


# ── OCR fallback (PDFs puramente escaneados, sem camada de texto) ──────────────
#
# O PyMuPDF só lê a camada de texto que já existe no PDF — não faz OCR (gap
# previsto na ADR-007, "Quando reconsiderar"). Quando extract_pdf_text() volta
# vazio, rodamos ocrmypdf (Tesseract, idioma Português) via Docker para gerar uma
# cópia com camada de texto, e extraímos dela com o mesmo extract_pdf_text().
# Exige Docker Desktop rodando; sem ele, o arquivo é pulado com aviso claro.

def ocr_pdf_to_text(filepath: Path) -> str:
    tmpdir = tempfile.mkdtemp(prefix="rag_ocr_")
    try:
        tmp_path = Path(tmpdir)
        input_copy = tmp_path / filepath.name
        shutil.copy(filepath, input_copy)
        output_copy = tmp_path / f"ocr_{filepath.name}"

        cmd = [
            "docker", "run", "--rm",
            "-v", f"{tmp_path}:/data",
            "jbarlow83/ocrmypdf",
            "--language", "por",
            "--force-ocr",  # já sabemos que não há camada de texto nenhuma
            f"/data/{input_copy.name}",
            f"/data/{output_copy.name}",
        ]

        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        except FileNotFoundError:
            logger.error("  Docker não encontrado no PATH — não é possível rodar OCR. Pulando.")
            return ""
        except subprocess.TimeoutExpired:
            logger.error("  OCR excedeu o tempo limite (600s). Pulando.")
            return ""

        if result.returncode != 0 or not output_copy.exists():
            logger.error(f"  ocrmypdf falhou (rc={result.returncode}): {result.stderr[-500:]}")
            return ""

        return extract_pdf_text(output_copy)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ── Text cleaning ──────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    """Remove TOC noise, bare page numbers, and excessive blank lines."""
    lines = text.split("\n")
    cleaned: List[str] = []
    for line in lines:
        stripped = line.strip()
        if re.search(r"\.{4,}", stripped):          # TOC entry (.......)
            continue
        if 0 < len(stripped) < 20 and not stripped.startswith("#"):  # orphan/page num
            continue
        cleaned.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(cleaned)).strip()


# ── Chunking ───────────────────────────────────────────────────────────────────

def split_text(text: str) -> List[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=150,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    return splitter.split_text(text)


# ── Embedding ──────────────────────────────────────────────────────────────────
#
# Replica exatamente o contrato de internal/supabase/client.go:GetEmbedding —
# mesmo modelo/provedor que o bot usa para todo o resto dos embeddings. A
# OpenRouter só aceita um texto por requisição neste endpoint (diferente do
# batch nativo do Gemini), então embeddar em lote aqui significa uma chamada
# HTTP por chunk — mais lento, mas correto: o que importa é cair no mesmo
# espaço vetorial que farm_documents.embedding_1024 já usa.

def _get_embedding_single(text: str) -> List[float]:
    payload = {
        "model": EMBEDDING_MODEL,
        "input": [text],
        "provider": {"order": [EMBEDDING_PINNED_PROVIDER], "allow_fallbacks": False},
    }

    for attempt in range(10):
        try:
            resp = requests.post(
                "https://openrouter.ai/api/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                data=json.dumps(payload),
                timeout=30,
            )
            if resp.status_code == 200:
                body = resp.json()
                return body["data"][0]["embedding"]

            err = f"HTTP {resp.status_code}: {resp.text[:300]}"
            if resp.status_code == 429:
                logger.warning(f"⚠️ Rate limit da OpenRouter. Pausa 65s... ({err})")
                time.sleep(65)
                continue
            raise RuntimeError(err)
        except requests.RequestException as e:
            wait = (2 ** attempt) + 5
            logger.warning(f"⚠️ Erro de rede no embedding (tentativa {attempt+1}/10): {e}. Retry em {wait}s")
            time.sleep(wait)

    raise RuntimeError("Falha crítica: embedding não obtido após 10 tentativas.")


def get_embeddings(texts: List[str], doc_name: str = "") -> List[List[float]]:
    """Embed a batch of text chunks, um por vez, via OpenRouter/bge-m3."""
    return [_get_embedding_single(t) for t in texts]


def pad(embedding: List[float], dim: int = EMBEDDING_DIMENSIONS) -> List[float]:
    if len(embedding) < dim:
        return embedding + [0.0] * (dim - len(embedding))
    return embedding[:dim]


def chunk_hash(doc_name: str, chunk_index: int, content: str) -> str:
    h = hashlib.sha256(f"{doc_name}|{chunk_index}|{content}".encode("utf-8"))
    return h.hexdigest()


# ── Checkpoint helpers ─────────────────────────────────────────────────────────

def get_file_hash(path: Path) -> str:
    sha = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(4096), b""):
            sha.update(block)
    return sha.hexdigest()


def load_checkpoint() -> Dict[str, Any]:
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_checkpoint(ck: Dict[str, Any]) -> None:
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(ck, f, indent=2, ensure_ascii=False)


# ── Core processing ────────────────────────────────────────────────────────────

def upsert_farm_documents(records: List[Dict[str, Any]]) -> None:
    """Upsert em farm_documents, mesmo contrato de UpsertFarmDocumentChunks (Go):
    on_conflict=chunk_hash + Prefer: resolution=merge-duplicates."""
    if not records:
        return
    sb.table("farm_documents").upsert(records, on_conflict="chunk_hash").execute()


def process_pdf(filepath: Path, categoria: str = "geral") -> None:
    logger.info(f"📄 Processando: {filepath.name}  [{categoria}]")

    # 1. Extract text with PyMuPDF (UTF-8 safe)
    try:
        raw = extract_pdf_text(filepath)
    except Exception as e:
        logger.error(f"  Falha na extração: {e}")
        return

    # 1b. Fallback de OCR — PDF sem camada de texto (escaneado puro)
    if not raw.strip():
        logger.warning(f"  Nenhum texto extraído (provável PDF escaneado). Tentando OCR via Docker/ocrmypdf...")
        raw = ocr_pdf_to_text(filepath)
        if raw.strip():
            logger.info(f"  OCR extraiu {len(raw)} caracteres.")
        else:
            logger.error(f"  OCR também não extraiu texto de {filepath.name}. Pulando.")
            return

    # 2. Clean + chunk
    clean = clean_text(raw)
    chunks = split_text(clean)
    logger.info(f"  {len(chunks)} chunks gerados.")

    if not chunks:
        logger.warning(f"  Nenhum chunk. Pulando.")
        return

    # 3. Batch embed (bge-m3) + upsert into farm_documents — a tabela que
    #    match_documents_with_context (chamada por consultar_base_conhecimento)
    #    de fato consulta.
    total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE

    for i in range(0, len(chunks), BATCH_SIZE):
        batch_texts = chunks[i : i + BATCH_SIZE]
        batch_idx   = (i // BATCH_SIZE) + 1

        logger.info(f"  Embedding lote {batch_idx}/{total_batches}...")
        embeddings = get_embeddings(batch_texts, filepath.name)

        records = []
        for j, (text, emb) in enumerate(zip(batch_texts, embeddings)):
            idx = i + j
            records.append({
                "pmo_id":             None,  # documento institucional global
                "document_name":      filepath.name,
                "chunk_index":        idx,
                "content":            text,
                "embedding_1024":     pad(emb),
                "chunk_hash":         chunk_hash(filepath.name, idx, text),
                "source_document_id": filepath.stem,
            })

        upsert_farm_documents(records)
        time.sleep(SLEEP_BETWEEN_BATCHES)

    logger.info(f"  ✅ {filepath.name} concluído ({len(chunks)} chunks em farm_documents).")


# ── PDF discovery ──────────────────────────────────────────────────────────────

def discover_pdfs(base: Path) -> List[Tuple[Path, str]]:
    results: List[Tuple[Path, str]] = []
    for d in sorted(base.iterdir()):
        if d.is_dir() and not d.name.startswith("."):
            for pdf in sorted(d.glob("*.pdf")):
                results.append((pdf, d.name))
    for pdf in sorted(base.glob("*.pdf")):
        results.append((pdf, "geral"))
    return results


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Ingestão de PDFs para RAG (farm_documents)")
    parser.add_argument("--force", action="store_true", help="Ignorar checkpoint e reindexa tudo")
    parser.add_argument("--dir", type=str, default=None,
                         help=f"Diretório de PDFs (padrão: {DEFAULT_INPUT_DIR})")
    args = parser.parse_args()

    input_dir = Path(args.dir).resolve() if args.dir else DEFAULT_INPUT_DIR

    if not input_dir.exists():
        logger.error(f"Diretório {input_dir} não existe.")
        return

    checkpoint = {} if args.force else load_checkpoint()
    pdfs       = discover_pdfs(input_dir)

    if not pdfs:
        logger.info("Nenhum PDF encontrado.")
        return

    logger.info(f"{len(pdfs)} PDF(s) encontrado(s).  --force={args.force}")

    for pdf_path, categoria in pdfs:
        fhash = get_file_hash(pdf_path)

        if not args.force and pdf_path.name in checkpoint:
            if checkpoint[pdf_path.name].get("hash") == fhash:
                logger.info(f"  Pulando {pdf_path.name} (sem alterações).")
                continue

        try:
            process_pdf(pdf_path, categoria)
            checkpoint[pdf_path.name] = {
                "hash":          fhash,
                "processed_at":  time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "categoria":     categoria,
            }
            save_checkpoint(checkpoint)
        except Exception as e:
            logger.error(f"Erro fatal em {pdf_path.name}: {e}")

    logger.info("🎉 Ingestão concluída.")


if __name__ == "__main__":
    main()
