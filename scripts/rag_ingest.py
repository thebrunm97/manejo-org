import os
import json
import time
import hashlib
import logging
import shutil
import requests
from typing import List, Dict, Any
from pathlib import Path
from pypdf import PdfReader, PdfWriter

# External Libraries (Install via: pip install docling google-generativeai supabase langchain-text-splitters python-dotenv)
try:
    import torch
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.datamodel.accelerator_options import AcceleratorOptions, AcceleratorDevice
    import google.generativeai as genai
    from supabase import create_client, Client
    from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
    from dotenv import load_dotenv
except ImportError as e:
    print(f"Missing dependency: {e}. Please run: pip install docling google-generativeai supabase langchain-text-splitters python-dotenv")
    exit(1)

# --- CONFIGURATION ---
load_dotenv(".env.prod")

# API Keys & URLs
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use service role for bulk inserts

# Model & Limits
EMBEDDING_MODEL = "models/gemini-embedding-2-preview"
BATCH_SIZE = 50  # Number of chunks per embedding request (Google limit ~100)
RPD_LIMIT = 1500  # Requests Per Day budget
TPM_LIMIT = 1000000  # Tokens Per Minute limit (approx)
SLEEP_BETWEEN_BATCHES = 10 # Seconds. Hardcoded for better safety against 100 RPM limit.

# Paths
INPUT_DIR = Path("./knowledge_repo")  # Put your PDFs here
CHECKPOINT_FILE = Path("ingest_checkpoint.json")

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- INITIALIZATION ---
genai.configure(api_key=GEMINI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# CUDA Diagnostic
cuda_available = torch.cuda.is_available()
print(f"🚀 CUDA Diagnostic: {'YES' if cuda_available else 'NO'}")
if cuda_available:
    print(f"🎸 GPU Device: {torch.cuda.get_device_name(0)}")

# Initialize Docling converter with CUDA support (requires CUDA 12.1 + Python 3.12 environment)
pipeline_options = PdfPipelineOptions()
if cuda_available:
    pipeline_options.accelerator_options.device = AcceleratorDevice.CUDA
    pipeline_options.accelerator_options.num_threads = 8

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
    }
)

def fatiar_pdf(caminho_arquivo: Path, paginas_por_fatia: int = 15) -> List[Path]:
    """Slices a large PDF into smaller ones to avoid memory issues with Docling."""
    print(f"✂️ Fatiando PDF: {caminho_arquivo.name}...")
    temp_dir = Path("./temp_slices")
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    reader = PdfReader(caminho_arquivo)
    total_paginas = len(reader.pages)
    fatias = []
    
    for i in range(0, total_paginas, paginas_por_fatia):
        writer = PdfWriter()
        fim = min(i + paginas_por_fatia, total_paginas)
        
        for pagina_num in range(i, fim):
            writer.add_page(reader.pages[pagina_num])
            
        fatia_path = temp_dir / f"chunk_{len(fatias) + 1}.pdf"
        with open(fatia_path, "wb") as f:
            writer.write(f)
        fatias.append(fatia_path)
        
    print(f"✅ PDF fatiado em {len(fatias)} partes.")
    return fatias

def extrair_metadados_com_ia(texto_inicial):
    print("🧠 Extraindo metadados da capa com Inteligência Artificial...")
    
    prompt = f"""
    Analise o texto abaixo, que é a capa/início de um manual técnico agronômico.
    Extraia as seguintes informações e retorne ESTRITAMENTE em formato JSON:
    - "titulo": Título completo do documento.
    - "autor": Nome do autor principal, autores, ou organizadores (ex: "Flávia M. V. T. Clemente").
    - "ano": Ano de publicação (apenas o número, ex: "2015"). Se não achar, use "Desconhecido".
    - "instituicao": Instituição responsável (ex: "Embrapa Hortaliças", "MAPA").

    Texto do Documento:
    {texto_inicial[:3000]}
    """

    # 1. Tentar via Google SDK (Free Tier)
    try:
        modelo = genai.GenerativeModel('gemini-2.0-flash')
        resposta = modelo.generate_content(prompt, generation_config=genai.GenerationConfig(response_mime_type="application/json"))
        return json.loads(resposta.text)
    except Exception as e:
        logger.warning(f"⚠️ Google API falhou ou quota excedida: {e}. Tentando Fallback via OpenRouter...")
        
        # 2. Fallback via OpenRouter
        try:
            openrouter_key = os.getenv("OPENROUTER_API_KEY")
            if not openrouter_key:
                raise Exception("OPENROUTER_API_KEY não encontrada no ambiente.")
                
            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openrouter_key}",
                    "Content-Type": "application/json",
                },
                data=json.dumps({
                    "model": "google/gemini-2.0-flash-001",
                    "messages": [
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"}
                })
            )
            
            if response.status_code == 200:
                content = response.json()['choices'][0]['message']['content']
                return json.loads(content)
            else:
                raise Exception(f"OpenRouter Error {response.status_code}: {response.text}")
                
        except Exception as o_err:
            logger.error(f"❌ Fallback via OpenRouter também falhou: {o_err}")
            return {"titulo": "Desconhecido", "autor": "Desconhecido", "ano": "Desconhecido", "instituicao": "Desconhecido"}

