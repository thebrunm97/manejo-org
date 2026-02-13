
import os
import logging
from typing import List, Optional
from langchain_core.tools import StructuredTool
from contextlib import asynccontextmanager
from psycopg_pool import AsyncConnectionPool

# Import handlers from database_handlers
from modules.database_handlers import (
    inserir_no_caderno_campo,
    get_equipamentos,
    validar_insumo_pmo,
    get_talhao_status
)

# Import expert agent
from modules.expert_agent import consultar_especialista

logger = logging.getLogger(__name__)

# ==============================================================================
# DATABASE TOOLS WRAPPERS
# ==============================================================================

def registrar_atividade_wrapper(
    produto: str,
    quantidade_valor: float,
    quantidade_unidade: str,
    talhao_canteiro: str,
    tipo_atividade: str = "Manejo",
    pmo_id: int = None,
    observacao: str = "",
    observacao_original: str = "",
    detalhes_tecnicos: dict = None
) -> str:
    """
    Registra uma atividade no Caderno de Campo.
    Retorna o ID do registro criado ou mensagem de erro.
    
    Args:
        observacao: Structured AI notes/alerts (e.g., compliance warnings).
        observacao_original: Full concatenated conversation history for audit trail.
    """
    if not pmo_id:
        return "Erro: pmo_id é obrigatório para registrar atividade."

    payload = {
        "produto": produto,
        "quantidade_valor": quantidade_valor,
        "quantidade_unidade": quantidade_unidade,
        "talhao_canteiro": talhao_canteiro,
        "tipo_atividade": tipo_atividade,
        "pmo_id": pmo_id,
        "observacao_original": observacao_original or observacao,
        "detalhes_tecnicos": detalhes_tecnicos or {}
    }
    
    try:
        # inserir_no_caderno_campo is synchronous in database_handlers.py
        # If we need async, we might need to wrap it or use run_in_executor in the graph node.
        # For now, we assume standard usage.
        result_id = inserir_no_caderno_campo(payload=payload)
        if result_id:
            return f"Sucesso: Atividade registrada com ID {result_id}"
        return "Erro: Falha ao registrar atividade no banco."
    except Exception as e:
        return f"Erro exception: {str(e)}"

def consultar_estoque_wrapper(user_id: str) -> str:
    """
    Consulta equipamentos e insumos disponíveis para o usuário.
    Retorna lista formatada de itens.
    """
    try:
        items = get_equipamentos(user_id)
        if not items:
            return "Nenhum equipamento ou insumo encontrado no inventário."
        
        # Format list closely
        report = "Itens Disponíveis:\n"
        for item in items:
            status = item.get('status_limpeza', 'OK')
            report += f"- {item['nome']} ({item.get('tipo_uso', 'Uso Geral')}): {status}\n"
        return report
    except Exception as e:
        return f"Erro ao consultar estoque: {str(e)}"

def consultar_compliance_wrapper(pmo_id: int, produto: str, talhao: str = None) -> str:
    """
    Verifica se um produto/insumo é permitido no PMO e se o talhão está apto.
    """
    alerts = []
    
    # Check 1: Insumo
    if produto:
        allowed = validar_insumo_pmo(pmo_id, produto)
        if not allowed:
            alerts.append(f"Insumo '{produto}' NÃO consta no planejamento aprovado.")
    
    # Check 2: Talhao
    if talhao:
        status = get_talhao_status(pmo_id, talhao)
        if status == 'quarentena':
            alerts.append(f"Talhão '{talhao}' está em QUARENTENA.")
    
    if not alerts:
        return "Compliance OK: Uso autorizado."
    
    return "ALERTA DE COMPLIANCE:\n" + "\n".join(alerts)

def consultar_especialista_wrapper(query: str) -> str:
    """
    Use para responder dúvidas técnicas sobre manejo orgânico, pragas ou legislação.
    Consulta manuais PDF e normas oficiais (RAG).
    """
    try:
        result = consultar_especialista(query)
        return result.get("response", "Erro ao consultar especialista.")
    except Exception as e:
        return f"Erro assistente técnico: {str(e)}"

# ==============================================================================
# TOOL DEFINITIONS
# ==============================================================================

# Create StructuredTools
tool_registrar = StructuredTool.from_function(
    func=registrar_atividade_wrapper,
    name="registrar_atividade",
    description="Salva uma atividade no caderno de campo. Requer produto, qtd, unidade e local."
)

tool_estoque = StructuredTool.from_function(
    func=consultar_estoque_wrapper,
    name="consultar_estoque",
    description="Verifica disponibilidade de equipamentos ou insumos do usuario."
)

tool_compliance = StructuredTool.from_function(
    func=consultar_compliance_wrapper,
    name="consultar_compliance",
    description="Valida se produto ou local atendem as normas do PMO organico."
)

tool_especialista = StructuredTool.from_function(
    func=consultar_especialista_wrapper,
    name="consultar_especialista",
    description="Use para responder dúvidas técnicas sobre manejo orgânico, pragas ou legislação."
)

MANEJO_TOOLS = [
    tool_registrar,
    tool_estoque,
    tool_compliance,
    tool_especialista
]

# ==============================================================================
# CONNECTION MANAGEMENT (POSTGRES SAVER)
# ==============================================================================

def get_postgres_dsn() -> str:
    """
    Constructs Postgres DSN from environment variables.
    Compatible with Supabase Transaction Pooler (port 6543) or Session (5432).
    """
    # Prefer explicit DATABASE_URL
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        return dsn
    
    # Try to construct from components if user provided DB_USER/DB_PASS/DB_HOST
    # This is a fallback if DATABASE_URL is missing
    db_user = os.getenv("DB_USER", "postgres")
    db_pass = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST")
    db_name = os.getenv("DB_NAME", "postgres")
    db_port = os.getenv("DB_PORT", "5432")
    
    if db_host and db_pass:
        return f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
    
    raise ValueError(
        "DATABASE_URL not found in environment variables. "
        "Please add DATABASE_URL=postgresql://... to your .env file for LangGraph persistence."
    )

@asynccontextmanager
async def get_postgres_connection():
    """
    Async context manager for Postgres connection pool.
    Usage:
        async with get_postgres_connection() as pool:
            checkpointer = AsyncPostgresSaver(pool)
            ...
    """
    dsn = get_postgres_dsn()
    async with AsyncConnectionPool(
        # Use simple connection string
        conninfo=dsn,
        max_size=20,
        kwargs={"autocommit": True}
    ) as pool:
        yield pool
