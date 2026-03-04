import os
import time
from dotenv import load_dotenv

from docling.document_converter import DocumentConverter
from docling.chunking import HierarchicalChunker
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from supabase import create_client, Client

# Isto força o Python a ler o ficheiro .env, ignorando a configuração da IDE!
load_dotenv()

DOC_METADATA = {
    "PROGRAMA OLERICULTURA ORGANICA.pdf": {
        "author": "SENAR", 
        "year": "2019", 
        "title": "Programa Olericultura Orgânica"
    }
}

# Agora as chaves estão seguras na memória do script
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

if not all([SUPABASE_URL, SUPABASE_SERVICE_KEY, GOOGLE_API_KEY]):
    raise ValueError("Faltam variáveis de ambiente (SUPABASE_URL, SUPABASE_SERVICE_KEY ou GOOGLE_API_KEY).")

def main():
    # TESTE SEGURO: Usando um PDF pequeno para não travar o Docker Engine
    pdf_path = "docs/IN_23_01062011_TEXTEIS.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"❌ Erro: O ficheiro '{pdf_path}' não foi encontrado.")
        return

    # =========================================================================
    # FASE 1: Conversão do PDF com Docling (OCR + Layout Detection)
    # Usa cache JSON do DoclingDocument para evitar repetir 1h de OCR.
    # =========================================================================
    import json
    from docling_core.types import DoclingDocument
    cache_path = pdf_path + ".docling_cache.json"
    
    if os.path.exists(cache_path):
        print(f"⚡ Cache do OCR encontrado! Carregando de '{cache_path}'...")
        with open(cache_path, "r", encoding="utf-8") as f:
            docling_doc = DoclingDocument.model_validate_json(f.read())
        print("✅ Cache carregado com sucesso (pulando OCR).")
    else:
        print(f"📄 A ler o PDF: {pdf_path}...")
        converter = DocumentConverter()
        dl_doc = converter.convert(pdf_path)
        docling_doc = dl_doc.document
        
        # Salvar cache como JSON (Pydantic model → JSON string)
        print(f"💾 Salvando cache do OCR em '{cache_path}'...")
        with open(cache_path, "w", encoding="utf-8") as f:
            f.write(docling_doc.model_dump_json())
        print("✅ Cache salvo com sucesso.")

    # =========================================================================
    # FASE 2: Chunking Estrutural + Extração Semântica (LLM Bibliotecário)
    # =========================================================================
    import gc
    import re
    from langchain.chat_models import init_chat_model
    from langchain_core.messages import SystemMessage, HumanMessage
    
    # 1. Capturar extração de texto para análise (Primeiros 2000 caracteres)
    # Usamos o Markdown do Docling que já está limpo e estruturado.
    full_text_sample = docling_doc.export_to_markdown()[:2000]
    
    # Memória: Liberar o DocumentConverter pesado após extração do texto
    gc.collect()

    print("📖 Ativando Caminho Bibliotecário LLM...")
    
    # Fast-path (Regex): Detecção rápida de Instruções Normativas (IN)
    regex_title, regex_year = None, None
    in_match = re.search(r"INSTRUÇÃO NORMATIVA Nº\s*(\d+).*?(\d{4})", full_text_sample, re.IGNORECASE | re.DOTALL)
    if in_match:
        regex_title = f"Instrução Normativa Nº {in_match.group(1)}"
        regex_year = in_match.group(2)
        print(f"   ⚡ Fast-path (Regex) detectou: {regex_title} ({regex_year})")

    PROMPT_BIBLIOTECARIO = """Você extrai metadados de documentos oficiais brasileiros (INs, Portarias, Decretos MAPA/Embrapa/UFU).
Analise APENAS os PRIMEIROS 2000 caracteres fornecidos. Retorne SOMENTE JSON rigoroso com as chaves "autor", "titulo" e "ano".
EXEMPLO IN 23/2011:
{"autor": "Ministério da Agricultura, Pecuária e Abastecimento (MAPA)", "titulo": "Instrução Normativa Nº 23, de 1º de junho de 2011", "ano": "2011"}"""

    llm_metadata = {}
    try:
        # Inicializa o modelo (Groq Llama 3.3 for speed/cost or Gemini as fallback)
        llm = init_chat_model(model="llama-3.3-70b-versatile", model_provider="groq", temperature=0)
        messages = [
            SystemMessage(content=PROMPT_BIBLIOTECARIO),
            HumanMessage(content=f"Documento:\n{full_text_sample}")
        ]
        
        # Chamada direta com output JSON nativo
        response = llm.invoke(messages)
        content = response.content
        # Limpeza básica em caso de markdown blocks
        content = re.sub(r"```json\s*|\s*```", "", content).strip()
        llm_metadata = json.loads(content)
        print(f"   🎯 Bibliotecário extraiu: {llm_metadata}")
    except Exception as e:
        print(f"⚠️ Erro no Bibliotecário LLM: {e}")

    print("🔪 A fatiar com HierarchicalChunker (preserva tabelas e cabeçalhos)...")
    chunker = HierarchicalChunker()
    chunks = list(chunker.chunk(docling_doc))

    base_name = os.path.basename(pdf_path)
    
    # Merger de Metadados: LLM > Regex > Hardcoded > Default
    final_meta = {
        "author": llm_metadata.get("autor") or "Desconhecido",
        "year": llm_metadata.get("ano") or regex_year or "N/A",
        "title": llm_metadata.get("titulo") or regex_title or base_name.replace(".pdf", ""),
        "source": pdf_path,
        "filename": base_name,
        "type": "manual_oficial"
    }
    
    # Fallback final com DOC_METADATA (prioritário se base_name bater exatamente)
    if base_name in DOC_METADATA:
        h_meta = DOC_METADATA[base_name]
        final_meta["author"] = h_meta.get("author") or final_meta["author"]
        final_meta["year"] = h_meta.get("year") or final_meta["year"]
        final_meta["title"] = h_meta.get("title") or final_meta["title"]

    for chunk in chunks:
        texto_rico = chunker.serialize(chunk=chunk)
        doc = Document(page_content=texto_rico, metadata=final_meta)
        docs.append(doc)

    print(f"✅ Documento dividido em {len(docs)} blocos com metadados: {final_meta['title']} ({final_meta['year']})")
    
    # =========================================================================
    # FASE 3: Embeddings + Upload para Supabase
    # =========================================================================
    print("🧠 A inicializar o modelo de Embeddings da Google...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    
    print("🔌 A conectar ao Supabase...")
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    print(f"🧹 Removendo chunks antigos de '{base_name}'...")
    try:
        supabase_client.table("knowledge_chunks").delete().eq("document_name", base_name).execute()
    except Exception as e:
        print(f"⚠️ Aviso ao limpar chunks antigos: {e}")
    
    print("🚀 A enviar dados para o Supabase em lotes...")
    
    batch_size = 20
    total_docs = len(docs)
    inserted_count = 0
    
    for i in range(0, total_docs, batch_size):
        batch = docs[i : i + batch_size]
        end_idx = min(i + batch_size, total_docs)
        print(f"📤 Lote {i//batch_size + 1} ({i+1} a {end_idx}/{total_docs})...")
        
        try:
            batch_texts = [doc.page_content for doc in batch]
            batch_embeddings = embeddings.embed_documents(batch_texts)
            
            records = []
            for idx, (doc, chunk_embedding) in enumerate(zip(batch, batch_embeddings)):
                records.append({
                    "document_name": base_name,
                    "chunk_index": i + idx,
                    "content": doc.page_content,
                    "embedding": chunk_embedding,
                    "metadata": doc.metadata
                })
            
            supabase_client.table("knowledge_chunks").insert(records).execute()
            inserted_count += len(records)
            if end_idx < total_docs: time.sleep(2)
                
        except Exception as e:
            print(f"❌ Erro no lote: {e}")
            time.sleep(5)
            
    # =========================================================================
    # FASE 4: Atualizar Tabela Mestra (knowledge_documents)
    # =========================================================================
    print("💾 A atualizar a tabela knowledge_documents...")
    try:
        # Gerar resumo rápido se possível (ou usar um placeholder)
        doc_summary = f"Manual técnico sobre {final_meta['title']}, publicado por {final_meta['author']} em {final_meta['year']}."
        
        supabase_client.table("knowledge_documents").upsert({
            "filename": base_name,
            "title": final_meta["title"],
            "author": final_meta["author"],
            "year": final_meta["year"],
            "total_chunks": total_docs,
            "summary": doc_summary,
            "updated_at": "now()"
        }, on_conflict="filename").execute()
        print("✅ Tabela knowledge_documents atualizada.")
    except Exception as e:
        print(f"⚠️ Erro ao atualizar knowledge_documents: {e}")

    print(f"\n🎉 Ingestão finalizada! {inserted_count}/{total_docs} chunks inseridos.")

if __name__ == "__main__":
    main()