def get_file_hash(filepath: Path) -> str:
    """Calculate SHA256 of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def load_checkpoint() -> Dict[str, Any]:
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, "r") as f:
            return json.load(f)
    return {}

def save_checkpoint(checkpoint: Dict[str, Any]):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(checkpoint, f, indent=2)

def split_text(markdown_text: str) -> List[str]:
    """Split markdown into semantic chunks."""
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]
    
    header_splitter = MarkdownHeaderTextSplitter(headers_to_split_on=headers_to_split_on)
    sections = header_splitter.split_text(markdown_text)
    
    recursive_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=150
    )
    
    final_chunks = []
    for section in sections:
        # Merge metadata into content to preserve context
        header_context = " > ".join([v for k, v in section.metadata.items()])
        content = f"{header_context}\n\n{section.page_content}" if header_context else section.page_content
        
        chunks = recursive_splitter.split_text(content)
        final_chunks.extend(chunks)
        
    return final_chunks

def get_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """Fetch embeddings in batch with defensive rate limit logic."""
    quota_delay_seconds = 65
    max_quota_retries = 3
    quota_retries = 0
    
    # Total combined attempts (general errors + quota errors)
    for attempt in range(10):
        try:
            result = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=texts,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            error_msg = str(e).lower()
            
            # Specific check for Rate Limit / Quota
            if "429" in error_msg or "resource_exhausted" in error_msg or "quota" in error_msg:
                quota_retries += 1
                if quota_retries > max_quota_retries:
                    logger.error(f"❌ Lote abortado: Limite de cota excedido {max_quota_retries} vezes consecutivas.")
                    raise Exception(f"Erro 429 persistente após {max_quota_retries} tentativas de 65s.")
                
                logger.warning(f"⚠️ Rate Limit (429) detectado. Pausando {quota_delay_seconds}s para reset de cota... ({quota_retries}/{max_quota_retries})")
                time.sleep(quota_delay_seconds)
                continue # Re-executa o loop para tentar o mesmo lote
            
            # Handling for other transient errors
            wait_time = (2 ** attempt) + 5
            logger.warning(f"⚠️ Erro na API de Embedding: {e}. Tentando novamente em {wait_time}s...")
            time.sleep(wait_time)
            
    raise Exception("Falha crítica ao obter embeddings após múltiplas tentativas.")

def process_pdf(filepath: Path):
    logger.info(f"Processing: {filepath.name}")
    
    # 1. Extraction (with Auto-Splitter)
    md_text_completo = ""
    target_temp_dir = Path("./temp_slices")
    
    try:
        fatias = fatiar_pdf(filepath)
        for idx, fatia_path in enumerate(fatias):
            logger.info(f"Converting slice {idx+1}/{len(fatias)}...")
            doc = converter.convert(fatia_path)
            md_text_completo += doc.document.export_to_markdown() + "\n\n"
            
        # Cleanup slices immediately after conversion
        if target_temp_dir.exists():
            shutil.rmtree(target_temp_dir)
            
    except Exception as e:
        logger.error(f"Docling conversion failed for {filepath.name}: {e}")
        if target_temp_dir.exists():
            shutil.rmtree(target_temp_dir)
        return
    
    # 2. Chunking & Metadata Extraction
    chunks = split_text(md_text_completo)
    logger.info(f"Generated {len(chunks)} chunks for {filepath.name}")
    
    # AI Metadata Extraction from combined text
    meta_ia = extrair_metadados_com_ia(md_text_completo[:3000])
    
    # 3. Supabase: Insert Mother Document
    # We use upsert on filename (unique)
    doc_payload = {
        "filename": filepath.name,
        "total_chunks": len(chunks),
        "title": meta_ia.get("titulo") or filepath.stem.replace("_", " ").title(),
        "author": meta_ia.get("autor", "Desconhecido"),
        "year": str(meta_ia.get("ano", "Desconhecido")),
        "institution": meta_ia.get("instituicao", "Desconhecido"),
        "updated_at": "now()"
    }
    supabase.table("knowledge_documents").upsert(doc_payload).execute()
    
    # 4. Batch Embedding & Insertion
    total_batches = (len(chunks) + BATCH_SIZE - 1) // BATCH_SIZE
    
    for i in range(0, len(chunks), BATCH_SIZE):
        batch_texts = chunks[i : i + BATCH_SIZE]
        batch_idx = (i // BATCH_SIZE) + 1
        
        logger.info(f"Embedding batch {batch_idx}/{total_batches} for {filepath.name}...")
        embeddings = get_batch_embeddings(batch_texts)
        
        chunk_records = []
        for j, (text, emb) in enumerate(zip(batch_texts, embeddings)):
            chunk_records.append({
                "document_name": filepath.name,
                "chunk_index": i + j,
                "content": text,
                "embedding": emb,
                "metadata": {"source": filepath.name, "batch": batch_idx}
            })
            
        # Bulk insert into Supabase
        supabase.table("knowledge_chunks").insert(chunk_records).execute()
        
        # Respect Rate Limits
        time.sleep(SLEEP_BETWEEN_BATCHES)

def main():
    if not INPUT_DIR.exists():
        INPUT_DIR.mkdir()
        logger.info(f"Created {INPUT_DIR}. Put your PDFs there.")
        return

    checkpoint = load_checkpoint()
    
    pdf_files = list(INPUT_DIR.glob("*.pdf"))
    if not pdf_files:
        logger.info("No PDF files found in knowledge_repo/")
        return
        
    for pdf_path in pdf_files:
        file_hash = get_file_hash(pdf_path)
        
        if pdf_path.name in checkpoint and checkpoint[pdf_path.name]["hash"] == file_hash:
            logger.info(f"Skipping {pdf_path.name} (already processed and unchanged)")
            continue
            
        try:
            process_pdf(pdf_path)
            
            # Update checkpoint
            checkpoint[pdf_path.name] = {
                "hash": file_hash,
                "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }
            save_checkpoint(checkpoint)
            
        except Exception as e:
            logger.error(f"Fatal error processing {pdf_path.name}: {e}")
            # Continue to next file
            continue

    logger.info("Ingestion process completed.")

if __name__ == "__main__":
    main()
