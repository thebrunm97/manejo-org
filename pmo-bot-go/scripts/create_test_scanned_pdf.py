"""
Cria um PDF escaneado sintetico para teste da Rota 2 (OCR).
Converte a primeira pagina de um PDF existente em imagem PNG
e a reembute como PDF image-only (sem camada de texto).
"""
import sys
import fitz  # PyMuPDF
from pathlib import Path


def create_scanned_pdf(source_pdf: str, output_pdf: str, dpi: int = 150):
    """
    Renderiza a primeira pagina do PDF fonte como imagem
    e cria um novo PDF contendo apenas essa imagem (sem texto).
    """
    src = fitz.open(source_pdf)
    page = src[0]

    # Renderizar pagina como imagem (matriz de escala para o DPI desejado)
    zoom = dpi / 72  # 72 DPI e a resolucao padrao do PDF
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csRGB)
    src.close()

    # Criar novo PDF com apenas a imagem (zero texto)
    out_doc = fitz.open()
    img_page = out_doc.new_page(width=pix.width, height=pix.height)
    img_page.insert_image(
        fitz.Rect(0, 0, pix.width, pix.height),
        pixmap=pix
    )
    out_doc.save(output_pdf)
    out_doc.close()

    print(f"[OK] PDF escaneado sintetico criado: {output_pdf}")
    print(f"     Paginas: 1  |  Dimensoes: {pix.width}x{pix.height}px  |  Resolucao: {dpi} DPI")
    print(f"     Nenhuma camada de texto - deve ativar a Rota 2 do gatekeeper.")


if __name__ == "__main__":
    source = sys.argv[1] if len(sys.argv) > 1 else r"..\docs\knowledge_base\IN_13_28052015_CPOrg_e_STPOrg.pdf"
    output = sys.argv[2] if len(sys.argv) > 2 else "test_scanned.pdf"
    create_scanned_pdf(source, output)
