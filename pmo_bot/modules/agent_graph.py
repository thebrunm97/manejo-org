
import os
import time
import logging
from typing import TypedDict, Annotated, List, Optional, Dict, Any, Union
from typing_extensions import NotRequired

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import BaseModel, Field

# Persistence
try:
    from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
    from psycopg_pool import AsyncConnectionPool
except ImportError:
    AsyncPostgresSaver = None

from langgraph.checkpoint.memory import MemorySaver

# Tools and Modules
from modules.db_tools import (
    MANEJO_TOOLS,
    get_postgres_dsn,
    registrar_atividade_wrapper,
    consultar_especialista_wrapper, # We use the wrapper or direct call? Wrapper is better for consistency if used as tool, but here we might call direct in node.
    consultar_compliance_wrapper
)
from modules.prompts import SYSTEM_PROMPT

logger = logging.getLogger(__name__)

# ==============================================================================
# 1. STATE DEFINITION
# ==============================================================================

class AgentState(TypedDict):
    """
    Main state for the ManejoGraph.
    Tracks conversation history, slot filling status, and final legacy output.
    """
    # Context
    user_id: str
    pmo_id: int
    thread_id: str
    
    # Conversation
    messages: Annotated[List[BaseMessage], add_messages]
    
    # Slot Filling
    intent: Optional[str]        # 'manejo', 'plantio', 'colheita', 'duvida', 'planejamento'
    slots: Dict[str, Any]        # Accumulated extracted data
    missing_slots: List[str]     # Required fields still missing
    
    # Flow Control
    next_step: str               # 'inquiry', 'execute', 'end'
    
    # Legacy Webhook Contract
    final_response: Dict[str, Any]
    
    # Metrics
    usage: NotRequired[Dict[str, int]]

# ==============================================================================
# 2. SCHEMA EXTRACTION (PYDANTIC)
# ==============================================================================

class ManejoIntent(BaseModel):
    """Extraction schema for the Interpreter Node."""
    intencao: str = Field(..., description="A intenção do usuário: 'execucao', 'planejamento', 'duvida' or 'saudacao'")
    tipo_atividade: Optional[str] = Field(None, description="Tipo: Manejo, Plantio, Colheita, Insumo")
    produto: Optional[str] = Field(None, description="Nome do produto, cultura ou insumo principal. Se o produto não for citado explicitamente NESTA mensagem, retorne None. Não retorne string vazia.")
    quantidade_valor: Optional[float] = Field(None, description="Valor numérico da quantidade")
    quantidade_unidade: Optional[str] = Field(None, description="Unidade de medida (kg, litros, sacos). Se o usuário disser 'por hectare' ou '/ha', inclua isso na unidade (ex: 'litros/ha').")
    quantidade_unidade: Optional[str] = Field(None, description="Unidade de medida (kg, litros, sacos). Se o usuário disser 'por hectare' ou '/ha', inclua isso na unidade (ex: 'litros/ha').")
    talhao: Optional[str] = Field(None, description="Identificação do local ONDE ocorreu a ação (Talhão, Canteiro, Estufa, Pátio). Exemplos: 'no talhão 2', 'nos canteiros', 'na estufa'. Se o usuário disser 'para o canteiro' (finalidade), NÃO extraia aqui. Se não houver local explícito, retorne None.")
    destino: Optional[str] = Field(None, description="Destino da produção/venda (apenas para Colheita/Venda). Ex: 'Feira', 'Mercado', 'Consumo Próprio', 'PNAE'.")
    origem: Optional[str] = Field(None, description="Origem do recurso (Compra, Produção Própria, Doação, Venda / Saída).")
    tipo_operacao: Optional[str] = Field(None, description="Detalhe da operação para Manejo (ex: 'Manejo Cultural', 'Aplicação de Insumos', 'Adubação').")
    observacao: Optional[str] = Field(None, description="Detalhes adicionais que NÃO se encaixam em produto, quantidade ou local. Ex: 'estava ventando', 'aplicado pela manhã'.")

# ==============================================================================
# 3. NODES IMPLEMENTATION
# ==============================================================================

