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
    pdf_path = "docs/PROGRAMA OLERICULTURA ORGANICA.pdf"
    
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
    # FASE 2: Chunking Estrutural com HierarchicalChunker
    # Preserva tabelas inteiras e embute cabeçalhos nos chunks filhos.
    # =========================================================================
    print("🔪 A fatiar com HierarchicalChunker (preserva tabelas e cabeçalhos)...")
    chunker = HierarchicalChunker()
    chunks = list(chunker.chunk(docling_doc))

    docs = []
    for chunk in chunks:
        # serialize() embute os cabeçalhos hierárquicos no corpo do texto,
        # garantindo contexto completo em cada pedaço.
        texto_rico = chunker.serialize(chunk=chunk)
        
        base_name = os.path.basename(pdf_path)
        meta = {"source": pdf_path, "filename": base_name, "type": "manual_oficial"}
        if base_name in DOC_METADATA:
            meta.update(DOC_METADATA[base_name])
            
        doc = Document(
            page_content=texto_rico,
            metadata=meta
        )
        docs.append(doc)

    print(f"✅ Documento dividido hierarquicamente em {len(docs)} blocos (chunks).")
    
    # Mostra amostra dos primeiros 3 chunks para validação visual
    for i, doc in enumerate(docs[:3]):
        preview = doc.page_content[:200].replace("\n", " ")
        print(f"   [Chunk {i}] {preview}...")

    # =========================================================================
    # FASE 3: Embeddings + Upload para Supabase
    # =========================================================================
    print("🧠 A inicializar o modelo de Embeddings da Google...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
    
    print("🔌 A conectar ao Supabase...")
    supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    doc_n = os.path.basename(pdf_path)
    print(f"🧹 Removendo chunks antigos de '{doc_n}'...")
    try:
        supabase_client.table("knowledge_chunks").delete().eq("document_name", doc_n).execute()
    except Exception as e:
        print(f"⚠️ Aviso ao limpar chunks antigos: {e}")
    
    print("🚀 A enviar dados para o Supabase em lotes para evitar Erro 429 (Rate Limit)...")
    
    batch_size = 20
    total_docs = len(docs)
    inserted_count = 0
    
    for i in range(0, total_docs, batch_size):
        batch = docs[i : i + batch_size]
        end_idx = min(i + batch_size, total_docs)
        
        print(f"📤 A enviar lote {i//batch_size + 1} (chunks {i+1} a {end_idx} de {total_docs})...")
        
        try:
            batch_texts = [doc.page_content for doc in batch]
            batch_embeddings = embeddings.embed_documents(batch_texts)
            
            records = []
            for idx, (doc, chunk_embedding) in enumerate(zip(batch, batch_embeddings)):
                records.append({
                    "document_name": os.path.basename(pdf_path),
                    "chunk_index": i + idx,
                    "content": doc.page_content,
                    "embedding": chunk_embedding,
                    "metadata": doc.metadata
                })
            
            supabase_client.table("knowledge_chunks").insert(records).execute()
            inserted_count += len(records)
            print(f"   ✅ Lote inserido ({inserted_count}/{total_docs} acumulados)")
            
            # Adicionar delay se não for o último lote
            if end_idx < total_docs:
                print("⏳ A aguardar 2.5 segundos...")
                time.sleep(2.5)
                
        except Exception as e:
            print(f"❌ Erro ao enviar lote {i//batch_size + 1}: {e}")
            print("⏳ A aguardar 10 segundos antes de tentar novamente...")
            time.sleep(10)
            
            # Retry: tenta enviar o lote novamente uma vez
            try:
                print(f"🔄 Retentativa do lote {i//batch_size + 1}...")
                batch_texts = [doc.page_content for doc in batch]
                batch_embeddings = embeddings.embed_documents(batch_texts)
                
                records = []
                for idx, (doc, chunk_embedding) in enumerate(zip(batch, batch_embeddings)):
                    records.append({
                        "document_name": os.path.basename(pdf_path),
                        "chunk_index": i + idx,
                        "content": doc.page_content,
                        "embedding": chunk_embedding,
                        "metadata": doc.metadata
                    })
                
                supabase_client.table("knowledge_chunks").insert(records).execute()
                inserted_count += len(records)
                print(f"   ✅ Retentativa bem-sucedida ({inserted_count}/{total_docs} acumulados)")
            except Exception as retry_err:
                print(f"❌❌ Falha definitiva no lote {i//batch_size + 1}: {retry_err}")
            
    print(f"\n🎉 Ingestão hierárquica finalizada! {inserted_count}/{total_docs} chunks inseridos com sucesso.")

if __name__ == "__main__":
    main()
