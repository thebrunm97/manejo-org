"""
Extractor for Portaria MAPA N52/2021 PDF
Splits the document into chunks by article/section and outputs JSON.
"""
import json
import re
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("pypdf not found. Installing...", file=sys.stderr)
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "pypdf"], check=True)
    from pypdf import PdfReader

PDF_PATH = Path(__file__).parent.parent / "docs" / "knowledge_base" / "PORTARIAMAPAN52.2021 (2).pdf"
OUTPUT_PATH = Path(__file__).parent / "portaria52_chunks.json"


def extract_full_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n".join(pages)


def clean_text(text: str) -> str:
    # Normalize whitespace but preserve structure
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\r', '\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def split_into_chunks(text: str) -> list[dict]:
    """
    Split document into chunks by:
    1. Articles (Art. N)
    2. Sections (CAPÍTULO/SEÇÃO/TÍTULO)
    3. Annexes
    """
    chunks = []
    
    # Patterns for section headers
    patterns = [
        # Títulos / Capítulos / Seções
        r'(TÍTULO\s+[IVXLCDM]+[^\n]*)',
        r'(CAP[IÍ]TULO\s+[IVXLCDM]+[^\n]*)',
        r'(SE[CÇ][AÃ]O\s+[IVXLCDM]+[^\n]*)',
        r'(SUBSE[CÇ][AÃ]O\s+[IVXLCDM]+[^\n]*)',
        # Artigos
        r'(Art\.\s*\d+[°º]?[^\n]*(?:\n(?!Art\.\s*\d)[^\n]*)*)',
        # Parágrafos e Incisos  
        r'(ANEXO\s+[IVXLCDM]+[^\n]*)',
    ]
    
    # Primary split: by Article
    article_pattern = re.compile(
        r'(Art\.?\s*\d+[°º]?\.?\s)',
        re.IGNORECASE
    )
    
    parts = article_pattern.split(text)
    
    chunk_id = 0
    current_section = "Preâmbulo"
    
    # Process preamble (before first article)
    preamble_text = parts[0].strip() if parts else ""
    
    # Try to identify sections in preamble
    section_re = re.compile(
        r'(CAP[IÍ]TULO\s+[IVXLCDM]+|TÍTULO\s+[IVXLCDM]+|SE[CÇ][AÃ]O\s+[IVXLCDM]+)',
        re.IGNORECASE
    )
    
    if preamble_text and len(preamble_text) > 50:
        # Split preamble into sections
        preamble_sections = section_re.split(preamble_text)
        for i in range(0, len(preamble_sections), 2):
            if i + 1 < len(preamble_sections):
                section_name = preamble_sections[i + 1].strip()
                section_content = preamble_sections[i].strip()
                if section_content and len(section_content) > 30:
                    chunks.append({
                        "id": f"chunk_{chunk_id:03d}",
                        "tipo": "secao",
                        "titulo": section_name if section_name else "Preâmbulo",
                        "text": section_content[:2000]
                    })
                    chunk_id += 1
                current_section = section_name if section_name else current_section
            else:
                content = preamble_sections[i].strip()
                if content and len(content) > 30:
                    chunks.append({
                        "id": f"chunk_{chunk_id:03d}",
                        "tipo": "preambulo",
                        "titulo": "Preâmbulo/Ementa",
                        "text": content[:2000]
                    })
                    chunk_id += 1
    
    # Process articles
    i = 1
    while i < len(parts) - 1:
        art_header = parts[i]  # e.g., "Art. 1º "
        art_body = parts[i + 1] if i + 1 < len(parts) else ""
        
        # Extract article number
        art_num_match = re.search(r'\d+', art_header)
        art_num = art_num_match.group() if art_num_match else str(chunk_id)
        
        # Check if there's a section header within the body
        body_parts = section_re.split(art_body)
        
        full_article_text = (art_header + body_parts[0]).strip()
        
        # Detect section transitions in body
        for j in range(1, len(body_parts), 2):
            if j + 1 < len(body_parts):
                current_section = body_parts[j].strip()
        
        if full_article_text and len(full_article_text) > 10:
            # Extract first line as title context
            first_line = full_article_text.split('\n')[0][:100]
            
            chunks.append({
                "id": f"art_{art_num.zfill(3)}",
                "tipo": "artigo",
                "titulo": f"Art. {art_num} - {current_section}",
                "text": full_article_text[:3000]
            })
            chunk_id += 1
        
        i += 2
    
    return chunks


def add_section_chunks(chunks: list[dict], text: str) -> list[dict]:
    """Add high-level section chunks (Capítulos, Títulos) for broader context."""
    section_re = re.compile(
        r'(CAP[IÍ]TULO\s+[IVXLCDM]+[^\n]*(?:\n[A-Z][^\n]+)*)',
        re.IGNORECASE
    )
    
    section_chunks = []
    existing_ids = {c["id"] for c in chunks}
    
    for match in section_re.finditer(text):
        section_text = match.group().strip()
        section_title = section_text.split('\n')[0][:100]
        # Create a safe ID from section title
        safe_id = re.sub(r'[^a-z0-9]', '_', section_title.lower())[:30].strip('_')
        chunk_id_val = f"sec_{safe_id}"
        
        if chunk_id_val not in existing_ids and len(section_text) > 20:
            section_chunks.append({
                "id": chunk_id_val,
                "tipo": "capitulo",
                "titulo": section_title,
                "text": section_text[:500]
            })
            existing_ids.add(chunk_id_val)
    
    return chunks + section_chunks


def main():
    print(f"[1/4] Lendo PDF: {PDF_PATH}")
    if not PDF_PATH.exists():
        print(f"ERRO: PDF não encontrado em {PDF_PATH}")
        sys.exit(1)
    
    full_text = extract_full_text(PDF_PATH)
    print(f"[2/4] Texto extraído: {len(full_text)} caracteres")
    
    full_text = clean_text(full_text)
    
    print("[3/4] Dividindo em chunks por artigo...")
    chunks = split_into_chunks(full_text)
    chunks = add_section_chunks(chunks, full_text)
    
    print(f"[4/4] Salvando {len(chunks)} chunks em {OUTPUT_PATH}")
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Chunks gerados com sucesso!")
    print(f"   Total de chunks: {len(chunks)}")
    print(f"   Arquivo: {OUTPUT_PATH}")
    
    # Show sample
    print("\n--- Amostra dos primeiros 3 chunks ---")
    for chunk in chunks[:3]:
        print(f"\n[{chunk['id']}] {chunk['titulo']}")
        print(f"   Texto: {chunk['text'][:200]}...")


if __name__ == "__main__":
    main()