def get_llm():
    """
    Factory to get the best available LLM.
    RESTORED LEGACY PRIORITY: Google Gemini for Text/Logic.
    Now with automatic fallback when rate limited.
    """
    
    # Circuit breaker: Track if Groq is rate limited
    # Using module-level variable for simplicity
    global _groq_rate_limited_until
    
    current_time = time.time()
    groq_key = os.getenv("GROQ_API_KEY")
    google_key = os.getenv("GOOGLE_API_KEY")
    
    # 1. First priority: Groq 70b (if not rate limited)
    if groq_key and current_time > _groq_rate_limited_until:
        return ChatGroq(model_name="llama-3.3-70b-versatile", temperature=0)
    elif groq_key and current_time <= _groq_rate_limited_until:
        remaining = int(_groq_rate_limited_until - current_time)
        logger.info(f"⏳ Groq 70b rate limited, trying fallbacks ({remaining}s remaining)")

    # 2. Second priority: Groq 8b (separate rate limit!)
    if groq_key:
        try:
            logger.info("🔄 Using Groq llama-3.1-8b-instant as fallback")
            return ChatGroq(model_name="llama-3.1-8b-instant", temperature=0)
        except Exception as e:
            logger.warning(f"⚠️ Groq 8b also failed: {e}")

    # 3. Third priority: Google Gemini
    if google_key:
        try:
            logger.info("🔄 Using Google Gemini as LLM provider")
            return ChatGoogleGenerativeAI(
                model="models/gemini-2.0-flash", 
                temperature=0,
                convert_system_message_to_human=True
            )
        except Exception as e:
            logger.warning(f"⚠️ Google GenAI fail: {e}")
    
    raise ValueError("❌ No LLM Provider available (Google or Groq needed)")

# Circuit breaker state
_groq_rate_limited_until = 0

def mark_groq_rate_limited(seconds: int = 600):
    """Mark Groq as rate limited for X seconds (default 10 min)"""
    global _groq_rate_limited_until
    _groq_rate_limited_until = time.time() + seconds
    logger.warning(f"🚫 Groq marked as rate limited for {seconds}s")


