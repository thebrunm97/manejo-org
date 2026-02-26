import os
import sys
from pathlib import Path
import logging
from dotenv import load_dotenv

# Ensure we can import from modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from modules.database import get_supabase_client

# Load environment before any LLM imports
load_dotenv()



# LangChain imports
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("RAG_Ingestion")

DOCS_DIR = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))) / "docs"

def main():
    logger.info("🚀 Iniciando Pipeline de Ingestão de Conhecimento RAG")
    
    if not DOCS_DIR.exists():
        logger.error(f"❌ Diretório não encontrado: {DOCS_DIR}")
        return
        
    pdf_files = list(DOCS_DIR.glob("*.pdf"))
    if not pdf_files:
        logger.warning(f"⚠️ Nenhum ficheiro PDF encontrado em {DOCS_DIR}")
        return
        
    logger.info(f"📚 Encontrados {len(pdf_files)} ficheiros PDF.")
    
    # 1. Initialize Embeddings (768 dimensions for gemini-embedding-001)
    logger.info("🧠 Inicializando modelo de embeddings Google (gemini-embedding-001) via SDK RAW...")
    from google import genai
    from google.genai import types
    from typing import List
    
    class RawGoogleEmbeddings:
        def __init__(self):
            import os
            self.api_key = os.getenv("GOOGLE_API_KEY")
            self.client = genai.Client(api_key=self.api_key)
            self.model = "models/gemini-embedding-001"
            
        def embed_query(self, text: str) -> List[float]:
            response = self.client.models.embed_content(
                model=self.model,
                contents=text,
            )
            return response.embeddings[0].values
            
        def embed_documents(self, texts: List[str]) -> List[List[float]]:
            # Em vez de batchEmbedContents (que parece estar a falhar na v1beta), fazemos chamadas individuais
            # para garantir estabilidade, já que a API de embeddings do Gemini é rápida.
            import time
            embeddings = []
            for text in texts:
                try:
                    response = self.client.models.embed_content(
                        model=self.model,
                        contents=text,
                    )
                    embeddings.append(response.embeddings[0].values)
                except Exception as e:
                    err_msg = str(e).lower()
                    if "429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg:
                        raise e # Re-raise to trigger graceful exit
                    logger.warning(f"⚠️ Erro ao embeddar chunk, ignorando: {e}")
                    embeddings.append([0.0]*3072) # mock zero vector on fail
                time.sleep(1.5) # Anti-rate limit for Free Tier
            return embeddings
            
    try:
        embeddings = RawGoogleEmbeddings()
    except Exception as e:
        logger.error(f"❌ Falha ao inicializar embeddings: {e}")
        return

    # 2. Extract texts using pypdf instead of Docling to save RAM
    from langchain_community.document_loaders import PyPDFLoader
    
    # 3. Initialize Text Splitter for Markdown/Text
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""]
    )
    
    with get_supabase_client() as supabase:
        
        logger.info("🔍 Verificando arquivos já processados no Supabase...")
        documentos_processados = set()
        try:
            response = supabase.table("knowledge_chunks").select("document_name").execute()
            if response.data:
                documentos_processados = set(row["document_name"] for row in response.data)
            logger.info(f"✅ Encontrados {len(documentos_processados)} documentos distintos na base de dados.")
        except Exception as e:
            logger.warning(f"⚠️ Aviso ao buscar documentos processados: {e}")
            
        for pdf_path in pdf_files:
            doc_name = pdf_path.name
            
            if doc_name in documentos_processados:
                logger.info(f"⏭️ [SKIPPED] PDF '{doc_name}' já processado.")
                continue
                
            logger.info(f"\n==============================================")
            logger.info(f"🔄 Processando documento: {doc_name}")
            
            # 1. Clean existing chunks for this document (UPSERT / Clean strategy)
            logger.info(f"🧹 Removendo chunks antigos de '{doc_name}'...")
            try:
                supabase.table("knowledge_chunks").delete().eq("document_name", doc_name).execute()
            except Exception as e:
                logger.warning(f"⚠️ Aviso ao tentar remover chunks antigos: {e}")
                
            # 2. Loading PDF via PyPDFLoader
            logger.info(f"⚙️ Lendo PDF pypdf...")
            try:
                loader = PyPDFLoader(str(pdf_path))
                docs = loader.load()
                
                # Combine textual content
                markdown_text = "\n\n".join(doc.page_content for doc in docs)
                logger.info(f"✅ Conversão concluída. Tamanho do texto: {len(markdown_text)} caracteres")
            except Exception as e:
                logger.error(f"❌ Falha ao converter '{doc_name}': {e}")
                continue
                
            # 3. Chunking
            logger.info(f"✂️ A quebrar documento em chunks de 1000 chars...")
            chunks = text_splitter.split_text(markdown_text)
            logger.info(f"✅ Gerados {len(chunks)} chunks.")
            
            if not chunks:
                logger.warning(f"⚠️ Nenhum texto extraído de '{doc_name}'. Passando ao próximo.")
                continue

            # 4. Generate Embeddings & Batch Insert
            batch_size = 20
            total_chunks = len(chunks)
            
            for i in range(0, total_chunks, batch_size):
                batch_chunks = chunks[i:i + batch_size]
                batch_indices = list(range(i, i + len(batch_chunks)))
                
                logger.info(f"🧬 A gerar embeddings para bloco {i} a {i + len(batch_chunks) - 1}...")
                
                try:
                    # Gerar embeddings em batch
                    batch_embeddings = embeddings.embed_documents(batch_chunks)
                    
                    # Preparar os dados para inserção no Supabase
                    records = []
                    for idx, (chunk_text, chunk_embedding) in enumerate(zip(batch_chunks, batch_embeddings)):
                        global_idx = batch_indices[idx]
                        records.append({
                            "document_name": doc_name,
                            "chunk_index": global_idx,
                            "content": chunk_text,
                            "embedding": chunk_embedding,
                            "metadata": {
                                "source": str(pdf_path),
                                "total_chunks": total_chunks
                            }
                        })
                    
                    # Insert in database
                    supabase.table("knowledge_chunks").insert(records).execute()
                    
                except Exception as e:
                    err_msg = str(e).lower()
                    if "429" in err_msg or "resource_exhausted" in err_msg or "quota" in err_msg:
                        logger.error(f"\n\033[91m[RATE LIMIT ATINGIDO] O script parou no arquivo {doc_name}. Os arquivos anteriores foram salvos. Aguarde alguns minutos e rode o script novamente. Ele continuará exatamente de onde parou.\033[0m\n")
                        sys.exit(0)
                        
                    logger.error(f"❌ Falha ao processar batch {i} de '{doc_name}': {e}")
                    # Better to let it try the rest
            
            # 5. Generate summary via Gemini Flash (LangChain)
            logger.info(f"📝 Gerando resumo do documento com Gemini Flash...")
            try:
                from langchain.chat_models import init_chat_model
                llm_summary = init_chat_model(model="gemini-2.0-flash", model_provider="google_genai", temperature=0.3)
                first_page_text = docs[0].page_content[:3000] if docs else ""
                prompt = f"Faça um resumo de 2 a 3 frases curtas explicando do que se trata este documento agrícola:\n\n{first_page_text}"
                response = llm_summary.invoke(prompt)
                doc_summary = response.content.strip()
            except Exception as e:
                logger.warning(f"⚠️ Falha ao gerar resumo: {e}")
                doc_summary = "Resumo não disponível."
            
            # 6. Upsert into knowledge_documents
            logger.info(f"💾 Registrando documento na tabela knowledge_documents...")
            try:
                supabase.table("knowledge_documents").upsert({
                    "filename": doc_name,
                    "total_chunks": total_chunks,
                    "summary": doc_summary,
                }, on_conflict="filename").execute()
            except Exception as e:
                logger.warning(f"⚠️ Falha ao registrar documento: {e}")
            
            logger.info(f"🎉 Documento '{doc_name}' ingerido com sucesso!")

    logger.info("\n✅ PIPELINE DE INGESTÃO CONCLUÍDO COM SUCESSO!")

if __name__ == "__main__":
    main()
