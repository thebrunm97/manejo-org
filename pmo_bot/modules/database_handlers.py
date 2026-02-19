"""
database_handlers.py - Handlers para Supabase (Versão Completa + Auditoria Financeira)
"""

import os
import uuid
import time
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo  # Python 3.9+ - Timezone handling
from typing import Dict, Any, Optional, List
from supabase import create_client, Client
from dotenv import load_dotenv

# Import centralized parsing utilities
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parsing import parse_float_br, sanitize_talhao_canteiro, sanitize_string, escape_like_pattern

# Carregar variáveis de ambiente
load_dotenv()

# Configuração de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import metrics
from metrics import incr

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ Configure SUPABASE_URL e SUPABASE_KEY no .env")

# Inicializar cliente GLOBAL (Removido para thread-safety)
# supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
from modules.database import get_supabase_client

# ============================================================================
# AUDITORIA FINANCEIRA E CONTROLE DE COTA (BILLING) 💰
# ============================================================================

FREE_TIER_DAILY_LIMIT = 100  # Max credits per day for free tier

# Tabela de Preços Atualizada (Por 1 Milhão de Tokens)
PRICING_TABLE = {
    "llama-3-70b-8192": {
        "prompt": 0.59,      # $0.59 / 1M input
        "completion": 0.79   # $0.79 / 1M output
    },
    "llama-3.3-70b-versatile": {
        "prompt": 0.59,
        "completion": 0.79
    },
    # Pricing for Gemini 1.5 Flash (Approx. $0.075 / $0.30 per 1M)
    "gemini-1.5-flash": {
        "prompt": 0.075,
        "completion": 0.30
    },
    "whisper-large-v3": {
        "prompt": 0.00010,   # $0.00010 / second (~$0.006/min)
        "completion": 0.0
    },
    "default": {
        "prompt": 0.59,
        "completion": 0.79
    }
}

def check_user_quota(user_id: str, cost: int = 0) -> dict:
    """
    Verifica se o usuário tem cota disponível para requisições de IA.
    """
    try:
        with get_supabase_client() as supabase:
             res = supabase.table("profiles").select(
                "id, plan_tier, daily_request_count, last_usage_date, total_tokens_used"
             ).eq("id", user_id).execute()
        
        if not res.data or len(res.data) == 0:
            logger.warning(f"⚠️ User {user_id} not found for quota check")
            return {"allowed": True, "remaining": FREE_TIER_DAILY_LIMIT, "limit": FREE_TIER_DAILY_LIMIT, "message": None}
        
        profile = res.data[0]
        plan_tier = profile.get("plan_tier", "free") or "free"
        daily_count = profile.get("daily_request_count", 0) or 0
        last_usage = profile.get("last_usage_date")
        
        today = datetime.now().strftime("%Y-%m-%d")
        
        # Reset diário
        if last_usage and last_usage != today:
            daily_count = 0
        
        # Verifica Plano Free
        if plan_tier.lower() == "free":
            if daily_count + cost > FREE_TIER_DAILY_LIMIT:
                logger.warning(f"⛔ User {user_id} exceeded free tier quota")
                return {
                    "allowed": False,
                    "remaining": max(0, FREE_TIER_DAILY_LIMIT - daily_count),
                    "limit": FREE_TIER_DAILY_LIMIT,
                    "message": f"⚠️ Saldo insuficiente! Limite diário: {FREE_TIER_DAILY_LIMIT}."
                }
            
            remaining = FREE_TIER_DAILY_LIMIT - daily_count
            return {"allowed": True, "remaining": remaining, "limit": FREE_TIER_DAILY_LIMIT, "message": None}
        
        return {"allowed": True, "remaining": 9999, "limit": 9999, "message": None}
        
    except Exception as e:
        logger.error(f"❌ Error checking user quota: {e}")
        return {"allowed": True, "remaining": 9999, "limit": 9999, "message": None}

