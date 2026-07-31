import os
import sys
import csv
import time
from pathlib import Path

# Forçar output em UTF-8 no Windows para evitar crash com os Emojis do print
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

# Tentativa de importar PyTorch para detectar CUDA
try:
    import torch
    HAS_TORCH = True
    USE_CUDA = torch.cuda.is_available()
except ImportError:
    HAS_TORCH = False
    USE_CUDA = False

# --- HACK PARA O ONNXRUNTIME ACHAR A GPU NO WINDOWS ---
# O onnxruntime-gpu precisa das DLLs do CUDA (cuDNN, cuBLAS).
# Em vez de instalar o Toolkit da NVIDIA no sistema, fazemos ele 
# "pegar emprestado" as DLLs que o PyTorch já baixou na pasta lib/.
try:
    import torch
    torch_lib_path = os.path.join(os.path.dirname(torch.__file__), "lib")
    os.environ["PATH"] = torch_lib_path + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass
# --------------------------------------------------------

import fitz  # PyMuPDF

# Tentativa de importar o Docling e as opções de configuração
try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    
    # Tentativa de importar classes de configuração robusta (Docling 2.x+)
    try:
        from docling.datamodel.pipeline_options import AcceleratorOptions, AcceleratorDevice
    except ImportError:
        try:
            from docling.datamodel.base_models import AcceleratorOptions, AcceleratorDevice
        except ImportError:
            AcceleratorOptions = None
            AcceleratorDevice = None

    HAS_DOCLING = True
except ImportError:
    HAS_DOCLING = False

def get_docling_converter():
    if not HAS_DOCLING:
        return None
        
    pipeline_options = PdfPipelineOptions()
    # HACK: Limitar o tamanho dos lotes (batch size) para 1.
    pipeline_options.ocr_batch_size = 1
    pipeline_options.layout_batch_size = 1
    pipeline_options.table_batch_size = 1
    
    # DESLIGAR OCR: Como as páginas da Embrapa geram VRAM overflow mesmo com batch=1
    # devido a resoluções absurdamente altas (std::bad_alloc), desativamos o OCR 
    # de imagens e focamos apenas no Layout Parsing.
    pipeline_options.do_ocr = False
    
    if AcceleratorOptions and AcceleratorDevice:
        # Abordagem Sólida: Usando as classes e enums oficiais da documentação do Docling
        device = AcceleratorDevice.CUDA if USE_CUDA else AcceleratorDevice.CPU
        try:
            pipeline_options.accelerator_options = AcceleratorOptions(device=device)
            print(f"[Docling Config] AcceleratorOptions ativado com sucesso: device={device.name}")
        except Exception as e:
            print(f"[Docling Config] Erro ao configurar AcceleratorOptions: {e}")
    else:
        # Fallback legado usando string
        device_name = "cuda" if USE_CUDA else "cpu"
        try:
            pipeline_options.accelerator_options.device = device_name
            print(f"[Docling Config] Accelerator device explicitamente definido via string para: {device_name}")
        except AttributeError:
            print(f"[Docling Config] API de acelerador não encontrada na versão instalada. Usando comportamento default (AUTO/CPU).")
        
    # Inicializa o conversor
    converter = DocumentConverter(
        format_options={
            "pdf": PdfFormatOption(pipeline_options=pipeline_options)
        }
    )
    return converter

def extract_pymupdf(pdf_path):
    # Extração nativa em CPU usando a API fitz (C engine)
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        page_text = page.get_text()
        if page_text:
            text += page_text + "\n\n"
    return text

def main():
    # Estrutura de diretórios relativa à localização do script (pmo-bot-go/scripts)
    base_dir = Path(os.path.abspath(__file__)).parent.parent
    knowledge_base_dir = base_dir / "docs" / "knowledge_base"
    results_dir = base_dir / "benchmark_results"
    
    pymupdf_dir = results_dir / "pymupdf"
    docling_dir = results_dir / "docling"
    
    # Garante a criação dos diretórios mesmo que os arquivos não gerem resultados depois
    pymupdf_dir.mkdir(parents=True, exist_ok=True)
    docling_dir.mkdir(parents=True, exist_ok=True)
    
    csv_path = results_dir / "template_avaliacao.csv"
    
    if not knowledge_base_dir.exists():
        print(f"❌ Erro: Pasta {knowledge_base_dir} não encontrada.")
        return
        
    pdf_files = list(knowledge_base_dir.glob("*.pdf"))
    if not pdf_files:
        print(f"⚠️ Nenhum arquivo PDF encontrado em {knowledge_base_dir}.")
        return

    print(f"📄 Encontrados {len(pdf_files)} PDFs para benchmark.")
    
    # Detecção e Logging da placa de vídeo
    if USE_CUDA:
        print("✅ GPU/CUDA detectada (via PyTorch)! O Docling tentará utilizar aceleração de hardware.")
    else:
        print("⚠️ GPU/CUDA NÃO detectada ou PyTorch ausente. Operando com fallback puro em CPU (best effort).")
        
    converter = get_docling_converter()
    if not converter:
        print("❌ ERRO: Docling não está instalado no ambiente (import docling falhou). Pulará essa etapa.")
        
    csv_rows = []
    
    csv_headers = [
        "arquivo", "categoria_prevista", 
        "pymupdf_acentuacao", "pymupdf_ordem", "pymupdf_tabelas", "pymupdf_recall",
        "docling_acentuacao", "docling_ordem", "docling_tabelas", "docling_recall",
        "vencedor", "observacoes"
    ]
    
    start_time = time.time()
    
    for i, pdf_path in enumerate(pdf_files, 1):
        print(f"\n[{i}/{len(pdf_files)}] Processando {pdf_path.name}...")
        
        # Cria a linha "vazia" padrão
        row_data = {col: "" for col in csv_headers}
        row_data["arquivo"] = pdf_path.name
        
        # --- 1. Extração PyMuPDF ---
        print("  -> Extraindo via PyMuPDF...")
        try:
            pymupdf_text = extract_pymupdf(pdf_path)
            out_pymupdf = pymupdf_dir / f"{pdf_path.stem}.txt"
            out_pymupdf.write_text(pymupdf_text, encoding="utf-8")
        except Exception as e:
            print(f"  [ERRO PyMuPDF] Falha na extração de {pdf_path.name}: {e}")
            
        # --- 2. Extração Docling ---
        print("  -> Extraindo via Docling...")
        try:
            if converter:
                result = converter.convert(pdf_path)
                docling_md = result.document.export_to_markdown()
                out_docling = docling_dir / f"{pdf_path.stem}.md"
                out_docling.write_text(docling_md, encoding="utf-8")
            else:
                print("  [SKIP Docling] Extrator inativo.")
        except Exception as e:
            print(f"  [ERRO Docling] Falha na extração de {pdf_path.name}: {e}")
            
        csv_rows.append(row_data)
        
    # --- 3. Salvamento de CSV Sempre ---
    print("\nSalvando template_avaliacao.csv...")
    try:
        with open(csv_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=csv_headers)
            writer.writeheader()
            writer.writerows(csv_rows)
        print(f"✅ CSV template de avaliação salvo com sucesso em:\n   {csv_path}")
    except Exception as e:
        print(f"❌ Erro ao salvar o arquivo CSV: {e}")
        
    elapsed = time.time() - start_time
    print(f"\n🎉 Benchmark concluído em {elapsed:.2f} segundos!")
    print(f"📂 Verifique os resultados lado-a-lado em: {results_dir}")

if __name__ == "__main__":
    main()
