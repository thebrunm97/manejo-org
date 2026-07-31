"""
rag_ingest.py — Ingestão de PDFs na base de conhecimento RAG (knowledge_chunks)

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

Pipeline:
  1. Extrai texto dos PDFs com PyMuPDF (UTF-8 correto, preserva acentos)
  2. Limpa e divide em chunks semânticos (LangChain RecursiveCharacterTextSplitter)
  3. Extrai metadados via Gemini AI (título, autor, ano, instituição)
  4. Faz upsert em knowledge_documents (rastreabilidade)
  5. Insere chunks em knowledge_chunks (consultado pelo RPC match_farm_documents)
  6. Gera embeddings Gemini 3072d e mantém checkpoint por hash de arquivo

Uso:
  python scripts/rag_ingest.py          # processa apenas arquivos novos/modificados
  python scripts/rag_ingest.py --force  # reindexa tudo (re-vetorização completa)

Dependências:
  pip install pymupdf google-genai supabase langchain-text-splitters python-dotenv
"""

import sys
import os
import re
import json
import time
import hashlib
import logging
import argparse
import requests
from typing import List, Dict, Any, Tuple
from pathlib import Path

# Root of the project = parent of the 'scripts/' directory
SCRIPT_DIR   = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# External Libraries
# Install: pip install pymupdf google-genai supabase langchain-text-splitters python-dotenv
try:
    import fitz  # PyMuPDF — UTF-8 safe, handles Portuguese accents correctly
    from google import genai
    from google.genai import types
    from supabase import create_client, Client
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    from dotenv import load_dotenv, find_dotenv
except ImportError as e:
    print(
        f"Missing dependency: {e}. "
        "Run: pip install pymupdf google-genai supabase langchain-text-splitters python-dotenv"
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

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL   = os.getenv("SUPABASE_URL")
SUPABASE_KEY   = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

missing = [v for v, k in [("GEMINI_API_KEY", GEMINI_API_KEY), ("SUPABASE_URL", SUPABASE_URL),
                           ("SUPABASE_SERVICE_ROLE_KEY", SUPABASE_KEY)] if not k]
if missing:
    sys.exit(f"[ERROR] Variáveis de ambiente ausentes: {', '.join(missing)}")

EMBEDDING_MODEL       = "gemini-embedding-001"
EMBEDDING_DIMENSIONS  = 3072
BATCH_SIZE            = 50
SLEEP_BETWEEN_BATCHES = 10  # seconds — safety against 100 RPM limit

# Paths are relative to the project root — NOT to CWD
INPUT_DIR       = PROJECT_ROOT / "knowledge_repo"
CHECKPOINT_FILE = PROJECT_ROOT / "ingest_checkpoint.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── Client initialisation ──────────────────────────────────────────────────────
gemini: genai.Client = genai.Client(api_key=GEMINI_API_KEY)
sb: Client           = create_client(SUPABASE_URL, SUPABASE_KEY)


# ── PDF extraction (PyMuPDF) ───────────────────────────────────────────────────

def extract_pdf_text(filepath: Path) -> str:
    """Extract all text from a PDF, preserving UTF-8 accents (ã, ç, ê, ô…)."""
    doc = fitz.open(str(filepath))
    pages: List[str] = [page.get_text() for page in doc if page.get_text().strip()]
    doc.close()
    return "\n\n".join(pages)


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


# ── AI Metadata extraction ─────────────────────────────────────────────────────

def extrair_metadados(texto: str) -> Dict[str, str]:
    prompt = f"""Analise o texto abaixo (capa/início de um manual agronômico).
Retorne ESTRITAMENTE em JSON com as chaves: titulo, autor, ano, instituicao.
Texto:\n{texto[:3000]}"""

    try:
        r = gemini.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return json.loads(r.text)
    except Exception as e:
        logger.warning(f"⚠️ Gemini falhou para metadados: {e}. Tentando OpenRouter...")

    try:
        or_key = os.getenv("OPENROUTER_API_KEY")
        if not or_key:
            raise ValueError("OPENROUTER_API_KEY não encontrada.")
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {or_key}", "Content-Type": "application/json"},
            data=json.dumps({
                "model": "google/gemini-2.0-flash-001",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
            }),
            timeout=30,
        )
        if resp.status_code == 200:
            return json.loads(resp.json()["choices"][0]["message"]["content"])
    except Exception as oe:
        logger.error(f"❌ OpenRouter falhou: {oe}")

    return {"titulo": "Desconhecido", "autor": "Desconhecido", "ano": "Desconhecido", "instituicao": "Desconhecido"}