def salvar_log_consumo(
    user_id: str,
    request_id: str,
    acao: str,
    modelo: str,
    usage: dict,
    duracao_ms: int,
    status: str = "success",
    meta: dict = None
) -> bool:
    """
    NOVA FUNÇÃO: Registra o consumo detalhado na tabela 'logs_consumo' e calcula custos.
    Substitui a antiga registrar_auditoria.
    """
    try:
        # 1. Extrair métricas
        safe_usage = usage or {}
        t_prompt = safe_usage.get("prompt_tokens", 0)
        t_completion = safe_usage.get("completion_tokens", 0)
        t_total = safe_usage.get("total_tokens", t_prompt + t_completion)

        # 2. Calcular Custo Estimado
        # Normalize model name for pricing lookup
        pricing_key = "default"
        is_linear = False # Default is per 1M tokens

        if modelo:
            if "gemini-1.5-flash" in modelo:
                pricing_key = "gemini-1.5-flash"
            elif "whisper" in modelo.lower():
                pricing_key = "whisper-large-v3"
                is_linear = True
            elif modelo in PRICING_TABLE:
                pricing_key = modelo
        
        precos = PRICING_TABLE.get(pricing_key, PRICING_TABLE["default"])
        
        if is_linear:
             # Linear: Cost = Amount * UnitPrice (e.g. Seconds * $/sec)
             # Here, t_prompt should hold the duration in seconds
             custo_prompt = t_prompt * precos["prompt"]
             custo_completion = t_completion * precos["completion"]
        else:
             # Standard: Cost = (Tokens / 1M) * Price
             custo_prompt = (t_prompt / 1_000_000) * precos["prompt"]
             custo_completion = (t_completion / 1_000_000) * precos["completion"]

        custo_total = custo_prompt + custo_completion

        payload = {
            "user_id": user_id,
            "request_id": request_id,
            "acao": acao,
            "modelo_ia": modelo,
            "tokens_prompt": t_prompt,
            "tokens_completion": t_completion,
            "total_tokens": t_total,
            "custo_estimado": float(f"{custo_total:.8f}"), # Alta precisão
            "duracao_ms": int(float(duracao_ms)) if duracao_ms else 0,
            "status": status,
            "meta": meta or {},
            "created_at": datetime.utcnow().isoformat()
        }

        # 3. Inserir no log de auditoria
        with get_supabase_client() as supabase:
            supabase.table("logs_consumo").insert(payload).execute()
        
        logger.info(f"🧾 Billing Log [{request_id}]: {t_total} toks | ${custo_total:.6f} | {duracao_ms}ms")

        # 4. Tentar Atualizar Cota do Usuário (Best Effort)
        try:
            with get_supabase_client() as supabase:
                # Tenta via RPC se existir (Atomicidade)
                supabase.rpc("increment_usage_stats", {
                    "p_user_id": user_id,
                    "p_tokens": t_total,
                    "p_credits_cost": 1
                }).execute()
        except:
            # Fallback manual se a RPC não existir
            try:
                with get_supabase_client() as supabase:
                    res = supabase.table("profiles").select("total_tokens_used").eq("id", user_id).single().execute()
                    if res.data:
                        novo_total = (res.data.get("total_tokens_used") or 0) + t_total
                        supabase.table("profiles").update({"total_tokens_used": novo_total}).eq("id", user_id).execute()
            except Exception as e_upd:
                logger.warning(f"⚠️ Erro no fallback de atualização de perfil: {e_upd}")

        return True

    except Exception as e:
        logger.error(f"❌ CRÍTICO: Falha ao salvar log de consumo: {e}", exc_info=True)
        return False

# Alias para compatibilidade com código antigo, se houver chamadas perdidas
def registrar_auditoria(*args, **kwargs):
    logger.warning("⚠️ Função depreciada 'registrar_auditoria' chamada. Redirecionando para 'salvar_log_consumo'...")
    # Tenta mapear ou apenas retorna False para não quebrar
    return False 

# ============================================================================
# LOGS DE TREINAMENTO (DATASET)
# ============================================================================

def salvar_log_treinamento(
    texto_usuario: str,
    json_extraido: dict,
    tipo_atividade: str,
    user_id: str = None,
    pmo_id: int = None,
    modelo_ia: str = "llama-3-70b-8192"
) -> bool:
    """
    Salva o par Texto + JSON para futuro treinamento.
    """
    try:
        log_entry = {
            "texto_usuario": texto_usuario[:2000] if texto_usuario else "",
            "json_extraido": json_extraido,
            "tipo_atividade": tipo_atividade,
            "user_id": user_id,
            "pmo_id": pmo_id,
            "created_at": datetime.utcnow().isoformat(),
            "modelo_ia": modelo_ia,
            "validado": False,
            "processado": False # Fundamental para o Feedback Loop
        }
        
        with get_supabase_client() as supabase:
             response = supabase.table("logs_treinamento").insert(log_entry).execute()
        
        if response.data:
            logger.debug(f"📚 Training log saved for tipo_atividade={tipo_atividade}")
            incr("training_log_saved", tipo=tipo_atividade)
            return True
        return False
            
    except Exception as e:
        logger.warning(f"⚠️ Failed to save training log (non-critical): {e}")
        return False