async def interpreter_node(state: AgentState):
    """
    Analyzes the last message to extract intent and slots.
    Merges new slots with existing ones using 'Smart Merge'.
    Uses ONE LLM call with JSON mode to extract tokens and parse response.
    """
    logger.info("🧠 Interpreter Node: Analyzing message...")
    
    llm = get_llm()
    
    # Construct context-aware prompt
    escaped_system_prompt = SYSTEM_PROMPT.replace("{", "{{").replace("}", "}}")
    
    system_msg = escaped_system_prompt + "\n\n" + (
        "Contexto atual de Slots já preenchidos: {slots}\n"
        "Se o usuário estiver apenas complementando uma informação (ex: 'foi 10kg'), "
        "mescle com o contexto anterior."
    )
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", system_msg),
        ("human", "{input}")
    ])
    
    # Get last user message content
    last_msg = state['messages'][-1].content
    current_slots = state.get('slots') or {}
    previous_intent = state.get('intent')
    
    # Format messages for LLM
    msgs = prompt.format_messages(input=last_msg, slots=str(current_slots))
    
    # SINGLE LLM CALL with JSON mode to ensure structured output
    # Wrapped with rate limit handling for automatic fallback
    try:
        json_llm = llm.bind(response_format={"type": "json_object"})
        raw_res = await json_llm.ainvoke(msgs)
    except Exception as e:
        error_str = str(e)
        # Check if it's a rate limit error (429)
        if "429" in error_str or "rate_limit" in error_str.lower():
            logger.warning(f"🚫 Rate limit detected, marking Groq as limited and retrying with fallback...")
            mark_groq_rate_limited(600)  # 10 minutes cooldown
            
            # Retry with fallback provider (should now use Gemini)
            llm = get_llm()
            json_llm = llm.bind(response_format={"type": "json_object"})
            raw_res = await json_llm.ainvoke(msgs)
        else:
            raise  # Re-raise non-rate-limit errors
    
    # === EXTRACT TOKEN USAGE ===
    token_usage = {}
    
    # Strategy 1: usage_metadata (LangChain >= 0.1.x)
    if hasattr(raw_res, 'usage_metadata') and raw_res.usage_metadata:
        token_usage = {
            "prompt_tokens": raw_res.usage_metadata.get('input_tokens', 0),
            "completion_tokens": raw_res.usage_metadata.get('output_tokens', 0)
        }
        logger.info(f"📊 Tokens via usage_metadata: {token_usage}")
    # Strategy 2: response_metadata.token_usage (Groq standard)
    elif raw_res.response_metadata.get('token_usage'):
        token_usage = raw_res.response_metadata['token_usage']
        logger.info(f"📊 Tokens via response_metadata.token_usage: {token_usage}")
    # Strategy 3: response_metadata.usage (fallback)
    elif raw_res.response_metadata.get('usage'):
        token_usage = raw_res.response_metadata['usage']
        logger.info(f"📊 Tokens via response_metadata.usage: {token_usage}")
    else:
        logger.warning("⚠️ No token usage found in response!")
    
    # Accumulate usage
    prev_usage = state.get("usage") or {"prompt_tokens": 0, "completion_tokens": 0}
    updated_usage = {
        "prompt_tokens": prev_usage["prompt_tokens"] + token_usage.get("prompt_tokens", 0),
        "completion_tokens": prev_usage["completion_tokens"] + token_usage.get("completion_tokens", 0)
    }
    
    # === PARSE JSON RESPONSE ===
    import json
    
    content_str = raw_res.content
    # Clean markdown if present
    if "```json" in content_str:
        content_str = content_str.split("```json")[1].split("```")[0].strip()
    elif "```" in content_str:
        content_str = content_str.split("```")[1].split("```")[0].strip()
    
    try:
        data_dict = json.loads(content_str)
        
        # Handle case where AI returns talhao_canteiro directly instead of talhao
        if 'talhao_canteiro' in data_dict and 'talhao' not in data_dict:
            data_dict['talhao'] = data_dict.pop('talhao_canteiro')
        
        result = ManejoIntent(**data_dict)
    except Exception as e:
        logger.warning(f"Failed to parse JSON directly: {e}. Fallback to soft parser.")
        # Fallback default
        result = ManejoIntent(intencao="duvida", observacao=last_msg)

    # === PREPARE NEW DATA (MAPPING) ===
    new_data = result.dict()
    
    # Map 'talhao' to 'talhao_canteiro' to match system keys
    if new_data.get('talhao'):
        new_data['talhao_canteiro'] = new_data.pop('talhao')
    else:
        new_data.pop('talhao', None)  # Remove None if exists
        
    # 2. Smart Merge (Slots)
    updated_slots = current_slots.copy()
    for key, value in new_data.items():
        # Skip special 'intencao' key for slots dict, and check for truthy check
        if key == 'intencao': continue
        
        # Only update if value is valid AND not empty/None/null string
        if value is not None and value != "" and str(value).lower() != "none":
            
            # Protection against 'hectare' hallucination in location field
            if key == 'talhao_canteiro' and "hectare" in str(value).lower():
                continue
                
            updated_slots[key] = value
            
    # 3. Intent Strategy (Preservation)
    new_intent = result.intencao
    final_intent = new_intent
    
    # List of "strong" intents that start a flow
    STRONG_INTENTS = ['manejo', 'plantio', 'colheita', 'duvida', 'planejamento', 'execucao']
    
    # If new intent is weak/generic/saudacao AND we already have a strong intent in progress, keep it.
    if previous_intent in STRONG_INTENTS:
        if new_intent not in STRONG_INTENTS or new_intent == 'saudacao':
             final_intent = previous_intent
             logger.info(f"🔄 Keeping previous intent '{previous_intent}' instead of '{new_intent}'")

    logger.info(f"🧠 Extracted: {result.dict()} | Final Intent: {final_intent} | Slots: {updated_slots}")
    
    return {
        "intent": final_intent, 
        "slots": updated_slots,
        "usage": updated_usage
    }

def router_node(state: AgentState):
    """
    Decides the next step based on intent and missing slots.
    """
    intent = state.get("intent")
    slots = state.get("slots", {})
    
    logger.info(f"🔀 Router: Intent='{intent}'")
    
    # 1. Duvida / Specialist
    if intent == 'duvida':
        return {"next_step": "specialist"}
    
    # 2. Greeting / Empty
    if intent == 'saudacao':
        return {"next_step": "end", "final_response": {
            "status": "success", 
            "message": "Olá! Sou seu assistente de manejo. Posso ajudar com registros ou dúvidas técnicas."
        }}

    # 3. Execution (Check Requirements)
    # 3. Execution (Check Requirements)
    tipo = str(slots.get('tipo_atividade') or "").lower()
    
    # Base requirements for everything
    required = ['produto', 'quantidade_valor', 'quantidade_unidade']
    
    # Location is required ONLY for production activities (Plantio, Manejo, Colheita)
    # Venda, Compra, Insumo do not require location.
    if tipo in ['plantio', 'manejo', 'colheita', '']:
         # If activity type is unknown/empty, we assume it's production and ask for location 
         # to be safe, or we could look at intent.
         # Exception: If intent is known as 'venda', we shouldn't ask.
         # But here we rely on 'tipo_atividade' extracted by Interpreter.
         required.append('talhao_canteiro')
         
    missing = [field for field in required if not slots.get(field)]
    
    if missing:
        logger.info(f"⚠️ Missing info: {missing}")
        return {"next_step": "inquiry", "missing_slots": missing}
    
    # 4. Ready for Compliance/Execution
    return {"next_step": "compliance_check", "missing_slots": []}

