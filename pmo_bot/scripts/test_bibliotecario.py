import os
import sys
import json
import re
from dotenv import load_dotenv

# Adicionar o diretório raiz ao sys.path para importar módulos
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from google import genai
from docling.document_converter import DocumentConverter

load_dotenv()

PROMPT_BIBLIOTECARIO = """Você extrai metadados de documentos oficiais brasileiros (INs, Portarias, Decretos MAPA/Embrapa/UFU).
Analise APENAS os PRIMEIROS 2000 caracteres fornecidos. Retorne SOMENTE JSON rigoroso com as chaves "autor", "titulo" e "ano".
EXEMPLO IN 23/2011:
{"autor": "Ministério da Agricultura, Pecuária e Abastecimento (MAPA)", "titulo": "Instrução Normativa Nº 23, de 1º de junho de 2011", "ano": "2011"}"""

def test_metadata_extraction(pdf_path):
    abs_pdf_path = os.path.abspath(pdf_path)
    if not os.path.exists(abs_pdf_path):
        print(f"❌ Erro: Arquivo {abs_pdf_path} não encontrado.")
        return

    print(f"📄 Lendo PDF para teste: {abs_pdf_path}...")
    
    # Tenta carregar do cache se existir
    cache_path = abs_pdf_path + ".docling_cache.json"
    text_sample = ""
    
    if os.path.exists(cache_path):
        print(f"⚡ Cache detectado: {cache_path}")
        from docling_core.types import DoclingDocument
        with open(cache_path, "r", encoding="utf-8") as f:
            docling_doc = DoclingDocument.model_validate_json(f.read())
            text_sample = docling_doc.export_to_markdown()[:2000]
    else:
        # 1. Extração via Docling
        converter = DocumentConverter()
        result = converter.convert(abs_pdf_path)
        text_sample = result.document.export_to_markdown()[:2000]
    
    print("📖 Texto extraído (primeiros 200 chars):", repr(text_sample[:200]))

    # 2. Chamada LLM
    try:
        print("🤖 Chamando LLM Bibliotecário (Gemini 1.5 Flash via SDK v1 - Legacy style)...")
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"), http_options={'api_version': 'v1'})
        
        # Em v1, injetamos a instrução no prompt se systemInstruction falhar
        prompt = f"{PROMPT_BIBLIOTECARIO}\n\nDocumento:\n{text_sample}"
        
        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=prompt
        )
        
        content = response.text
        # Remoção de markdown blocks
        content = re.sub(r"```json\s*|\s*```", "", content).strip()
        metadata = json.loads(content)
        
        # Output final esperado pelo usuário
        print(json.dumps(metadata, ensure_ascii=False, indent=2))
        
        # Output final esperado pelo usuário
        print(json.dumps(metadata, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Fallback para o PDF padrão se não passar argumento
        target_pdf = "docs/IN_23_01062011_TEXTEIS.pdf"
    else:
        target_pdf = sys.argv[1]
        
    test_metadata_extraction(target_pdf)