# ============================================================================
# FUNÇÕES DE "INTELIGÊNCIA ESPACIAL" (O GPS DO BOT) 🗺️
# ============================================================================

def buscar_id_talhao(pmo_id: int, texto_local: str) -> Optional[int]:
    """
    Tenta encontrar um Talhão existente mencionada no texto.
    """
    if not texto_local or not pmo_id:
        return None

    texto_limpo = str(texto_local).lower().strip()
    
    try:
        with get_supabase_client() as supabase:
             res = supabase.table("talhoes").select("id, nome").eq("pmo_id", pmo_id).execute()
        talhoes = res.data or []
        
        for t in talhoes:
            nome_talhao = str(t["nome"]).lower()
            if nome_talhao in texto_limpo:
                logger.info(f"📍 Localização identificada: '{t['nome']}' (ID: {t['id']})")
                return int(t["id"])
        return None
    except Exception as e:
        logger.error(f"⚠️ Erro ao buscar talhão: {e}")
        return None

def buscar_talhao_info(pmo_id: int, texto_local: str) -> Optional[Dict[str, Any]]:
    """
    Retorna { id, nome } do talhão encontrado, ou None.
    Similar a buscar_id_talhao, mas também retorna o nome oficial.
    
    BUSCA ROBUSTA:
    1. Primeiro tenta por pmo_id diretamente
    2. Se não encontrar, busca a propriedade_id vinculada ao PMO e busca por ela
    """
    if not texto_local or not pmo_id:
        return None

    texto_limpo = str(texto_local).lower().strip()
    
    try:
        with get_supabase_client() as supabase:
            # === STRATEGY 1: Buscar por pmo_id ===
            res = supabase.table("talhoes").select("id, nome").eq("pmo_id", pmo_id).execute()
            talhoes = res.data or []
            
            for t in talhoes:
                nome_talhao = str(t["nome"]).lower()
                if nome_talhao in texto_limpo:
                    logger.info(f"📍 Talhão identificado (via pmo_id): '{t['nome']}' (ID: {t['id']})")
                    return {"id": int(t["id"]), "nome": t["nome"]}
            
            # === STRATEGY 2: Fallback por propriedade_id ===
            # Buscar propriedade_id vinculada ao PMO
            logger.info(f"🔍 Nenhum talhão encontrado com pmo_id={pmo_id}, tentando via propriedade...")
            
            pmo_res = supabase.table("pmos").select("propriedade_id").eq("id", pmo_id).limit(1).execute()
            
            if pmo_res.data and pmo_res.data[0].get("propriedade_id"):
                propriedade_id = pmo_res.data[0]["propriedade_id"]
                logger.info(f"📍 Propriedade vinculada ao PMO: {propriedade_id}")
                
                # Buscar talhões pela propriedade
                res2 = supabase.table("talhoes").select("id, nome").eq("propriedade_id", propriedade_id).execute()
                talhoes2 = res2.data or []
                
                for t in talhoes2:
                    nome_talhao = str(t["nome"]).lower()
                    if nome_talhao in texto_limpo:
                        logger.info(f"📍 Talhão identificado (via propriedade): '{t['nome']}' (ID: {t['id']})")
                        return {"id": int(t["id"]), "nome": t["nome"]}
            
            logger.warning(f"⚠️ Nenhum talhão encontrado para '{texto_local}' no PMO {pmo_id}")
            return None
            
    except Exception as e:
        logger.error(f"⚠️ Erro ao buscar info do talhão: {e}")
        return None

# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

def garantir_chaves(dicionario: Dict, caminho: list) -> Dict:
    atual = dicionario
    for chave in caminho:
        if chave not in atual or not isinstance(atual[chave], dict):
            atual[chave] = {}
        atual = atual[chave]
    return atual

def gerar_id_timestamp() -> str:
    return f"new_{int(time.time() * 1000)}"

import re
from typing import List

