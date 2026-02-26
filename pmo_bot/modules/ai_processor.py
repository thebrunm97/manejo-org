"""
ai_processor.py - AI Processing Module (Full Version + Audit Integration)

Handles LLM calls with progressive retry, data validation, and detailed usage metrics.
Uses native JSON Mode (Groq) for robust parsing.
"""

import os
import json
import logging
import html
import re
from datetime import datetime, date, timedelta
import time     # For latency measurement
import pytz
from langchain.chat_models import init_chat_model
from langchain_core.messages import SystemMessage, HumanMessage
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError

# Centralized parsing
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parsing import parse_float_br, normalize_unit, parse_date_br, sanitize_string
from metrics import incr

# Pydantic models
from models.records import (
    AtividadeItem,
    LocalEstruturado,
    PlantioRecord,
    ManejoRecord,
    ColheitaRecord,
    PlanejamentoRecord,
    PMO_SECOES,
    create_record_from_dict,
    gerar_codigo_lote
)

# Business rules (from domain module)
try:
    from domain.manejo_rules import validar_regras_negocio, validar_manejo
except ImportError:
    try:
        from modules.business_rules import validar_regras_negocio
        # Fallback: no pre-validation available
        validar_manejo = None
    except ImportError:
        logging.warning("No business rules module found. Running without legal validation.")
        def validar_regras_negocio(dados): return {"status": "OK", "alertas": []}
        validar_manejo = None

# Migration utilities (for parse_local)
try:
    from modules.migration_utils import parse_local, detectar_e_migrar, validar_atividades
except ImportError:
    logging.warning("modules/migration_utils.py not found. Using fallbacks.")
    def parse_local(t): return {"talhao": t or "NÃO INFORMADO"}
    def detectar_e_migrar(d): return d
    def validar_atividades(a): return []

# Database handlers
from modules.database_handlers import (
    get_latest_pmo_id,
    get_equipamentos,
    get_talhao_status,
    validar_insumo_pmo
)

# Prompts
# Prompts
from modules.prompt_loader import get_system_prompt, get_retry_correction_prompt, get_minimal_prompt

load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ==============================================================================
# INPUT SANITIZATION
# ==============================================================================

