import os
import logging
from typing import Dict, Any, List

# RAG Integration
from modules.database import get_supabase_client
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Validates API KEY presence
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    logger.warning("⚠️ GOOGLE_API_KEY not set. Expert Agent will fail.")

def get_expert_llm():
    """
    Instantiates the expert LLM. We use gemini-2.5-flash via the 
    LangChain unified factory, with a fallback to Groq's LLaMA 3
    in case of quota limits or unavailability.
    """
    primary_llm = init_chat_model(
        model="gemini-2.5-flash",
        model_provider="google_genai",
        temperature=0.2
    )
    
    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        fallback_llm = ChatGroq(
            model_name="llama-3.3-70b-versatile",
            temperature=0.2,
            groq_api_key=groq_api_key
        )
        return primary_llm.with_fallbacks([fallback_llm])
    else:
        logger.warning("⚠️ GROQ_API_KEY não configurada. Fallback desativado.")
        return primary_llm

def fetch_knowledge_chunks(query: str, match_count: int = 5) -> str:
    """
    Generates embedding for the query and searches Supabase for relevant chunks.
    Returns concatenated text context.
    """
    logger.info(f"🔎 Buscando contexto RAG para a query: '{query[:50]}...'")
    try:
        # 1. Gerar Embedding da Pergunta
        from google import genai
        import os
        client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
        response = client.models.embed_content(
            model="models/gemini-embedding-001",
            contents=query,
        )
        query_vector = response.embeddings[0].values
        
        # 2. Buscar no Supabase pgvector usando RPC
        with get_supabase_client() as supabase:
            res = supabase.rpc(
                "match_chunks",
                {
                    "query_embedding": query_vector,
                    "match_count": match_count
                }
            ).execute()
        
        chunks = res.data or []
        
        if not chunks:
            logger.warning("⚠️ Nenhum contexto encontrado no Supabase.")
            return ""
            
        logger.info(f"📚 Encontrados {len(chunks)} trechos relevantes no RAG.")
        
        # 3. Formatar o Contexto
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            doc_name = chunk.get("document_name", "Desconhecido")
            content = chunk.get("content", "")
            score = chunk.get("similarity", 0)
            
            metadata = chunk.get("metadata", {})
            author = metadata.get("author", "Autor Desconhecido")
            year = metadata.get("year", "Ano Desconhecido")
            title = metadata.get("title", doc_name)
            
            # Formatação limpa para o LLM entender a fonte
            part = f"[Fonte: {title} | Autor: {author} | Ano: {year} | Arquivo: {doc_name} | Relevância: {score:.2f}]\n{content}"
            context_parts.append(part)
            
        return "\n\n---\n\n".join(context_parts)
            
    except Exception as e:
        logger.error(f"❌ Erro ao buscar contexto RAG (Embedding/DB): {e}", exc_info=True)
        return ""