def normalizar_talhao_e_atividades(
    nome_talhao_oficial: Optional[str],
    texto_local_original: str,
    atividades: Optional[List[Dict]]
) -> Dict[str, Any]:
    """
    Normaliza talhao_canteiro para formato oficial e atualiza atividades[].local.talhao.
    """
    if not nome_talhao_oficial:
        return {
            "talhao_canteiro": texto_local_original,
            "atividades": atividades
        }
    
    numero_canteiro = None
    
    # Tenta extrair canteiro do texto (APENAS se precedido por palavra-chave)
    # Regex atualizado para capturar múltiplos canteiros (ex: "1, 2 e 3")
    match = re.search(r'canteiros?\s+([\d\s,e]+)', texto_local_original, re.IGNORECASE)
    if match:
        # Limpa e captura o grupo inteiror (ex: "1, 2 e 3")
        numero_canteiro = match.group(1).strip()
    # REMOVED: Fallback regex r',\s*(\d+)\s*$' que pegava qualquer número trailing
    
    if not numero_canteiro and atividades and len(atividades) > 0:
        primeiro_local = atividades[0].get("local", {})
        canteiro_atividade = primeiro_local.get("canteiro")
        if canteiro_atividade:
            numero_canteiro = str(canteiro_atividade)
    
    if numero_canteiro:
        talhao_canteiro_normalizado = f"{nome_talhao_oficial}, Canteiro {numero_canteiro}"
    else:
        talhao_canteiro_normalizado = nome_talhao_oficial
    
    atividades_atualizadas = None
    if isinstance(atividades, list):
        atividades_atualizadas = []
        for atividade in atividades:
            atividade_copia = dict(atividade)
            if "local" in atividade_copia and isinstance(atividade_copia["local"], dict):
                atividade_copia["local"] = dict(atividade_copia["local"])
                atividade_copia["local"]["talhao"] = nome_talhao_oficial
            atividades_atualizadas.append(atividade_copia)
    
    return {
        "talhao_canteiro": talhao_canteiro_normalizado,
        "atividades": atividades_atualizadas
    }

# ============================================================================
# HELPER: POPULAR TABELA N:N CADERNO_CAMPO_CANTEIROS
# ============================================================================

def _inserir_vinculos_canteiros(
    caderno_id: str,
    canteiro_ids: list,
    talhao_id: Optional[int] = None
) -> int:
    """
    Populates caderno_campo_canteiros junction table.
    Returns count of successfully linked canteiros.
    """
    if not caderno_id or not canteiro_ids:
        return 0
    
    vinculos_inseridos = 0
    
    for canteiro_id in canteiro_ids:
        try:
            with get_supabase_client() as supabase:
                supabase.table("caderno_campo_canteiros").insert({
                    "caderno_campo_id": caderno_id,
                    "canteiro_id": canteiro_id
                }).execute()
            vinculos_inseridos += 1
        except Exception as e:
            logger.warning(f"⚠️ Falha ao vincular canteiro {canteiro_id}: {e}")
            continue
    
    if vinculos_inseridos > 0:
        logger.info(f"🔗 {vinculos_inseridos} canteiro(s) vinculado(s) ao registro {caderno_id}")
    
    return vinculos_inseridos


# ============================================================================
# FUNÇÃO PRINCIPAL: INSERIR NO CADERNO (AGORA COM GPS E MULTI-CULTURA!)
# ============================================================================