# ── Embedding ──────────────────────────────────────────────────────────────────

def get_embeddings(texts: List[str], doc_name: str = "") -> List[List[float]]:
    """Embed a batch of text chunks using the asymmetric title|text prefix."""
    base = Path(doc_name).stem.replace("_", " ") if doc_name else ""
    prefixed = [f"title: {base} | text: {t}" if base else f"text: {t}" for t in texts]

    quota_retries, max_quota = 0, 3

    for attempt in range(10):
        try:
            result = gemini.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=prefixed,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=EMBEDDING_DIMENSIONS,
                ),
            )
            return [emb.values for emb in result.embeddings]
        except Exception as e:
            err = str(e).lower()
            if "429" in err or "resource_exhausted" in err or "quota" in err:
                quota_retries += 1
                if quota_retries > max_quota:
                    raise RuntimeError(f"Rate limit persistente após {max_quota} tentativas.")
                logger.warning(f"⚠️ Rate Limit. Pausa 65s... ({quota_retries}/{max_quota})")
                time.sleep(65)
                continue
            wait = (2 ** attempt) + 5
            logger.warning(f"⚠️ Erro embedding (tentativa {attempt+1}/10): {e}. Retry em {wait}s")
            time.sleep(wait)

    raise RuntimeError("Falha crítica: embeddings não obtidos.")


def pad(embedding: List[float], dim: int = 3072) -> List[float]:
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

def upsert_document_record(filepath: Path, chunks_count: int, meta: Dict[str, str]) -> str:
    """Insert/update the knowledge_documents record and return its ID."""
    payload = {
        "filename":     filepath.name,
        "total_chunks": chunks_count,
        "title":        meta.get("titulo") or filepath.stem.replace("_", " ").title(),
        "author":       meta.get("autor", "Desconhecido"),
        "year":         str(meta.get("ano", "Desconhecido")),
        "institution":  meta.get("instituicao", "Desconhecido"),
        "updated_at":   "now()",
    }
    result = sb.table("knowledge_documents").upsert(payload, on_conflict="filename").execute()
    if result.data:
        return result.data[0].get("id", "")
    return ""


def process_pdf(filepath: Path, categoria: str = "geral") -> None:
    logger.info(f"📄 Processando: {filepath.name}  [{categoria}]")

    # 1. Extract text with PyMuPDF (UTF-8 safe)
    try:
        raw = extract_pdf_text(filepath)
    except Exception as e:
        logger.error(f"  Falha na extração: {e}")
        return

    # 2. Clean + chunk
    clean = clean_text(raw)
    chunks = split_text(clean)
    logger.info(f"  {len(chunks)} chunks gerados.")

    if not chunks:
        logger.warning(f"  Nenhum chunk. Pulando.")
        return

    # 3. AI metadata
    meta = extrair_metadados(raw[:3000])

    # 4. Upsert knowledge_documents record
    source_doc_id = upsert_document_record(filepath, len(chunks), meta)

    # 5. Batch embed + insert into knowledge_chunks (queried by match_farm_documents UNION ALL)
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
                "document_name":    filepath.name,
                "chunk_index":      idx,
                "content":          text,
                "embedding":        pad(emb),
                "metadata": {
                    "source":          filepath.name,
                    "batch":           batch_idx,
                    "categoria_fonte": categoria,
                },
            })

        # Insert into knowledge_chunks — queried by match_farm_documents RPC via UNION ALL
        sb.table("knowledge_chunks").insert(records).execute()
        time.sleep(SLEEP_BETWEEN_BATCHES)

    logger.info(f"  ✅ {filepath.name} concluído ({len(chunks)} chunks em knowledge_chunks).")


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
    args = parser.parse_args()

    if not INPUT_DIR.exists():
        INPUT_DIR.mkdir(parents=True)
        logger.info(f"Diretório {INPUT_DIR} criado. Adicione PDFs nas subpastas:")
        logger.info(f"  {INPUT_DIR}/institucional/      → cartilhas EMBRAPA, MAPA")
        logger.info(f"  {INPUT_DIR}/academico/          → artigos, dissertações")
        logger.info(f"  {INPUT_DIR}/movimentos_sociais/ → MST, La Via Campesina")
        return

    checkpoint = {} if args.force else load_checkpoint()
    pdfs       = discover_pdfs(INPUT_DIR)

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