async def inquiry_node(state: AgentState):
    """
    Generates a question to ask the user for missing information.
    """
    missing = state.get("missing_slots", [])
    if not missing:
        return {"next_step": "end"} # Safety net
        
    field_map = {
        'produto': "qual produto ou insumo foi utilizado?",
        'quantidade_valor': "qual foi a quantidade (número)?",
        'quantidade_unidade': "qual a unidade de medida (kg, litros)?",
        'talhao_canteiro': "em qual local (talhão/canteiro) isso foi realizado?"
    }
    
    # Ask about the first missing field
    target = missing[0]
    question = field_map.get(target, f"por favor informe: {target}")
    
    msg_text = f"Entendi. Para registrar, {question}"
    
    # Update final response to send back to webhook asking for input
    # Status 'inquiry' tells webhook to just echo the message and wait for user reply.
    response_data = state['slots'].copy()
    response_data['intencao'] = state.get('intent') # Inject intent
    
    return {
        "final_response": {
            "status": "inquiry",
            "message": msg_text,
            "data": response_data
        }
    }

def specialist_node(state: AgentState):
    """
    Handles technical doubts using the Expert Tool (RAG).
    """
    query = state['messages'][-1].content
    logger.info(f"🎓 Specialist: querying '{query}'")
    
    # Call wrapper directly
    response = consultar_especialista_wrapper(query)
    
    return {
        "final_response": {
            "status": "success", 
            "data": {
                "intencao": "duvida",
                "resposta_tecnica": response
            }
        }
    }

def compliance_check_node(state: AgentState):
    """
    Validates organic compliance before execution.
    """
    slots = state['slots']
    pmo_id = state['pmo_id']
    
    # Call wrapper
    res_str = consultar_compliance_wrapper(
        pmo_id=pmo_id,
        produto=slots.get('produto'),
        talhao=slots.get('talhao_canteiro')
    )
    
    if "ALERTA" in res_str:
        # NEW: Soft Warning Strategy
        # Instead of blocking, we append the warning to 'observacao' and proceed.
        current_obs = slots.get('observacao') or ""
        new_obs = f"{current_obs}\n[ALERTA COMPLIANCE]: {res_str}".strip()
        
        # Update slots in state
        slots['observacao'] = new_obs
        
        return {
            "slots": slots,
            "next_step": "execute" # Proceed despite warning
        }
    
    return {"next_step": "execute"}

def execution_node(state: AgentState):
    """
    Persists data to Supabase (Caderno de Campo).
    Concatenates recent conversation history into observacao_original
    for full audit trail, keeping observacao for structured AI notes/alerts.
    """
    slots = state['slots']
    pmo_id = state['pmo_id']
    
    # --- Build full conversation context for observacao_original ---
    messages = state.get('messages', [])
    # Take last 10 messages max to avoid huge payloads
    recent_msgs = messages[-10:] if len(messages) > 10 else messages
    
    history_lines = []
    for msg in recent_msgs:
        if isinstance(msg, HumanMessage):
            history_lines.append(f"[User]: {msg.content}")
        elif isinstance(msg, AIMessage):
            # Truncate AI responses to keep it readable
            content = msg.content[:200] + "..." if len(msg.content) > 200 else msg.content
            history_lines.append(f"[AI]: {content}")
    
    observacao_original = "\n".join(history_lines) if history_lines else ""
    
    logger.info(f"📝 Contexto completo para observacao_original ({len(history_lines)} msgs)")
    
    res_str = registrar_atividade_wrapper(
        produto=slots.get('produto'),
        quantidade_valor=slots.get('quantidade_valor'),
        quantidade_unidade=slots.get('quantidade_unidade'),
        talhao_canteiro=slots.get('talhao_canteiro'),
        tipo_atividade=slots.get('tipo_atividade', "Manejo"),
        pmo_id=pmo_id,
        observacao=slots.get('observacao', ""),
        observacao_original=observacao_original
    )
    
    # Check if there was a compliance warning in observation
    status_msg = f"✅ {res_str}"
    if "[ALERTA COMPLIANCE]" in slots.get('observacao', ""):
        status_msg += "\n⚠️ (Salvo com Alerta de Compliance)"
    
    # Clear slots after successful execution? 
    # Usually yes, or keep them for follow-up? 
    # For now, we clear to start fresh next time effectively.
    # But strictly, state persists. We might want to clear 'slots' explicitly here.
    
    return {
        "slots": {}, # Reset slots
        "final_response": {
            "status": "success",
            "message": status_msg,
            "data": slots
        }
    }