def inserir_no_caderno_campo(payload: dict) -> Optional[str]:
    logger.info("💾 Processando inserção no caderno_campo...")
    
    # DEBUG: Log incoming talhao_canteiro value
    logger.info(f"📍 DEBUG talhao_canteiro recebido: '{payload.get('talhao_canteiro')}'")
    logger.error(f"🚨 DEBUG FORCE: Inserindo no caderno campo! Payload: {payload}")
    
    if not payload.get("pmo_id"):
        logger.warning("⚠️ pmo_id ausente no payload!")
        return None

    pmo_id = int(payload["pmo_id"])
    texto_local = sanitize_talhao_canteiro(payload.get("talhao_canteiro"))
    
    logger.info(f"📍 DEBUG texto_local sanitizado: '{texto_local}'")

    # --- Buscar talhão com ID e nome oficial ---
    talhao_info = buscar_talhao_info(pmo_id, texto_local)
    talhao_id_encontrado = talhao_info["id"] if talhao_info else None
    nome_talhao_oficial = talhao_info["nome"] if talhao_info else None
    
    logger.info(f"📍 DEBUG talhao_info encontrado: {talhao_info} | ID: {talhao_id_encontrado}")

    # --- Normalizar talhao_canteiro e atividades ---
    normalizados = normalizar_talhao_e_atividades(
        nome_talhao_oficial,
        texto_local,
        payload.get("atividades")
    )
    texto_local_normalizado = normalizados["talhao_canteiro"]
    atividades_normalizadas = normalizados["atividades"]

    # --- Buscar canteiro ID (Suporte Múltiplos) ---
    canteiro_ids = []
    
    # 1. Tentar extrair do Payload (se vier estruturado de alguma atualização futura)
    # Por enquanto vem no texto do local ou atividades
    
    # 2. Tentar extrair do Texto RAW (texto_local) para evitar perdas na normalização
    # Ex: "Talhão 1, canteiros 1, 2 e 3" -> Pega todos
    if talhao_id_encontrado:
        # Regex robusto para capturar listas de números
        # Captura "1, 2 e 3" de "Canteiros 1, 2 e 3"
        match_lote = re.search(r'canteiros?\s+([\d\s,e]+)', texto_local, re.IGNORECASE)
        
        numeros_encontrados = []
        if match_lote:
            # Extrair parte dos números e limpar: "1, 2 e 3" -> "1, 2, 3"
            parte_numeros = match_lote.group(1).replace(' e ', ',')
            # Split por vírgula e espaço
            candidatos = [n.strip() for n in parte_numeros.split(',') if n.strip().isdigit()]
            numeros_encontrados.extend(candidatos)
        else:
             # Tenta formato simples "Canteiro 1" se o regex de lista falhar
             # (embora o regex acima já deva pegar um também, mas mantemos por segurança)
             match_single = re.search(r'canteiro\s*(\d+)', texto_local, re.IGNORECASE)
             if match_single:
                 numeros_encontrados.append(match_single.group(1))
        
        # Remover duplicatas
        numeros_encontrados = list(set(numeros_encontrados))
        
        if numeros_encontrados:
            logger.info(f"🔢 Números extraídos para busca de canteiros: {numeros_encontrados}")
            logger.info(f"🔎 Buscando canteiros no Talhão {talhao_id_encontrado}")
            try:
                # ESTRATÉGIA HÍBRIDA: Busca Abrangente + Filtro Inteligente
                for num in numeros_encontrados:
                    num_int = int(num)  # Número alvo como inteiro
                    
                    with get_supabase_client() as supabase:
                        # BUSCA ABRANGENTE: Traz tudo que contém o dígito
                        # Ex: Busca "1" -> Retorna "Canteiro 1", "Canteiro 10", "C-01"
                        res_cant = supabase.table("canteiros")\
                            .select("id, nome")\
                            .eq("talhao_id", talhao_id_encontrado)\
                            .ilike("nome", f"%{num}%")\
                            .execute()
                    
                    candidatos = res_cant.data or []
                    
                    if not candidatos:
                        logger.warning(f"⚠️ Nenhum canteiro candidato encontrado para '{num}'")
                        continue
                    
                    logger.info(f"📋 Candidatos encontrados: {[c['nome'] for c in candidatos]}")
                    
                    # FILTRO FINO (Python): Garante match exato do número
                    match_encontrado = False
                    for canteiro in candidatos:
                        nome_db = canteiro['nome']
                        
                        # Extrai TODOS os números do nome do canteiro
                        numeros_no_nome = re.findall(r'\d+', nome_db)
                        
                        # Verifica se algum número extraído é igual ao alvo (como inteiro)
                        # Isso resolve: "1" == "01", "1" != "10", "5" != "50"
                        for n_db in numeros_no_nome:
                            if int(n_db) == num_int:
                                if canteiro['id'] not in canteiro_ids:
                                    canteiro_ids.append(canteiro['id'])
                                    logger.info(f"✅ VÍNCULO CONFIRMADO: '{nome_db}' corresponde ao alvo '{num}'")
                                match_encontrado = True
                                break
                        
                        if match_encontrado:
                            break
                    
                    if not match_encontrado:
                        logger.warning(f"⚠️ Candidatos rejeitados para '{num}' (não correspondem exatamente): {[c['nome'] for c in candidatos]}")
            except Exception as e:
                logger.error(f"❌ Erro ao buscar canteiros múltiplos: {e}")

    # Fallback antigo: Se não achou nada acima, tenta o canteiro_nome único antigo (opcional, ou removemos)
    # O código acima já deve cobrir o caso simples.
    
    # Atualizar payload de atividades com o primeiro canteiro encontrado (para compatibilidade)
    # Ou replicar atividades? Por enquanto, associa ao primeiro.
    if canteiro_ids and atividades_normalizadas:
         for atividade in atividades_normalizadas:
             if "local" in atividade and isinstance(atividade["local"], dict):
                 atividade["local"]["canteiro_ids"] = canteiro_ids # Novo campo lista
                 atividade["local"]["canteiro_id"] = canteiro_ids[0] # Mantém principal

    try:
        # --- Build detalhes_tecnicos based on activity type ---
        tipo_atividade = payload.get("tipo_atividade") or "Outro"
        quantidade_valor = parse_float_br(payload.get("quantidade_valor"))
        quantidade_unidade = payload.get("quantidade_unidade") or "unidade"
        
        detalhes_tecnicos = dict(payload.get("detalhes_tecnicos") or {})
        
        if tipo_atividade.lower() == "plantio":
            if quantidade_valor is not None and "qtd_utilizada" not in detalhes_tecnicos:
                detalhes_tecnicos["qtd_utilizada"] = quantidade_valor
            if quantidade_unidade and "unidade_medida" not in detalhes_tecnicos:
                detalhes_tecnicos["unidade_medida"] = quantidade_unidade
            if "metodo_propagacao" not in detalhes_tecnicos:
                detalhes_tecnicos["metodo_propagacao"] = payload.get("metodo_propagacao", "Muda")
                
        elif tipo_atividade.lower() in ["manejo", "insumo", "adubação", "adubacao"]:
            if quantidade_valor is not None and "dosagem" not in detalhes_tecnicos:
                detalhes_tecnicos["dosagem"] = quantidade_valor
            if quantidade_unidade and "unidade_dosagem" not in detalhes_tecnicos:
                detalhes_tecnicos["unidade_dosagem"] = quantidade_unidade
            
            produto = payload.get("produto")
            if produto and "insumo" not in detalhes_tecnicos and "nome_insumo" not in detalhes_tecnicos:
                detalhes_tecnicos["insumo"] = str(produto).upper()
            if "tipo_manejo" not in detalhes_tecnicos:
                detalhes_tecnicos["tipo_manejo"] = payload.get("tipo_manejo", "Adubação")
                
        elif tipo_atividade.lower() == "colheita":
            if quantidade_valor is not None and "qtd" not in detalhes_tecnicos:
                detalhes_tecnicos["qtd"] = quantidade_valor
            if quantidade_unidade and "unidade" not in detalhes_tecnicos:
                detalhes_tecnicos["unidade"] = quantidade_unidade
        
        # --- Extract discard/loss information ---
        houve_descartes = bool(payload.get("houve_descartes"))
        qtd_descartes = parse_float_br(payload.get("qtd_descartes")) if payload.get("qtd_descartes") else None
        unidade_descartes = payload.get("unidade_descartes")
        
        if qtd_descartes and qtd_descartes > 0:
            houve_descartes = True
        
        insert_payload = {
            "pmo_id": pmo_id,
            "talhao_id": talhao_id_encontrado,
            "canteiro_ids": canteiro_ids if canteiro_ids else None,
            "tipo_atividade": tipo_atividade,
            "produto": str(payload.get("produto") or "").upper(),
            "talhao_canteiro": texto_local_normalizado,
            "data_registro": payload.get("data_registro") or datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m-%d"),
            "quantidade_valor": quantidade_valor,
            "quantidade_unidade": quantidade_unidade,
            "observacao_original": payload.get("observacao_original", "") or payload.get("observacao", ""), # Fallback key
            "detalhes_tecnicos": detalhes_tecnicos,
            "secao_origem": payload.get("secao_origem", "wppconnect"),
            "atividades": atividades_normalizadas if atividades_normalizadas else payload.get("atividades"),
            "sistema": payload.get("sistema"),
            "audio_url": payload.get("audio_url"),
            "houve_descartes": houve_descartes,
            "qtd_descartes": qtd_descartes,
            "unidade_descartes": unidade_descartes,
            "tipo_operacao": payload.get("tipo_operacao"),
            "responsavel": payload.get("responsavel"),
            "equipamentos": payload.get("equipamentos"),
            "lote": payload.get("lote"),
            "destino": payload.get("destino"),
            "classificacao": payload.get("classificacao"),
            "origem": payload.get("origem"),
            "valor_total": payload.get("valor_total"),
            # "criado_em": Let DB handle default now()
            # "updated_at": Let DB handle trigger
        }
        
        logger.debug(f"DEBUG PAYLOAD INSERT: {json.dumps(insert_payload, ensure_ascii=False, default=str)}")
        with get_supabase_client() as supabase:
             response = supabase.table("caderno_campo").insert(insert_payload).execute()
        
        if response.data:
            id_reg = response.data[0]["id"]
            logger.info(f"✅ Registro salvo (ID: {id_reg}) | Talhão: {talhao_id_encontrado}")
            incr("record_created", tipo=tipo_atividade)
            
            # --- Popular tabela N:N caderno_campo_canteiros ---
            if canteiro_ids:
                try:
                    _inserir_vinculos_canteiros(
                        caderno_id=id_reg,
                        canteiro_ids=canteiro_ids,
                        talhao_id=talhao_id_encontrado
                    )
                except Exception as e_vinc:
                    logger.warning(f"⚠️ Falha ao popular vinculos N:N (não-crítico): {e_vinc}")
            
            return id_reg
        return None
        
    except Exception as e:
        logger.error(f"❌ Erro no Caderno: {str(e)}", exc_info=True)
        return None


