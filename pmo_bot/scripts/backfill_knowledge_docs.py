"""
Backfill script: populates knowledge_documents from existing knowledge_chunks.
Generates AI summaries using init_chat_model (Gemini Flash Lite) for each document
found in knowledge_chunks, without re-embedding anything.

Includes rate-limit resilience: explicit sleep between calls + graceful fallback.
"""
import os
import sys
import time
import logging
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.database import get_supabase_client

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Backfill_KnowledgeDocs")

def main():
    logger.info("🚀 Iniciando backfill da tabela knowledge_documents...")

    with get_supabase_client() as supabase:
        # 1. Get distinct documents and their chunk counts from knowledge_chunks
        logger.info("🔍 Buscando documentos existentes em knowledge_chunks...")
        response = supabase.table("knowledge_chunks") \
            .select("document_name, content") \
            .order("chunk_index", desc=False) \
            .execute()

        if not response.data:
            logger.warning("⚠️ Nenhum chunk encontrado em knowledge_chunks.")
            return

        # Group by document
        docs = {}
        for row in response.data:
            name = row["document_name"]
            if name not in docs:
                docs[name] = {"chunks": 0, "first_content": row["content"]}
            docs[name]["chunks"] += 1

        logger.info(f"📚 Encontrados {len(docs)} documentos distintos.")

        # 2. Check which docs already have summaries
        existing = supabase.table("knowledge_documents").select("filename").execute()
        existing_filenames = {r["filename"] for r in (existing.data or [])}
        
        docs_to_process = {k: v for k, v in docs.items() if k not in existing_filenames}
        
        if not docs_to_process:
            logger.info("✅ Todos os documentos já possuem registros em knowledge_documents!")
            return
        
        logger.info(f"📝 {len(docs_to_process)} documentos precisam de resumo.")

        # 3. Init LLM for summaries — using flash-lite for separate quota
        from langchain.chat_models import init_chat_model
        llm = init_chat_model(model="gemini-2.0-flash-lite", model_provider="google_genai", temperature=0.3)

        # 4. Process each document with delay between calls
        for i, (doc_name, info) in enumerate(docs_to_process.items()):
            logger.info(f"\n{'='*50}")
            logger.info(f"📝 [{i+1}/{len(docs_to_process)}] Processando: {doc_name} ({info['chunks']} chunks)")

            # Generate summary from first chunk content
            try:
                first_text = info["first_content"][:3000]
                prompt = f"Faça um resumo de 2 a 3 frases curtas explicando do que se trata este documento agrícola:\n\n{first_text}"
                response_llm = llm.invoke(prompt)
                summary = response_llm.content.strip()
                logger.info(f"✅ Resumo: {summary[:120]}...")
            except Exception as e:
                err_msg = str(e).lower()
                if "429" in err_msg or "resource_exhausted" in err_msg:
                    logger.warning(f"⚠️ Rate limit atingido. Aguardando 60s antes de continuar...")
                    time.sleep(60)
                    # Retry once
                    try:
                        response_llm = llm.invoke(prompt)
                        summary = response_llm.content.strip()
                        logger.info(f"✅ Resumo (retry): {summary[:120]}...")
                    except Exception as e2:
                        logger.warning(f"⚠️ Falha mesmo após retry: {e2}")
                        summary = "Resumo não disponível."
                else:
                    logger.warning(f"⚠️ Falha ao gerar resumo: {e}")
                    summary = "Resumo não disponível."

            # Upsert into knowledge_documents
            try:
                supabase.table("knowledge_documents").upsert({
                    "filename": doc_name,
                    "total_chunks": info["chunks"],
                    "summary": summary,
                }, on_conflict="filename").execute()
                logger.info(f"💾 Documento '{doc_name}' registrado com sucesso!")
            except Exception as e:
                logger.error(f"❌ Falha ao registrar '{doc_name}': {e}")

            # Anti-rate-limit delay between documents
            if i < len(docs_to_process) - 1:
                logger.info("⏳ Aguardando 5s para respeitar rate limits...")
                time.sleep(5)

    logger.info("\n✅ BACKFILL CONCLUÍDO COM SUCESSO!")

if __name__ == "__main__":
    main()
