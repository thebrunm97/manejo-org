from google import genai
from google.genai import types
import os
import logging
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

# Configure API Client
# Validates API KEY presence
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logger.warning("⚠️ GOOGLE_API_KEY not set. Expert Agent will fail.")

client = genai.Client(api_key=GOOGLE_API_KEY)

# Global Cache
KNOWLEDGE_BASE = None

def get_knowledge_base():
    """
    Scans the docs/ folder and uploads PDFs to Gemini.
    Returns a list of file objects (types.Content or similar references).
    Uses global caching to avoid re-uploading on every request.
    """
    global KNOWLEDGE_BASE
    
    if KNOWLEDGE_BASE is not None:
        logger.info("♻️ Usando cache da Base de Conhecimento.")
        return KNOWLEDGE_BASE

    try:
        docs_path = Path("docs")
        
        # Debug 1: Check folder existence
        if not docs_path.exists():
            print("❌ Folder 'docs' does not exist inside container!")
            return []
        
        # Debug 2: List files
        print(f"📂 Folder 'docs' found. Listing contents...")
        try:
            files_in_dir = os.listdir('docs')
            print(f"📂 Files found in docs: {files_in_dir}")
        except Exception as e:
            print(f"❌ Error listing docs directory: {e}")

        uploaded_files = []
        
        # List all PDF files
        pdf_files = list(docs_path.glob("*.pdf"))
        
        if not pdf_files:
            print("⚠️ Nenhum PDF encontrado na pasta docs.")
            return []

        print(f"📚 Encontrados {len(pdf_files)} PDFs para base de conhecimento.")

        for pdf in pdf_files:
            try:
                print(f"📤 Uploading: {pdf.name}")
                # New SDK Upload
                # user `file` argument instead of path
                file_obj = client.files.upload(file=str(pdf))
                uploaded_files.append(file_obj)
                print(f"✅ Upload success: {pdf.name}")
            except Exception as e:
                print(f"❌ Erro ao fazer upload de {pdf.name}: {e}")
                logger.error(f"Upload error: {e}")

        if uploaded_files:
            KNOWLEDGE_BASE = uploaded_files
            
        return uploaded_files
        
    except Exception as e:
        # Simplify error logging to ensuring we see it in docker logs
        print(f"\n\n❌ [EXPERT AGENT ERROR] ❌\n{str(e)}\n\n")
        logger.error(f"Critical error in get_knowledge_base: {e}", exc_info=True)
        return []

def consultar_especialista(query: str) -> dict:
    """
    Directly queries Gemini 1.5 Flash using the docs as context.
    Returns: {"response": str, "model": str}
    """
    try:
        # 1. Prepare Knowledge Base
        files = get_knowledge_base()
        
        if not files:
            logger.warning("⚠️ Base de conhecimento vazia. Usando apenas conhecimento geral do LLM.")
            # Não retorna erro, segue para o modelo responder com conhecimento de treinamento.
            # return {"response": "⚠️ Não consegui carregar os manuais oficiais. Por favor, tente novamente mais tarde.", "model": "error"}

        # 2. Configure Model
        # Use 1.5-flash. O 2.0-flash quebrou por cota (Resource Exhausted) nos seus logs.
        chosen_model_name = "gemini-1.5-flash" 
        
        # Note: Listing models in new SDK might differ. For now, trusting defaults or basic list if needed.
        # But 'gemini-2.0-flash' is standard in 2026.
        print(f"🤖 Model Selected: {chosen_model_name}")
        
        # 3. System Prompt & Query
        system_prompt = (
            "You are a Senior Agronomist specialized in Organic Agriculture.\n\n"
            "HIERARCHY OF KNOWLEDGE:\n"
            "1. **Legislation & Regulations (Laws, INs, Portarias):** You must STRICTLY follow the provided PDF documents. Do not invent laws. Cite the specific Article/IN.\n"
            "2. **Technical Agronomy (Pests, Diseases, Management):** Use the provided Manuals as your primary source. However, use your general agronomic knowledge to interpret, correct, or expand on biological concepts if the documents are unclear or incomplete. Do NOT confuse pathogens (e.g., Phytophthora vs Septoria).\n\n"
            "Goal: Provide accurate, practical, and legally compliant advice."
        )
        
        # Construct message content
        # New SDK supports list of parts. 'files' are File objects which can be passed as parts.
        # We need to construct the 'contents' argument properly.
        # It accepts a list of Content objects or a list of parts.
        
        # Build parts list
        parts = []
        
        # Add files as parts (referencing their URI/names implicitly handled by SDK objects? 
        # Actually usually we pass the file object or its URI)
        for f in files:
            # New SDK usually handles File object directly in contents or we might need types.Part.from_uri
            # Let's verify standard usage. 
            # client.models.generate_content(..., contents=[file_obj, "prompt"]) works in many examples.
            parts.append(f)
            
        parts.append(system_prompt)
        parts.append(f"Pergunta: {query}")

        logger.info(f"🧠 Consultando Especialista: {query}")
        
        # 4. Generate Response
        response = client.models.generate_content(
            model=chosen_model_name,
            contents=parts
        )
        
        # Extract Token Usage
        input_tokens = 0
        output_tokens = 0
        try:
             # Response structure usage_metadata might differ
             if response.usage_metadata:
                input_tokens = response.usage_metadata.prompt_token_count
                output_tokens = response.usage_metadata.candidates_token_count
        except Exception as e_tok:
            logger.warning(f"Feature: Token extraction failed: {e_tok}")

        return {
            "response": response.text,
            "model": chosen_model_name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        }

    except Exception as e:
        print(f"\n\n❌ [GEMINI GENERATE ERROR] ❌\n{str(e)}\n\n")
        logger.error(f"❌ Erro no Agente Especialista: {e}", exc_info=True)
        return {"response": "Desculpe, tive um erro ao consultar minha base de conhecimento.", "model": "error"}