# ============================================================================
# SECURITY: STATE TRANSITION VALIDATION (A06:2025)
# ============================================================================

ESTADOS_BLOQUEADOS = ["Finalizado", "Auditado", "Enviado_Certificadora"]

class InvalidStateTransitionError(Exception):
    pass

def atualizar_registro_caderno(registro_id: str, novos_dados: dict) -> bool:
    """
    Atualiza registro no caderno_campo apenas se não estiver em estado protegido.
    """
    logger.info(f"📝 Tentando atualizar registro {registro_id}...")
    
    try:
        with get_supabase_client() as supabase:
            res = supabase.table("caderno_campo").select("id, status").eq("id", registro_id).single().execute()
        
        if not res.data:
            raise ValueError(f"Registro {registro_id} não encontrado")
        
        status_atual = res.data.get("status")
        
        if status_atual in ESTADOS_BLOQUEADOS:
            logger.warning(f"⛔ Edição bloqueada! Registro {registro_id} tem status '{status_atual}'")
            raise InvalidStateTransitionError(
                f"Registros com status '{status_atual}' não podem ser editados."
            )
        
        with get_supabase_client() as supabase:
             response = supabase.table("caderno_campo").update(novos_dados).eq("id", registro_id).execute()
        
        if response.data:
            logger.info(f"✅ Registro {registro_id} atualizado com sucesso")
            incr("record_updated", status_anterior=status_atual)
            return True
        
        return False
        
    except InvalidStateTransitionError:
        raise
    except Exception as e:
        logger.error(f"❌ Erro ao atualizar registro: {e}", exc_info=True)
        return False


