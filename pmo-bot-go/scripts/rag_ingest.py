import sys
import os
import subprocess
import fitz  # PyMuPDF
from pathlib import Path

# Configuracao do Docling e VRAM
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.backend.docling_parse_backend import DoclingParseDocumentBackend

# Tentar importar configuracoes de aceleracao (GPU)
try:
    from docling.datamodel.pipeline_options import AcceleratorOptions, AcceleratorDevice
    HAS_ACCELERATOR = True
except ImportError:
    HAS_ACCELERATOR = False


def check_ocrmypdf_available():
    """
    Verifica se ocrmypdf e tesseract-ocr-por estao disponiveis no PATH.
    Retorna (True, versao_str) se OK, (False, mensagem_erro) se nao.
    """
    try:
        result = subprocess.run(
            ["ocrmypdf", "--version"],
            capture_output=True, text=True, check=True
        )
        version = result.stdout.strip() or result.stderr.strip()
        return True, f"ocrmypdf disponivel: {version}"
    except FileNotFoundError:
        msg = (
            "\n[ERRO] DEPENDENCIA FALTANDO: 'ocrmypdf' nao encontrado no PATH.\n"
            "   Instale conforme seu ambiente:\n"
            "   - WSL2/Ubuntu:  sudo apt install ocrmypdf tesseract-ocr-por\n"
            "   - Docker:       docker run --rm -v \"$PWD:/work\" jbarlow83/ocrmypdf [args]\n"
            "   - Windows puro: nao suportado nativamente; use WSL2 ou Docker.\n"
        )
        return False, msg
    except subprocess.CalledProcessError as e:
        return False, f"[ERRO] ocrmypdf encontrado mas retornou erro: {e.stderr}"

def is_native_digital_pdf(pdf_path, max_pages_to_check=5, char_threshold=100, word_threshold=20):
    """
    Gatekeeper: Analisa uma amostra de paginas para definir se o PDF possui 
    camada de texto nativa (digital) ou se eh apenas um xerox/scan (imagem).
    """
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Erro ao abrir PDF com PyMuPDF: {e}")
        return False
        
    pages_to_check = min(max_pages_to_check, len(doc))
    if pages_to_check == 0:
        return False
        
    valid_pages = 0
    for i in range(pages_to_check):
        text = doc[i].get_text()
        char_count = len(text.strip())
        word_count = len(text.split())
        
        if char_count > char_threshold and word_count > word_threshold:
            valid_pages += 1
            
    doc.close()
    
    # Heuristica de consistencia: Pelo menos 50% das paginas avaliadas devem ser validas
    # Isso evita falso positivo com uma pagina de sumario misturada com 300 paginas de imagens.
    consistency_ratio = valid_pages / pages_to_check
    
    if consistency_ratio >= 0.5:
        return True
    return False

def get_docling_converter():
    """
    Configura o Docling otimizado para extração de PDFs Nativos
    (do_ocr=False) protegendo a VRAM de 6GB (num_threads=1).
    """
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = False
    pipeline_options.generate_picture_images = False
    # Protecao contra bad_alloc via batch_size (conforme benchmark)
    pipeline_options.ocr_batch_size = 1
    pipeline_options.layout_batch_size = 1
    pipeline_options.table_batch_size = 1
    
    # Habilita GPU para o modelo de Layout se disponível
    if HAS_ACCELERATOR:
        pipeline_options.accelerator_options = AcceleratorOptions(
            num_threads=1, device=AcceleratorDevice.CUDA
        )
    
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options,
                backend=DoclingParseDocumentBackend
            )
        }
    )

def fallback_pymupdf_extraction(pdf_path):
    """Fallback caso o Docling falhe catastroficamente."""
    print("Iniciando Fallback PyMuPDF (Perda estrutural esperada)...")
    doc = fitz.open(pdf_path)
    full_text = []
    for page in doc:
        full_text.append(page.get_text())
    doc.close()
    return "\n\n".join(full_text)