def sanitizar_input(texto: str) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks.
    """
    if not texto:
        return ""
    
    # 1. Remove non-printable control characters (except newline, tab)
    texto_limpo = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', texto)
    
    # 2. Escape HTML entities to prevent XSS
    texto_seguro = html.escape(texto_limpo, quote=True)
    
    return texto_seguro


# ==============================================================================
# LLM RETRY LOGIC (JSON MODE)
# ==============================================================================

from typing import Optional, List, Dict, Any

class AtividadeExtracao(BaseModel):
    produto: Optional[str] = Field(None, description="Nome do produto principal (UPPERCASE)")
    quantidade: Optional[float] = Field(None, description="Valor numérico da quantidade total")
    unidade: Optional[str] = Field(None, description="Unidade da quantidade (kg, L, unid)")
    dose_valor: Optional[float] = Field(None, description="Taxa de aplicação (ex: 5 em '5 L/ha')")
    dose_unidade: Optional[str] = Field(None, description="Unidade da dose (ex: L/ha)")
    cultura: Optional[str] = Field(None, description="Cultura alvo (ex: Tomate)")
    fase: Optional[str] = Field(None, description="Fase fenológica ou momento (ex: Cobertura)")
    local: Optional[Dict[str, Any]] = Field(None, description="Local com chaves 'talhao' e/ou 'canteiro'")

class ExtracaoIA(BaseModel):
    """Schema Pydantic robusto para parse nativo usando with_structured_output do Langchain v1."""
    intencao: str = Field(..., description="'execucao', 'planejamento' ou 'duvida'")
    secao_pmo: Optional[int] = Field(None, description="Número da seção do PMO (1-18) se planejamento")
    alerta_conformidade: Optional[str] = Field(None, description="Mensagem de alerta educativo se necessário")
    tipo_atividade: Optional[str] = Field(None, description="'Plantio', 'Manejo', 'Colheita', 'Insumo', 'Compra', 'Venda', 'Outro'")
    data_registro: Optional[str] = Field(None, description="Data formato YYYY-MM-DD")
    talhao_canteiro: Optional[str] = Field(None, description="Local mencionado")
    origem: Optional[str] = Field(None, description="'Compra', 'Venda / Saída', 'Produção Própria', 'Doação'")
    atividades: Optional[List[AtividadeExtracao]] = Field(None, description="Lista de atividades detalhadas")
    produto: Optional[str] = Field(None, description="Nome do produto legado / compat")
    quantidade_valor: Optional[float] = Field(None, description="Valor da quantidade global")
    quantidade_unidade: Optional[str] = Field(None, description="Unidade da quantidade global")
    valor_total: Optional[float] = Field(None, description="Valor em R$")
    tipo_operacao: Optional[str] = Field(None, description="Detalhe da operação para Manejo")
    responsavel: Optional[str] = Field(None, description="Nome da pessoa responsável")
    equipamentos: Optional[List[str]] = Field(None, description="Ferramentas utilizadas")
    lote: Optional[str] = Field(None, description="Código do Lote")
    destino: Optional[str] = Field(None, description="Destino da produção/venda")
    classificacao: Optional[str] = Field(None, description="Classificação de Colheita")
    observacoes: Optional[str] = Field(None, description="Texto livre qualitativo")
    houve_descartes: Optional[bool] = Field(None, description="Se houve descarte/perda")
    qtd_descartes: Optional[float] = Field(None, description="Qtde perdida")
    unidade_descartes: Optional[str] = Field(None)
    detalhes_tecnicos: Optional[Dict[str, Any]] = Field(None, description="Dicionário aninhado opcional")
    observacao_original: Optional[str] = Field(None, description="Contexto extra")
    subtipo: Optional[str] = Field(None, description="Subtipo de manejo")

def call_llm_with_retries(user_text: str, max_attempts: int = 3) -> dict:
    """
    Call LLM with progressive prompts on retry using modern langchain init_chat_model.
    
    Returns:
        dict with keys: success, data, attempts, tokens_used, tokens_prompt, tokens_completion, latency_ms
    """
    last_error = None
    last_raw_response = None
    total_tokens_used = 0
    tokens_prompt = 0
    tokens_completion = 0
    start_time = time.time()
    
    # Inject dynamic date context to prevent hallucination
    fuso = pytz.timezone('America/Sao_Paulo')
    now_br = datetime.now(fuso)
    data_hoje = now_br.strftime('%d/%m/%Y')
    data_ontem = (now_br - timedelta(days=1)).strftime('%d/%m/%Y')
    data_anteontem = (now_br - timedelta(days=2)).strftime('%d/%m/%Y')
    
    date_context = (
        f"[CONTEXTO TEMPORAL: Agora são {now_br.strftime('%H:%M')} de {data_hoje} (UTC-3). "
        f"'Hoje' = {data_hoje}. 'Ontem' = {data_ontem}. 'Anteontem' = {data_anteontem}. "
        f"Se o usuário não mencionar data, use {data_hoje}.]"
    )
    user_text_with_context = f"{date_context}\n\n{user_text}"
    
    # Initialize unified model config using Groq as default 
    llm = init_chat_model(model="llama-3.3-70b-versatile", model_provider="groq", temperature=0)
    # Using structured output feature
    structured_llm = llm.with_structured_output(ExtracaoIA, include_raw=True)
    
    for attempt in range(1, max_attempts + 1):
        try:
            if attempt == 1:
                system_prompt = get_system_prompt()
            elif attempt == 2:
                system_prompt = get_retry_correction_prompt()
            else:
                system_prompt = get_minimal_prompt()
            
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_text_with_context)
            ]
            
            response_dict = structured_llm.invoke(messages)
            
            raw_res = response_dict.get("raw")
            parsed_result: ExtracaoIA = response_dict.get("parsed")
            
            if not parsed_result:
                raise ValueError("O LLM não conseguiu retornar uma saída estruturada válida para ExtracaoIA")
            
            last_raw_response = str(raw_res)
            
            # Capture detailed token usage
            if raw_res and hasattr(raw_res, 'usage_metadata') and raw_res.usage_metadata:
                pt = getattr(raw_res.usage_metadata, 'input_tokens', 0) or raw_res.usage_metadata.get('input_tokens', 0)
                ct = getattr(raw_res.usage_metadata, 'output_tokens', 0) or raw_res.usage_metadata.get('output_tokens', 0)
                total = pt + ct
                total_tokens_used += total
                tokens_prompt += pt
                tokens_completion += ct
                logger.info(f"📊 Tokens used this call: {total} (prompt: {pt}, completion: {ct})")
            elif raw_res and hasattr(raw_res, 'response_metadata'):
                meta = raw_res.response_metadata
                usage = meta.get('token_usage') or meta.get('usage')
                if usage:
                    pt = usage.get("prompt_tokens", 0)
                    ct = usage.get("completion_tokens", 0)
                    total = usage.get("total_tokens", pt + ct)
                    total_tokens_used += total
                    tokens_prompt += pt
                    tokens_completion += ct
                    logger.info(f"📊 Tokens used this call: {total} (prompt: {pt}, completion: {ct})")
            
            # Convert pydantic object back to dict expected by validations
            json_data = parsed_result.model_dump(exclude_none=True)
            
            return {
                "success": True, 
                "data": json_data, 
                "attempts": attempt,
                "tokens_used": total_tokens_used,
                "tokens_prompt": tokens_prompt,
                "tokens_completion": tokens_completion,
                "latency_ms": int((time.time() - start_time) * 1000),
                "raw_response": last_raw_response
            }
            
        except Exception as e:
            last_error = str(e)
            logger.error(f"❌ Attempt {attempt}: Unexpected error - {last_error}")
            continue
    
    return {
        "success": False, 
        "error": last_error, 
        "attempts": max_attempts,
        "tokens_used": total_tokens_used,
        "tokens_prompt": tokens_prompt,
        "tokens_completion": tokens_completion,
        "latency_ms": int((time.time() - start_time) * 1000),
        "raw_response": last_raw_response
    }


# ==============================================================================
# COMPLIANCE CHECK
# ==============================================================================

def verificar_compliance(user_id: str, dados: dict) -> list:
    """Verify IMA compliance rules."""
    alertas = []
    
    try:
        pmo_id = get_latest_pmo_id(user_id)
        if not pmo_id:
            return alertas
        
        # Check input against PMO planning
        if dados.get("tipo_atividade") in ["Manejo", "Insumo"]:
            insumo = dados.get("detalhes_tecnicos", {}).get("insumo") or dados.get("produto")
            if insumo:
                # validar_insumo_pmo returns bool, not dict
                insumo_autorizado = validar_insumo_pmo(pmo_id, insumo)
                if not insumo_autorizado:
                    alertas.append(f"⚠️ Insumo '{insumo}' não autorizado no Plano.")
        
        # Check talhao status
        talhao = dados.get("talhao_canteiro", "")
        if talhao and talhao != "NÃO INFORMADO":
            status = get_talhao_status(pmo_id, talhao)
            if status and status.get("status") == "quarentena":
                alertas.append(f"⚠️ Talhão '{talhao}' está em período de carência.")
        
        # Check equipment for cleaning
        detalhes = dados.get("detalhes_tecnicos", {})
        if detalhes.get("subtipo") == "HIGIENIZACAO":
            item = detalhes.get("item_higienizado") or detalhes.get("item_limpo")
            if item:
                equipamentos = get_equipamentos(user_id) # fix: pass user_id not pmo_id to match db handler
                if equipamentos:
                    nomes_db = [e['nome'].lower() for e in equipamentos]
                    match = any(item.lower() in n_db or n_db in item.lower() for n_db in nomes_db)
                    if not match:
                        alertas.append(f"⚠️ Equipamento '{item}' não encontrado no inventário.")
    
    except Exception as e:
        logger.error(f"Erro em verificar_compliance: {e}")
    
    return alertas


# ==============================================================================
# VALIDATION AND NORMALIZATION (uses parsing.py + Pydantic)
# ==============================================================================

# Activity type mapping
ACTIVITY_TYPE_MAP = {
    "plantar": "Plantio", "semeio": "Plantio", "semeadura": "Plantio",
    "colher": "Colheita",
    "aplicar": "Manejo", "adubar": "Manejo", "pulverizar": "Manejo",
    "limpar": "Manejo", "roçar": "Manejo", "capinar": "Manejo",
    "comprar": "Insumo", "receber": "Insumo"
}

# Manejo subtype mapping
MANEJO_SUBTYPE_MAP = {
    "Manejo Cultural": "MANEJO_CULTURAL",
    "MANEJO_CULTURAL": "MANEJO_CULTURAL",
    "Manejo": "MANEJO_CULTURAL",
    "Aplicação de Insumos": "APLICACAO_INSUMO",
    "Aplicacao de Insumos": "APLICACAO_INSUMO",
    "APLICACAO_INSUMO": "APLICACAO_INSUMO",
    "Insumo": "APLICACAO_INSUMO",
    "Higienização": "HIGIENIZACAO",
    "Higienizacao": "HIGIENIZACAO",
    "HIGIENIZACAO": "HIGIENIZACAO",
    "Limpeza": "HIGIENIZACAO"
}


def validar_e_normalizar_json(dados: dict, user_id: str = None) -> dict:
    """
    Validate and normalize LLM output using Pydantic models.
    """
    logger.info("🧹 Normalizing data with Pydantic...")
    
    # ==========================================================================
    # INTENT DETECTION: Planning vs Execution (PMO Conversacional - Fase 2)
    # ==========================================================================
    intencao = dados.get("intencao", "execucao")
    
    # Robustez: Aceita 'doubt' (inglês) como alias para 'duvida'
    if intencao in ["duvida", "doubt"]:
        dados["intencao"] = "duvida"  # Norma
        logger.info("❓ Detected DOUBT intent - skipping Pydantic validation")
        return dados # Retorna direto, sem validar via Pydantic
    
    if intencao == "planejamento":
        logger.info("📝 Detected PLANNING intent - routing to PlanejamentoRecord")
        
        # Get date (default to today if not provided)
        fuso = pytz.timezone('America/Sao_Paulo')
        data_reg = dados.get("data_registro")
        if not data_reg:
            data_reg = datetime.now(fuso).date()
        elif isinstance(data_reg, str):
            data_reg = parse_date_br(data_reg) or datetime.now(fuso).date()
        
        # --- SECTION 9 SPECIAL HANDLING (9.1 vs 9.4) ---
        raw_secao = dados.get("secao_pmo", 8)
        descricao_final = dados.get("observacao_original") or dados.get("observacoes") or ""
        alerta_extra = None

        # --- HEURÍSTICA DE CORREÇÃO (ANTI-ALUCINAÇÃO) ---
        keywords_insumo = ["esterco", "adubo", "calcário", "calcario", "composto", "torta", "termofosfato", "cinza"]
        desc_lower = (descricao_final + " " + (dados.get("produto") or "")).lower()
        
        try:
            if int(float(raw_secao)) == 9:
                if any(k in desc_lower for k in keywords_insumo):
                    logger.warning(f"🤖 IA Alucinou Seção 9 para Insumo ({dados.get('produto')}). Corrigindo para Seção 8.")
                    raw_secao = 8
        except:
            pass 

        check_secao_str = str(raw_secao)
        if "9.1" in check_secao_str:
            descricao_final = f"[Seção 9.1 - Orgânico] {descricao_final}"
        elif "9.4" in check_secao_str:
            descricao_final = f"[Seção 9.4 - Paralelo] {descricao_final}"

        try:
            is_propagacao = int(float(raw_secao)) == 9
        except:
            is_propagacao = False

        if is_propagacao:
            prod_desc = (dados.get("produto") or "").lower() + " " + descricao_final.lower()
            sem_org_keywords = ["não orgânico", "nao organico", "convencional", "tratada"]
            if any(k in prod_desc for k in sem_org_keywords):
                alerta_extra = "⚠️ O uso de sementes/mudas não orgânicas requer justificativa técnica e autorização prévia."
        
        # --- SECTION 10 SPECIAL HANDLING (Fitossanidade) ---
        dose_val = parse_float_br(dados.get("dose_valor"))
        dose_un = dados.get("dose_unidade")
        if dose_un:
            dose_un = dose_un.lower().replace(" por ", "/").replace(" p/ ", "/").strip()
            if dose_un in ["ml/l", "ml/litro", "ml / l"]:
                dose_un = "ml/litro"
            elif dose_un in ["g/l", "g/litro"]:
                dose_un = "g/litro"
            else:
                 dose_un = normalize_unit(dose_un)

        planejamento_data = {
            "intencao": "planejamento",
            "secao_pmo": raw_secao,
            "descricao": descricao_final,
            "data_registro": data_reg,
            "produto": dados.get("produto"),
            "quantidade": dados.get("quantidade_valor"),
            "unidade": dados.get("quantidade_unidade"),
            "unidade": dados.get("quantidade_unidade"),
            "observacoes": dados.get("observacoes"),
            "alerta_conformidade": alerta_extra or dados.get("alerta_conformidade"),
            
            # Padrão de Estimativas (Seção 2)
            "area_plantada": dados.get("area_plantada"),
            "unidade_area": dados.get("unidade_area"),
            "producao_anual": dados.get("producao_anual"),
            "unidade_producao": dados.get("unidade_producao"),
            
            # Secao 10 Fields
            "dose_valor": dose_val,
            "dose_unidade": dose_un,
            "alvo_praga_doenca": dados.get("alvo_praga_doenca") or dados.get("alvo_principal") or dados.get("praga_doenca"),
            "cultura": dados.get("cultura") or dados.get("onde"),
            "procedencia": dados.get("procedencia"),
            
            "atividades": [
                {**a, "local": a.get("local") or {"talhao": "NÃO INFORMADO"}} 
                for a in dados.get("atividades", [])
            ],
            "fase": dados.get("fase")
        }
        
        # --- EDUCATIONAL COMPLIANCE ---
        produto = planejamento_data.get("produto") or ""
        if produto and not planejamento_data.get("alerta_conformidade"):
            verificacao = validar_regras_negocio({"produto": produto})
            if verificacao.get("status") == "BLOQUEADO":
                planejamento_data["alerta_conformidade"] = (
                    f"⚠️ Atenção: {verificacao.get('mensagem', 'Produto não permitido em orgânicos')}. "
                    f"Isso pode invalidar sua certificação."
                )
                logger.info(f"📚 Educational alert attached for product: {produto}")
        
        # Validate with Pydantic
        try:
            record = PlanejamentoRecord.model_validate(planejamento_data)
            dados_norm = record.model_dump()
            
            if isinstance(dados_norm.get("data_registro"), date):
                dados_norm["data_registro"] = dados_norm["data_registro"].isoformat()
            
            dados_norm["nome_secao"] = PMO_SECOES.get(dados_norm["secao_pmo"], f"Seção {dados_norm['secao_pmo']}")
            
            logger.info(f"✅ PlanejamentoRecord validated: Seção {dados_norm['secao_pmo']} - {dados_norm['nome_secao']}")
            return dados_norm
            
        except ValidationError as e:
            logger.error(f"❌ PlanejamentoRecord validation failed: {e.errors()}")
            raise
    
    # ==========================================================================
    # EXECUTION FLOW (existing logic for Caderno de Campo records)
    # ==========================================================================
    
    dados_clean = dados.copy()
    
    obs = dados.get("observacao_original") or dados.get("observacao") or ""
    dados_clean["observacao_original"] = sanitize_string(obs, max_length=2000, default="")

    raw_tipo = str(dados.get("tipo_atividade", "Outro"))
    tipo_lower = raw_tipo.lower()
    if tipo_lower in ACTIVITY_TYPE_MAP:
        dados_clean["tipo_atividade"] = ACTIVITY_TYPE_MAP[tipo_lower]
    else:
        dados_clean["tipo_atividade"] = raw_tipo.capitalize()

    detalhes = dados.get("detalhes_tecnicos", {}) or {}
    if not isinstance(detalhes, dict): detalhes = {}
    
    # --- RELATIONAL FIELDS NORMALIZATION ---
    for field in ["tipo_operacao", "responsavel", "equipamentos", "lote", "destino", "classificacao", "origem", "valor_total", "observacoes"]:
        val = dados.get(field) or detalhes.get(field)
        if val is not None:
             dados_clean[field] = val
             if field == "observacoes" and val:
                 detalhes["observacoes"] = val 

    if "equipamentos" in dados_clean:
        eq = dados_clean["equipamentos"]
        if isinstance(eq, str):
            dados_clean["equipamentos"] = [x.strip() for x in eq.split(",") if x.strip()]
        elif not isinstance(eq, list):
            dados_clean["equipamentos"] = []
            
    if dados_clean["tipo_atividade"] == "Manejo":
        if not dados_clean.get("tipo_operacao"):
             sub = dados.get("subtipo") or detalhes.get("subtipo")
             if sub == "HIGIENIZACAO":
                 dados_clean["tipo_operacao"] = "Higienização"
             elif sub == "APLICACAO_INSUMO":
                 dados_clean["tipo_operacao"] = "Aplicação de Insumos"
             elif sub == "MANEJO_CULTURAL":
                 dados_clean["tipo_operacao"] = "Manejo Cultural"
             else:
                 dados_clean["tipo_operacao"] = "Manejo Cultural"
        
        subtipo_raw = details_sub = detalhes.get("subtipo") or dados.get("subtipo")
        if not subtipo_raw:
             if "dosagem" in detalhes or "insumo" in detalhes:
                 subtipo_raw = "Aplicação de Insumos"
             elif "item_limpo" in detalhes or "higienizacao" in str(detalhes).lower():
                 subtipo_raw = "Higienização"
             else:
                 subtipo_raw = "Manejo Cultural"
        
        detalhes["subtipo"] = MANEJO_SUBTYPE_MAP.get(subtipo_raw, "MANEJO_CULTURAL")
        
        if "dosagem" in dados: detalhes["dosagem"] = dados["dosagem"]
        if "insumo" in dados and "insumo" not in detalhes: detalhes["insumo"] = dados["insumo"]
        if detalhes["subtipo"] == "HIGIENIZACAO" and "item_limpo" in dados:
             detalhes["item_higienizado"] = dados["item_limpo"]

    if dados_clean["tipo_atividade"] == "Colheita":
         if "destino" in dados: detalhes["destino"] = dados["destino"]
         if "classificacao" in dados: detalhes["classificacao"] = dados["classificacao"]
         
         if not dados_clean.get("lote"):
             data_reg = dados_clean.get("data_registro")
             if isinstance(data_reg, str):
                 data_reg = parse_date_br(data_reg)
             dados_clean["lote"] = gerar_codigo_lote(data_reg)
             logger.info(f"🆔 Auto-generated lote (Colheita): {dados_clean['lote']}")
    
    origem = dados_clean.get("origem") or dados.get("origem")
    if origem == "Produção Própria" and not dados_clean.get("lote"):
        data_reg = dados_clean.get("data_registro")
        if isinstance(data_reg, str):
            data_reg = parse_date_br(data_reg)
        dados_clean["lote"] = gerar_codigo_lote(data_reg)
        logger.info(f"🆔 Auto-generated lote (Produção Própria): {dados_clean['lote']}")

    dados_clean["detalhes_tecnicos"] = detalhes

    if not dados_clean.get("data_registro"):
        fuso = pytz.timezone('America/Sao_Paulo')
        dados_clean["data_registro"] = datetime.now(fuso).date()
    
    # --- DISCARD/LOSS FIELDS ---
    houve_descartes = dados.get("houve_descartes", False)
    if isinstance(houve_descartes, str):
        if houve_descartes.lower() in ['true', '1', 's', 'sim', 'yes', 'v', 'verdadeiro']:
             houve_descartes = True
        else:
             houve_descartes = False
    else:
        houve_descartes = bool(houve_descartes)

    qtd_descartes = parse_float_br(dados.get("qtd_descartes")) if dados.get("qtd_descartes") else None
    unidade_descartes = dados.get("unidade_descartes")
    
    if qtd_descartes and qtd_descartes > 0:
        houve_descartes = True
    
    dados_clean["houve_descartes"] = houve_descartes
    dados_clean["qtd_descartes"] = qtd_descartes
    dados_clean["unidade_descartes"] = unidade_descartes
    
    # --- COMPATIBILITY LAYER ---
    atividades = dados_clean.get("atividades", [])
    if not atividades:
        prod = dados.get("produto")
        if not prod or prod.upper() in ["NÃO INFORMADO", "NAO INFORMADO", "N/A", ""]:
            prod = detalhes.get("insumo") or detalhes.get("nome_insumo") or dados.get("insumo")
        
        prod = sanitize_string(prod, default="NÃO INFORMADO").upper()
        if prod.endswith("S") and len(prod) > 3 and not prod.endswith("SS"):
            prod = prod[:-1]
        
        dados_clean["produto"] = prod
            
        item = {
            "produto": prod,
            "quantidade": dados.get("quantidade_valor"),
            "unidade": dados.get("quantidade_unidade", "unid"),
            "local": {
                 "talhao": dados_clean.get("talhao_canteiro") or dados.get("talhao_canteiro") or "NÃO INFORMADO"
            },
            "papel": "principal"
        }
        dados_clean["atividades"] = [item]
    else:
        cleaned_ativ = []
        for atv in atividades:
             if "local" in atv and isinstance(atv["local"], str):
                 atv["local"] = {"talhao": atv["local"]}
             cleaned_ativ.append(atv)
        dados_clean["atividades"] = cleaned_ativ

    # 2. Use Factory to Create and Validate Model
    try:
        record_model = create_record_from_dict(dados_clean)
    except ValidationError:
        raise

    # 3. Convert back to dict for processing compliance and business rules
    dados_norm = record_model.model_dump()
    
    if isinstance(dados_norm.get("data_registro"), date):
        dados_norm["data_registro"] = dados_norm["data_registro"].isoformat()

    if dados_norm.get("talhao_canteiro") == "NÃO INFORMADO" and dados_norm.get("atividades"):
        first_local = dados_norm["atividades"][0].get("local", {})
        if first_local.get("talhao") and first_local.get("talhao") != "NÃO INFORMADO":
            dados_norm["talhao_canteiro"] = first_local["talhao"]
            if first_local.get("canteiro"):
                dados_norm["talhao_canteiro"] += f", Canteiro {first_local['canteiro']}"

    # 4. Business rules
    logger.info(f"🛡️ Checking Lei 10.831 for: {dados_norm.get('produto')}")
    verificacao = validar_regras_negocio(dados_norm)
    
    if verificacao["status"] == "BLOQUEADO":
        dados_norm["_bloqueio"] = verificacao["mensagem"]
        return dados_norm
    
    # 5. Compliance check
    if user_id:
        alertas_compliance = verificar_compliance(user_id, dados_norm)
        if alertas_compliance:
            verificacao["alertas"].extend(alertas_compliance)
    
    if verificacao["alertas"]:
        alertas_txt = " | ".join(verificacao["alertas"])
        obs_atual = dados_norm["observacao_original"]
        dados_norm["observacao_original"] = f"{obs_atual} [SISTEMA: {alertas_txt}]"
    
    # --- BLOCO DE CORREÇÃO FINAL (FORÇA BRUTA) ---
    produto_atual = dados_norm.get('produto', '')
    detalhes_final = dados_norm.get('detalhes_tecnicos', {}) or {}
    
    if not produto_atual or produto_atual.upper() in ["NÃO INFORMADO", "NAO INFORMADO", ""]:
        novo_nome = detalhes_final.get('insumo') or detalhes_final.get('nome_insumo') or detalhes_final.get('produto_comercial')
        if novo_nome:
            logger.info(f"🔄 CORREÇÃO: Promovendo '{novo_nome}' para produto principal.")
            dados_norm['produto'] = str(novo_nome).title()
            
            if dados_norm.get('atividades') and len(dados_norm['atividades']) > 0:
                dados_norm['atividades'][0]['produto'] = dados_norm['produto']
            
    return dados_norm


# ==============================================================================
# MAIN PROCESSING FUNCTION
# ==============================================================================

def processar_ia(texto_usuario: str, user_id: str = None) -> dict:
    """
    Process user text using AI with progressive retry.
    Includes Circuit Breaker pattern.
    
    Returns:
        dict with keys: status, message, data, usage (audit metrics)
    """
    # =========================================================================
    # INPUT SANITIZATION
    # =========================================================================
    texto_usuario = sanitizar_input(texto_usuario)
    logger.debug(f"🧹 Input sanitizado: {texto_usuario[:100]}...")
    
    # =========================================================================
    # CIRCUIT BREAKER
    # =========================================================================
    if validar_manejo is not None:
        pre_check = validar_manejo(texto_usuario)
        
        if not pre_check.valido:
            logger.warning(f"⛔ CIRCUIT BREAKER: Blocked input detected in: '{texto_usuario[:50]}...'")
            incr("record_blocked_pre_llm", motivo="insumo_proibido")
            return {
                "status": "blocked",
                "message": pre_check.mensagem,
                "data": {
                    "base_legal": pre_check.base_legal,
                    "texto_original": texto_usuario
                },
                "usage": {"total_tokens": 0, "prompt_tokens": 0, "completion_tokens": 0},
                "latency_ms": 0
            }
        
        if pre_check.nivel == "alerta" and pre_check.mensagem:
            logger.info(f"⚠️ PRE-CHECK ALERT: {pre_check.mensagem}")
    
    # =========================================================================
    # Continue with LLM processing
    # =========================================================================
    
    result = call_llm_with_retries(texto_usuario, max_attempts=3)
    
    # Prepare Usage Metrics for Audit
    usage_metrics = {
        "total_tokens": result.get("tokens_used", 0),
        "prompt_tokens": result.get("tokens_prompt", 0),
        "completion_tokens": result.get("tokens_completion", 0)
    }
    latency_ms = result.get("latency_ms", 0)
    
    if not result["success"]:
        logger.error(f"❌ LLM EXTRACTION FAILED after {result.get('attempts')} attempts")
        logger.error(f"❌ Error: {result.get('error')}")
        logger.error(f"❌ Raw Groq response: {result.get('raw_response', 'N/A')[:2000]}")
        incr("llm_extraction_failed")
        return {
            "status": "error", 
            "message": result["error"],
            "usage": usage_metrics,
            "latency_ms": latency_ms,
            "raw_response": result.get("raw_response")
        }
    
    dados_ia = result["data"]
    logger.info(f"🔍 DEBUG: Success after {result['attempts']} attempt(s) | Product='{dados_ia.get('produto')}' | Activity='{dados_ia.get('tipo_atividade')}' | Tokens={usage_metrics['total_tokens']}")
    logger.info(f"📄 GROQ RAW JSON (pre-validation): {json.dumps(dados_ia, ensure_ascii=False, default=str)}")
    
    if dados_ia.get("houve_descartes"):
        logger.info(f"🗑️ Descarte detectado: {dados_ia.get('qtd_descartes')} {dados_ia.get('unidade_descartes')}")
    
    # Validate and normalize
    try:
        dados_validados = validar_e_normalizar_json(dados_ia, user_id=user_id)
    except ValidationError as e:
        logger.error(f"❌ Validation Error: {e.errors()}")
        incr("record_validation_failed", tipo="SchemaError")
        return {
            "status": "error",
            "message": "Erro de validação nos dados. Verifique o formato.",
            "usage": usage_metrics,
            "latency_ms": latency_ms
        }
    except Exception as e:
        logger.error(f"❌ Unexpected logic error: {e}", exc_info=True)
        return {
             "status": "error",
             "message": "Erro interno ao processar dados.",
             "usage": usage_metrics,
             "latency_ms": latency_ms
        }
    
    if dados_validados.get("_bloqueio"):
        return {
            "status": "blocked",
            "message": dados_validados["_bloqueio"],
            "data": dados_validados,
            "usage": usage_metrics,
            "latency_ms": latency_ms
        }
    
    return {
        "status": "success", 
        "data": dados_validados,
        "usage": usage_metrics,
        "latency_ms": latency_ms
    }

if __name__ == "__main__":
    teste = "Apliquei 5 litros de Glifosato nos tomates"
    print(f"🧪 Testing phrase: {teste}")
    # Note: Requires GROQ_API_KEY in environment
    # res = processar_ia(teste)