# ==============================================================================
# 4. GRAPH ASSEMBLY
# ==============================================================================

def build_graph():
    workflow = StateGraph(AgentState)
    
    # Add Nodes
    workflow.add_node("interpreter", interpreter_node)
    workflow.add_node("router", router_node)
    workflow.add_node("inquiry", inquiry_node)
    workflow.add_node("specialist", specialist_node)
    workflow.add_node("compliance", compliance_check_node)
    workflow.add_node("execution", execution_node)
    
    # Add Edges
    workflow.add_edge(START, "interpreter")
    workflow.add_edge("interpreter", "router")
    
    # Conditional Edges from Router
    def route_decision(state):
        step = state.get("next_step")
        if step == "specialist": return "specialist"
        if step == "inquiry": return "inquiry"
        if step == "compliance_check": return "compliance"
        return END # e.g. greeting
        
    workflow.add_conditional_edges(
        "router",
        route_decision,
        {
            "specialist": "specialist",
            "inquiry": "inquiry",
            "compliance": "compliance",
            END: END
        }
    )
    
    workflow.add_edge("specialist", END)
    workflow.add_edge("inquiry", END)
    
    # Compliance decision
    def compliance_decision(state):
        if state.get("next_step") == "end": return END # Blocked
        return "execution"
    
    workflow.add_conditional_edges("compliance", compliance_decision, {END: END, "execution": "execution"})
    
    workflow.add_edge("execution", END)
    
    # Persistence Check
    checkpointer = MemorySaver() # Default fallback
    
    # Try Postgres if available
    db_url = os.getenv("DATABASE_URL")
    if db_url and AsyncPostgresSaver:
        # Initialization happens at runtime due to async requirement
        pass
        
    return workflow

# Compile globally (lazy init potential for DB)
# Compile globally with MemorySaver for default persistence
app_graph = build_graph().compile(checkpointer=MemorySaver())

# ==============================================================================
# 5. PUBLIC INTERFACE (ADAPTER)
# ==============================================================================

async def invoke_agent(texto_usuario: str, user_id: str, thread_id: str, pmo_id: int = 0) -> Dict[str, Any]:
    """
    Main entrypoint called by webhook.py.
    Wraps graph invocation and ensures contract compatibility.
    """
    # 1. Setup Persistence (Async)
    # Note: For production with AsyncPostgresSaver, we need to manage the connection pool lifecycle.
    # Here we simulate with MemorySaver OR dynamic pool (less efficient but functional for prototype).
    
    db_url = os.getenv("DATABASE_URL")
    checkpointer = MemorySaver()
    
    if db_url and AsyncPostgresSaver:
        # Advanced: Use the pool context manager
        # Because we are inside a function request, we create a pool just for this run?
        # Ideally, pool is global. But AsyncPostgresSaver needs an active connection/pool.
        async with AsyncConnectionPool(conninfo=db_url, kwargs={"autocommit": True}) as pool:
            checkpointer = AsyncPostgresSaver(pool)
            app = build_graph().compile(checkpointer=checkpointer)
            
            return await _run_graph(app, texto_usuario, user_id, thread_id, pmo_id)
            
    # Fallback to Memory (In-Memory runs are ephemeral if app restarts, but work per request if global?)
    # MemorySaver is in-memory. If we compile `app_graph` globally with MemorySaver, 
    # it persists as long as the process lives.
    # The default `app_graph` defined above uses `MemorySaver`.
    return await _run_graph(app_graph, texto_usuario, user_id, thread_id, pmo_id)

async def _run_graph(app, texto, user_id, thread_id, pmo_id):
    inputs = {
        "messages": [HumanMessage(content=texto)],
        "user_id": user_id,
        "pmo_id": pmo_id,
        "thread_id": thread_id
    }
    
    config = {"configurable": {"thread_id": thread_id}}
    
    # Invoke
    # Use ainvoke for async
    final_state = await app.ainvoke(inputs, config=config)
    
    # Extract contract
    # Extract contract and metrics
    final_resp = final_state.get("final_response", {
        "status": "error", 
        "message": "Ocorreu um erro interno no Grafo."
    })
    
    # Inject usage into final response so orchestrator can bill it
    if "usage" in final_state:
        final_resp["usage"] = final_state["usage"]
        
    return final_resp