def ingest_pdf(pdf_path):
    print(f"Iniciando ingestao do arquivo: {pdf_path}")
    
    # 1. Gatekeeper: Validar Densidade e Consistencia Textual
    print("Analisando densidade textual (Gatekeeper)...")
    is_digital = is_native_digital_pdf(pdf_path)
    
    if not is_digital:
        # ROTA 2: Escaneado — verificar dependencia antes de tentar OCR
        print("PDF Escaneado detectado. Verificando disponibilidade do ocrmypdf...")
        
        available, msg = check_ocrmypdf_available()
        if not available:
            print(msg)
            print("Ingestao abortada: PDF escaneado sem ferramenta de OCR disponivel.")
            return None
        
        print(msg)  # imprime a versao disponivel
        
        ocr_pdf_path = pdf_path.replace(".pdf", "_ocr.pdf")
        print(f"Executando: ocrmypdf --force-ocr --language por \"{pdf_path}\" \"{ocr_pdf_path}\"")
        
        try:
            ocr_result = subprocess.run(
                ["ocrmypdf", "--force-ocr", "--language", "por", pdf_path, ocr_pdf_path],
                capture_output=True, text=True, check=True
            )
            print("[OK] OCR concluido com sucesso!")
            if ocr_result.stderr:
                print(f"[ocrmypdf stderr]: {ocr_result.stderr.strip()}")
            
            # Continuar o fluxo com o PDF OCRizado
            pdf_path = ocr_pdf_path
            
        except subprocess.CalledProcessError as e:
            print(f"[ERRO] ocrmypdf falhou (exit code {e.returncode})")
            print(f"   stdout: {e.stdout.strip()}")
            print(f"   stderr: {e.stderr.strip()}")
            print("Ingestao abortada.")
            return None
        except Exception as e:
            print(f"[ERRO] Erro inesperado durante OCR: {e}")
            return None
    # ROTA 1: Nativo Digital
    print("PDF Nativo validado. Direcionando para Docling (do_ocr=False)...")
    try:
        converter = get_docling_converter()
        result = converter.convert(pdf_path)
        print("Extracao estrutural concluida com sucesso via Docling!")
        
        # 2. Chunking Semantico com HybridChunker
        print("Iniciando fatiamento semantico (HybridChunker)...")
        from transformers import AutoTokenizer
        from docling.chunking import HybridChunker
        from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
        
        # Tokenizer do bge-m3 para garantir limite de tokens coerente com o embedding
        tokenizer_model = "BAAI/bge-m3"
        auto_tok = AutoTokenizer.from_pretrained(tokenizer_model)
        hf_tokenizer = HuggingFaceTokenizer(tokenizer=auto_tok, max_tokens=512)
        
        chunker = HybridChunker(tokenizer=hf_tokenizer)
        chunk_iter = chunker.chunk(result.document)
        
        chunks_data = []
        for i, chunk in enumerate(chunk_iter):
            # Extrair metadados profundos (Headings, page ranges)
            headings = chunk.meta.headings if hasattr(chunk.meta, 'headings') else []
            heading_path = " > ".join(headings) if headings else ""
            
            # Formatar ranges de paginas para referenciamento
            page_ranges = "unknown"
            if hasattr(chunk.meta, 'doc_items') and chunk.meta.doc_items:
                pages = set()
                for item in chunk.meta.doc_items:
                    if hasattr(item, 'prov') and item.prov:
                        for p in item.prov:
                            pages.add(p.page_no)
                if pages:
                    sorted_pages = sorted(list(pages))
                    if len(sorted_pages) > 1:
                        page_ranges = f"{sorted_pages[0]}-{sorted_pages[-1]}"
                    else:
                        page_ranges = str(sorted_pages[0])
            
            chunks_data.append({
                "id": i,
                "text": chunk.text,
                "heading_path": heading_path,
                "page_ranges": page_ranges,
                "tokens": len(auto_tok.encode(chunk.text))
            })
            
        print(f"Gerados {len(chunks_data)} chunks com sucesso.")
        return chunks_data
        
    except Exception as e:
        print(f"Erro fatal no Docling/Chunker: {e}")
        # ROTA 3: Fallback de Seguranca — extrai texto bruto via PyMuPDF
        # Aviso: perde estrutura (headings, tabelas), mas preserva o conteudo textual.
        import traceback
        traceback.print_exc()
        print("\n[AVISO] Ativando Fallback PyMuPDF (extracao sem estrutura)...")
        try:
            raw_text = fallback_pymupdf_extraction(pdf_path)
            if not raw_text or not raw_text.strip():
                print("[ERRO] Fallback PyMuPDF nao extraiu texto. Arquivo pode estar corrompido.")
                return None
            # Chunking simples por paragrafos (sem HybridChunker, sem tokenizer)
            paragraphs = [p.strip() for p in raw_text.split("\n\n") if len(p.strip()) > 50]
            chunks_data = [
                {
                    "id": i,
                    "text": p,
                    "heading_path": "",  # sem contexto estrutural no fallback
                    "page_ranges": "unknown",
                    "tokens": len(p.split())  # aproximacao por palavras, sem tokenizer
                }
                for i, p in enumerate(paragraphs)
            ]
            print(f"[AVISO] Fallback gerou {len(chunks_data)} chunks sem estrutura (qualidade reduzida).")
            return chunks_data
        except Exception as fallback_err:
            print(f"[ERRO] Fallback PyMuPDF tambem falhou: {fallback_err}")
            return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python rag_ingest.py <caminho_do_pdf>")
        sys.exit(1)
        
    file_path = sys.argv[1]
    
    if not os.path.exists(file_path):
        print(f"Erro: Arquivo {file_path} nao encontrado.")
        sys.exit(1)
        
    chunks_json = ingest_pdf(file_path)
    
    if chunks_json:
        import json
        out_name = Path(file_path).stem + "_chunks.json"
        with open(out_name, "w", encoding="utf-8") as f:
            json.dump({"source": file_path, "chunks": chunks_json}, f, ensure_ascii=False, indent=2)
        print(f"Resultado salvo em {out_name}")