# ============================================================================
# SINCRONIZAÇÃO LEGADA (MANTIDA IGUAL PARA O FRONTEND)
# ============================================================================

def sincronizar_secao_8(supabase_inst, pmo_id: int, dados_ia: Dict) -> bool:
    try:
        # Use existing client if passed, or create new thread-safe context
        if supabase_inst:
             client = supabase_inst
             # Note: if supabase_inst is passed, caller is responsible for context
             resp = client.table("pmos").select("form_data").eq("id", pmo_id).single().execute()
        else:
             with get_supabase_client() as client:
                  resp = client.table("pmos").select("form_data").eq("id", pmo_id).single().execute()
        
        if not resp.data: return False
        form_data = resp.data.get("form_data") or {}

        novo_insumo = {
            "id": str(uuid.uuid4()),
            "produto_ou_manejo": str(dados_ia.get("produto", "NÃO INFORMADO")).upper(),
            "onde": dados_ia.get("talhao_canteiro", "Local não especificado"),
            "quando": dados_ia.get("data_registro", ""),
            "procedencia": dados_ia.get("procedencia", "Externa"),
            "composicao": dados_ia.get("composicao", "Não informada"),
            "marca": dados_ia.get("marca", "Própria"),
            "dosagem": f"{parse_float_br(dados_ia.get('quantidade_valor'))} {dados_ia.get('quantidade_unidade', '')}".strip()
        }

        if "insumos_melhorar_fertilidade" not in form_data: form_data["insumos_melhorar_fertilidade"] = []
        if not isinstance(form_data["insumos_melhorar_fertilidade"], list): form_data["insumos_melhorar_fertilidade"] = []
        form_data["insumos_melhorar_fertilidade"].append(novo_insumo)

        secao_8 = garantir_chaves(form_data, ["secao_8_insumos_equipamentos"])
        if "insumos_melhorar_fertilidade" not in secao_8: secao_8["insumos_melhorar_fertilidade"] = []
        
        if supabase_inst:
             supabase_inst.table("pmos").update({"form_data": form_data}).eq("id", pmo_id).execute()
        else:
             with get_supabase_client() as client:
                  client.table("pmos").update({"form_data": form_data}).eq("id", pmo_id).execute()
        return True
    except Exception as e:
        logger.error(f"❌ Erro Secao 8: {e}")
        return False