def consultar_especialista(query: str) -> dict:
    """
    Queries Gemini 2.0 Flash using LangChain and strict RAG context.
    Returns: {"response": str, "model": str, "input_tokens": int, "output_tokens": int}
    """
    try:
        # 1. Recuperar contexto rico do RAG
        # Usando 5 chunks para garantir que tabelas de calendário agrícola sejam incluídas no contexto
        rag_context = fetch_knowledge_chunks(query, match_count=5)
        
        # 2. Configurar o LLM
        llm = get_expert_llm()
        chosen_model_name = "gemini-2.5-flash" 
        
        # 3. Prompt do Sistema (Blindado e Estrito)
        system_prompt = (
            "Você é um Agrônomo Sênior especializado em Agricultura Orgânica.\n\n"
            "DIRETRIZ FUNDAMENTAL:\n"
            "Responda à dúvida do usuário baseando-se ESTRITAMENTE no contexto documental fornecido abaixo. "
            "Se a resposta não estiver clara no contexto ou se não houver contexto suficiente, diga humildemente "
            "que não tem informações suficientes para garantir a precisão legal ou agronômica.\n\n"
            "REGRAS DE OCR E CALENDÁRIOS AGRÍCOLAS:\n"
            "1. **Interpretador de Marcadores:** 'X', 'x', '×' e '*' significam OBRIGATORIAMENTE que o mês é RECOMENDADO. Se houver um desses símbolos na coluna de um mês, aquele mês deve ser listado na resposta.\n"
            "2. **Não seja literal com meses em branco;** se houver marcadores em outros meses, extraia-os. Se não houver marcadores em nenhum mês, aí sim relate a ausência.\n"
            "3. **Sazonalidade:** Alerte sobre a cultivar (verão vs inverno) se aplicável (ex: cenoura).\n"
            "4. **Foco no Dado Bruto (Anti-Pedantismo Crítico):** Se a cultura (ex: cenoura) aparece em uma linha de tabela/calendário, extraia os meses marcados (X ou ×) IMEDIATAMENTE. Ignore se a tabela está sob um título contraditório (ex: 'transplantio' para uma cultura de semeadura direta). O conteúdo da linha é a VERDADE ABSOLUTA e sobrepõe qualquer hierarquia de títulos ou conhecimento prévio externo.\n\n"
            "HIERARQUIA DE CONHECIMENTO E CITAÇÕES:\n"
            "1. **Legislação (Leis, INs, Portarias):** Siga os documentos e cite os artigos explícitos quando aplicável.\n"
            "2. **Técnica Agronômica:** Utilize os manuais como fonte primária. Não recomende insumos proibidos em orgânicos.\n"
            "3. **Citações ABNT:** Você DEVE usar os campos 'Autor' e 'Ano' presentes nos metadados de cada Fonte do contexto para fazer citações ao longo do texto no formato ABNT (Autor, Ano).\n"
            "4. **Referências:** OBRIGATORIAMENTE crie uma seção '## Referências' ao final da sua resposta, listando as fontes usadas (Autor. Título. Ano. Arquivo).\n\n"
            "--- CONTEXTO RECUPERADO DA BASE DE DADOS (RAG) ---\n"
            f"{rag_context if rag_context else 'Nenhum contexto oficial disponível para esta consulta.'}\n"
            "--------------------------------------------------\n\n"
            "Meta: Fornecer resposta precisa, prática e em conformidade legal, formatada de forma clara e profissional."
        )
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Dúvida do produtor: {query}")
        ]

        logger.info(f"🧠 Consultando Especialista (LangChain LLM): {query}")
        
        # 4. Generate Response with fallback handling
        try:
            response = llm.invoke(messages)
            chosen_model_name = "gemini-2.5-flash" if "gemini" in str(getattr(response, "response_metadata", {})).lower() else "llama-3.3-70b"
        except Exception as invoke_err:
            logger.error(f"⚠️ Primary and Fallback invoke failed. Attempting strict raw groq: {invoke_err}")
            raw_groq = ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0.2, groq_api_key=os.getenv("GROQ_API_KEY"))
            # Converte objetos LangChain Message para dicionários primitivos para evitar 400 Bad Request
            primitive_msgs = [{"role": "system" if isinstance(m, SystemMessage) else "user", "content": m.content} for m in messages]
            response = raw_groq.invoke(primitive_msgs)
            chosen_model_name = "llama-3.3-70b (forced)"
            
        # 5. Extract Token Usage
        input_tokens = 0
        output_tokens = 0
        try:
             # Extract from LangChain standard AIMessage usage_metadata
             if hasattr(response, 'usage_metadata') and response.usage_metadata:
                 input_tokens = response.usage_metadata.get('input_tokens', 0)
                 output_tokens = response.usage_metadata.get('output_tokens', 0)
        except Exception as e_tok:
            logger.warning(f"⚠️ Token extraction failed: {e_tok}")

        return {
            "response": response.content,
            "model": chosen_model_name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        }

    except Exception as e:
        friendly_msg = "Desculpe, tive um problema técnico ao consultar os manuais agronômicos. Tente novamente em instantes."
        logger.error(f"❌ Erro no Agente Especialista: {e}", exc_info=True)
            
        print(f"\n\n❌ [AGENT LANGCHAIN ERRO] ❌\n{str(e)}\n\n")
        return {
            "response": friendly_msg, 
            "model": "error",
            "input_tokens": 0,
            "output_tokens": 0
        }