def sincronizar_secao_2(supabase_inst, pmo_id: int, dados_ia: Dict) -> bool:
    try:
        if supabase_inst:
            client = supabase_inst
            resp = client.table("pmos").select("form_data").eq("id", pmo_id).single().execute()
        else:
            with get_supabase_client() as client:
                resp = client.table("pmos").select("form_data").eq("id", pmo_id).single().execute()

        if not resp.data: return False
        form_data = resp.data.get("form_data") or {}

        novo_cultivo = {
            "id": gerar_id_timestamp(),
            "produto": str(dados_ia.get("produto", "")).upper(),
            "talhoes_canteiros": dados_ia.get("talhao", "Não informado"),
            "area_plantada": parse_float_br(dados_ia.get("area")),
            "area_plantada_unidade": dados_ia.get("unidade_area", "ha"),
            "producao_esperada_ano": parse_float_br(dados_ia.get("producao_anual")),
            "producao_unidade": dados_ia.get("unidade_producao", "kg")
        }

        raiz_sec2 = garantir_chaves(form_data, ["secao_2_atividades_produtivas_organicas", "producao_primaria_vegetal"])
        target = "produtos_primaria_vegetal"
        if target not in raiz_sec2 or not isinstance(raiz_sec2[target], list): raiz_sec2[target] = []
        raiz_sec2[target].append(novo_cultivo)

        if supabase_inst:
            supabase_inst.table("pmos").update({"form_data": form_data}).eq("id", pmo_id).execute()
        else:
             with get_supabase_client() as client:
                  client.table("pmos").update({"form_data": form_data}).eq("id", pmo_id).execute()
        return True
    except Exception as e:
        logger.error(f"❌ Erro Secao 2: {e}")
        return False

# ============================================================================
# NOVOS MÉTODOS IMA (COMPLIANCE)
# ============================================================================

def get_latest_pmo_id(user_id: str) -> Optional[int]:
    """Busca o ID do Plano de Manejo mais recente/ativo do usuário."""
    try:
        with get_supabase_client() as supabase:
            response = supabase.table("pmos")\
                .select("id")\
                .eq("user_id", user_id)\
                .order("created_at", desc=True)\
                .limit(1)\
                .execute()
        if response.data:
            return response.data[0]['id']
        return None
    except Exception as e:
        logger.error(f"❌ Erro ao buscar PMO: {e}")
        return None

def get_equipamentos(user_id: str) -> list:
    """Retorna lista de dicionários com equipamentos do usuário."""
    try:
        with get_supabase_client() as supabase:
            response = supabase.table("pmo_equipamentos")\
                .select("nome, tipo_uso, status_limpeza")\
                .eq("user_id", user_id)\
                .execute()
        return response.data if response.data else []
    except Exception as e:
        logger.error(f"❌ Erro ao buscar equipamentos: {e}")
        return []

def get_talhao_status(pmo_id: int, nome_talhao: str) -> Optional[str]:
    """
    Verifica o status de certificação de um talhão específico no PMO.
    """
    try:
        safe_nome = escape_like_pattern(str(nome_talhao))
        with get_supabase_client() as supabase:
            response = supabase.table("talhoes")\
                .select("status_certificacao")\
                .eq("pmo_id", pmo_id)\
                .ilike("nome", f"%{safe_nome}%")\
                .limit(1)\
                .execute()
        
        if response.data:
            return response.data[0].get('status_certificacao')
        return None
    except Exception as e:
        logger.error(f"❌ Erro ao validar talhão: {e}")
        return None

def validar_insumo_pmo(pmo_id: int, nome_insumo: str) -> bool:
    """
    Verifica se o insumo consta na lista de planejamento (pmo_manejo).
    """
    try:
        safe_insumo = escape_like_pattern(str(nome_insumo))
        with get_supabase_client() as supabase:
             response = supabase.table("pmo_manejo")\
                .select("id")\
                .eq("pmo_id", pmo_id)\
                .ilike("insumo", f"%{safe_insumo}%")\
                .limit(1)\
                .execute()
        
        return len(response.data) > 0
    except Exception as e:
        logger.error(f"❌ Erro ao validar insumo: {e}")
        return False