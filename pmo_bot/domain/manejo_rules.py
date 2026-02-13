"""
pmo_bot/domain/manejo_rules.py
Pure domain logic for organic farming validation.

Based on Lei 10.831/2003, IN MAPA nº 64/2008, IN 46/2011 and IN 17/2014.

This module contains ONLY business rules - no calls to:
- WhatsApp / messaging
- Supabase / database
- External APIs

Accepts/returns only:
- Pydantic models or dicts
- Primitive types (str, bool, list, dict)
"""

from dataclasses import dataclass
from typing import Optional, Dict, List


# =============================================================================
# DATA STRUCTURES
# =============================================================================

@dataclass
class ValidationResult:
    """Result of a validation check."""
    valido: bool
    mensagem: str
    nivel: str  # "erro", "alerta", "info"
    base_legal: Optional[str] = None


# =============================================================================
# ORGANIC INPUTS RULES - Rich Dictionary
# Based on: Lei 10.831/2003, IN 64/2008, IN 46/2011, IN 17/2014
# =============================================================================

ORGANIC_INPUTS_RULES: Dict[str, Dict[str, str]] = {
    # -------------------------------------------------------------------------
    # PROIBIDOS - Herbicidas e Pesticidas Sintéticos
    # -------------------------------------------------------------------------
    "glifosato": {
        "status": "proibido",
        "msg": "Herbicida sintético proibido (Lei 10.831). Risco de perda de certificação.",
        "base": "Lei 10.831"
    },
    "glyphosate": {
        "status": "proibido",
        "msg": "Herbicida sintético proibido (Lei 10.831).",
        "base": "Lei 10.831"
    },
    "roundup": {
        "status": "proibido",
        "msg": "Nome comercial de Glifosato (Proibido).",
        "base": "Lei 10.831"
    },
    "paraquat": {
        "status": "proibido",
        "msg": "Herbicida dessecante proibido em orgânicos.",
        "base": "Lei 10.831"
    },
    "gramoxone": {
        "status": "proibido",
        "msg": "Nome comercial de Paraquat (Proibido).",
        "base": "Lei 10.831"
    },
    "2,4-d": {
        "status": "proibido",
        "msg": "Herbicida sintético proibido.",
        "base": "Lei 10.831"
    },
    "fipronil": {
        "status": "proibido",
        "msg": "Inseticida sintético proibido em orgânicos.",
        "base": "IN 64/2008"
    },
    "metomil": {
        "status": "proibido",
        "msg": "Inseticida carbamato proibido.",
        "base": "IN 64/2008"
    },
    "carbofuran": {
        "status": "proibido",
        "msg": "Inseticida carbamato proibido.",
        "base": "IN 64/2008"
    },
    "malathion": {
        "status": "proibido",
        "msg": "Inseticida organofosforado proibido.",
        "base": "IN 64/2008"
    },
    "ddt": {
        "status": "proibido",
        "msg": "Inseticida proibido globalmente.",
        "base": "Lei 10.831"
    },
    
    # -------------------------------------------------------------------------
    # PROIBIDOS - Fertilizantes Sintéticos
    # -------------------------------------------------------------------------
    "npk": {
        "status": "proibido",
        "msg": "Fertilizantes minerais sintéticos de alta solubilidade são proibidos.",
        "base": "IN 64/2008"
    },
    "n-p-k": {
        "status": "proibido",
        "msg": "Fertilizantes minerais sintéticos são proibidos.",
        "base": "IN 64/2008"
    },
    "ureia": {
        "status": "proibido",
        "msg": "Fonte de nitrogênio sintético proibida.",
        "base": "IN 64/2008"
    },
    "uréia": {
        "status": "proibido",
        "msg": "Fonte de nitrogênio sintético proibida.",
        "base": "IN 64/2008"
    },
    "sulfato de amonio": {
        "status": "proibido",
        "msg": "Fertilizante nitrogenado sintético proibido.",
        "base": "IN 64/2008"
    },
    "sulfato de amônio": {
        "status": "proibido",
        "msg": "Fertilizante nitrogenado sintético proibido.",
        "base": "IN 64/2008"
    },
    "cloreto de potassio": {
        "status": "proibido",
        "msg": "KCl de alta solubilidade proibido. Use pó de rocha.",
        "base": "IN 64/2008"
    },
    "cloreto de potássio": {
        "status": "proibido",
        "msg": "KCl de alta solubilidade proibido. Use pó de rocha.",
        "base": "IN 64/2008"
    },
    "atrazina": {
        "status": "proibido",
        "msg": "Herbicida sintético proibido.",
        "base": "Lei 10.831"
    },
    "adubo quimico": {
        "status": "proibido",
        "msg": "Adubação química sintética não é permitida.",
        "base": "Lei 10.831"
    },
    "adubo químico": {
        "status": "proibido",
        "msg": "Adubação química sintética não é permitida.",
        "base": "Lei 10.831"
    },
    
    # -------------------------------------------------------------------------
    # CONDICIONAIS / ALERTAS - Uso permitido com restrições
    # -------------------------------------------------------------------------
    "enxofre": {
        "status": "atencao",
        "msg": "Permitido como fungicida/acaricida. Atenção: uso excessivo pode acidificar o solo.",
        "base": "IN 64/2008"
    },
    "calda bordalesa": {
        "status": "atencao",
        "msg": "Permitido. Monitorar acúmulo de Cobre no solo (máx. 6 kg Cu/ha/ano).",
        "base": "IN 64/2008"
    },
    "cobre": {
        "status": "atencao",
        "msg": "Permitido com limite de 6 kg de Cu/ha/ano. Monitorar acúmulo no solo.",
        "base": "IN 64/2008"
    },
    "calda sulfocalcica": {
        "status": "atencao",
        "msg": "Permitido para controle de pragas e doenças. Respeitar dosagem.",
        "base": "IN 64/2008"
    },
    "calda sulfocálcica": {
        "status": "atencao",
        "msg": "Permitido para controle de pragas e doenças. Respeitar dosagem.",
        "base": "IN 64/2008"
    },
    "oleo mineral": {
        "status": "atencao",
        "msg": "Permitido com restrições para controle de pragas.",
        "base": "IN 64/2008"
    },
    "óleo mineral": {
        "status": "atencao",
        "msg": "Permitido com restrições para controle de pragas.",
        "base": "IN 64/2008"
    },
    "neem": {
        "status": "atencao",
        "msg": "Permitido (extrato vegetal). Verifique se o produto comercial não possui aditivos sintéticos.",
        "base": "IN 46/2011"
    },
    "nim": {
        "status": "atencao",
        "msg": "Permitido (extrato vegetal). Verifique se o produto comercial não possui aditivos sintéticos.",
        "base": "IN 46/2011"
    },
    "oleo de neem": {
        "status": "atencao",
        "msg": "Permitido. Verificar formulação sem aditivos sintéticos.",
        "base": "IN 46/2011"
    },
    "óleo de neem": {
        "status": "atencao",
        "msg": "Permitido. Verificar formulação sem aditivos sintéticos.",
        "base": "IN 46/2011"
    },
    "pireto": {
        "status": "atencao",
        "msg": "Piretrina natural permitida com ressalvas. Evitar uso frequente.",
        "base": "IN 17/2014"
    },
    "rotenona": {
        "status": "atencao",
        "msg": "Permitido, porém em fase de restrição em alguns países.",
        "base": "IN 17/2014"
    },
    "esterco": {
        "status": "atencao",
        "msg": "Permitido. Deve estar bem curtido/compostado (mín. 60 dias antes da colheita).",
        "base": "IN 64/2008"
    },
    "cama de aviario": {
        "status": "atencao",
        "msg": "Permitido após compostagem adequada. Aplicar 60 dias antes da colheita.",
        "base": "IN 64/2008"
    },
    "cama de aviário": {
        "status": "atencao",
        "msg": "Permitido após compostagem adequada. Aplicar 60 dias antes da colheita.",
        "base": "IN 64/2008"
    },
    "calcario": {
        "status": "atencao",
        "msg": "Permitido para correção de solo (origem natural). Evitar calcário tratado quimicamente.",
        "base": "IN 64/2008"
    },
    "calcário": {
        "status": "atencao",
        "msg": "Permitido para correção de solo (origem natural). Evitar calcário tratado quimicamente.",
        "base": "IN 64/2008"
    },
    
    # -------------------------------------------------------------------------
    # PERMITIDOS - Reforço Positivo
    # -------------------------------------------------------------------------
    "composto": {
        "status": "permitido",
        "msg": "Prática recomendada para nutrição do solo.",
        "base": "Lei 10.831"
    },
    "composto organico": {
        "status": "permitido",
        "msg": "Excelente para fertilidade do solo. Base da agricultura orgânica.",
        "base": "Lei 10.831"
    },
    "composto orgânico": {
        "status": "permitido",
        "msg": "Excelente para fertilidade do solo. Base da agricultura orgânica.",
        "base": "Lei 10.831"
    },
    "bokashi": {
        "status": "permitido",
        "msg": "Excelente condicionador de solo permitido.",
        "base": "IN 64/2008"
    },
    "biofertilizante": {
        "status": "permitido",
        "msg": "Fermentado aeróbico/anaeróbico permitido. Produção própria recomendada.",
        "base": "IN 64/2008"
    },
    "extrato de alho": {
        "status": "permitido",
        "msg": "Fitossanitário natural de uso aprovado.",
        "base": "IN 17/2014"
    },
    "po de rocha": {
        "status": "permitido",
        "msg": "Fonte mineral natural permitida. Excelente para remineralização.",
        "base": "IN 64/2008"
    },
    "pó de rocha": {
        "status": "permitido",
        "msg": "Fonte mineral natural permitida. Excelente para remineralização.",
        "base": "IN 64/2008"
    },
    "adubo verde": {
        "status": "permitido",
        "msg": "Prática recomendada para cobertura e fixação de nitrogênio.",
        "base": "Lei 10.831"
    },
    "adubacao verde": {
        "status": "permitido",
        "msg": "Prática recomendada para cobertura e fixação de nitrogênio.",
        "base": "Lei 10.831"
    },
    "adubação verde": {
        "status": "permitido",
        "msg": "Prática recomendada para cobertura e fixação de nitrogênio.",
        "base": "Lei 10.831"
    },
}


# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

def get_input_rule(texto: str) -> Optional[Dict[str, str]]:
    """
    Search for an organic input rule within a text.
    
    Performs case-insensitive substring matching against known input terms.
    Returns the first matching rule found.
    
    Args:
        texto: Text to search (can be a product name or full message)
        
    Returns:
        Dict with status, msg, base keys if match found, None otherwise
        
    Example:
        >>> get_input_rule("apliquei glifosato no mato")
        {"status": "proibido", "msg": "Herbicida sintético...", "base": "Lei 10.831"}
    """
    if not texto:
        return None
    
    texto_lower = texto.lower().strip()
    
    # Check each rule key against the text
    for termo, regra in ORGANIC_INPUTS_RULES.items():
        if termo in texto_lower:
            return {
                "termo_encontrado": termo,
                **regra
            }
    
    return None


def validar_manejo(texto: str) -> ValidationResult:
    """
    Validate a farming operation or message against organic rules.
    
    Pure function - no side effects, no external calls.
    
    Args:
        texto: Text to validate (product name, message, or activity description)
        
    Returns:
        ValidationResult with valido, mensagem, nivel, base_legal
        
    Example:
        >>> result = validar_manejo("usei roundup no pasto")
        >>> result.valido
        False
        >>> result.nivel
        "erro"
    """
    regra = get_input_rule(texto)
    
    if regra is None:
        return ValidationResult(
            valido=True,
            mensagem="",
            nivel="info",
            base_legal=None
        )
    
    status = regra["status"]
    
    if status == "proibido":
        return ValidationResult(
            valido=False,
            mensagem=f"⛔ PROIBIDO: {regra['msg']}",
            nivel="erro",
            base_legal=regra.get("base")
        )
    elif status == "atencao":
        return ValidationResult(
            valido=True,
            mensagem=f"⚠️ ATENÇÃO: {regra['msg']}",
            nivel="alerta",
            base_legal=regra.get("base")
        )
    else:  # permitido
        return ValidationResult(
            valido=True,
            mensagem=f"✅ {regra['msg']}",
            nivel="info",
            base_legal=regra.get("base")
        )


def validar_manejo_com_detalhes(
    produto: str,
    tipo_atividade: str = "",
    quantidade: float = 0.0,
    unidade: str = ""
) -> ValidationResult:
    """
    Validate with additional context (quantity, activity type).
    
    Extended validation that considers quantity thresholds and activity context.
    
    Args:
        produto: Product/input name
        tipo_atividade: Type of activity (e.g., "Insumo", "Colheita")
        quantidade: Amount applied
        unidade: Unit of measurement
        
    Returns:
        ValidationResult with full validation details
    """
    # Base validation
    result = validar_manejo(produto)
    
    # If already blocked, return immediately
    if not result.valido:
        return result
    
    # Additional checks for Insumo activities
    alertas_extras = []
    
    if tipo_atividade == "Insumo":
        # Suspicious quantities check
        unidade_lower = str(unidade).lower()
        if quantidade > 1000 and unidade_lower in ['l', 'kg', 'litros', 'quilos']:
            alertas_extras.append(
                f"⚠️ Verificação: Quantidade ({quantidade} {unidade}) muito alta."
            )
    
    # Append extra alerts to message if any
    if alertas_extras:
        mensagem_completa = result.mensagem
        if mensagem_completa:
            mensagem_completa += " | " + " | ".join(alertas_extras)
        else:
            mensagem_completa = " | ".join(alertas_extras)
        
        return ValidationResult(
            valido=result.valido,
            mensagem=mensagem_completa,
            nivel="alerta" if result.nivel == "info" else result.nivel,
            base_legal=result.base_legal
        )
    
    return result


# =============================================================================
# LEGACY ADAPTER - Backward compatibility with existing code
# =============================================================================

def validar_regras_negocio(dados: dict) -> dict:
    """
    Legacy adapter for existing code (ai_processor.py, webhook.py).
    
    Converts new ValidationResult to old dict format.
    Maintains backward compatibility.
    
    Args:
        dados: Dict with keys: produto, quantidade_valor, quantidade_unidade, tipo_atividade
        
    Returns:
        Dict with status, mensagem, alertas (legacy format)
    """
    result = validar_manejo_com_detalhes(
        produto=dados.get("produto", ""),
        tipo_atividade=dados.get("tipo_atividade", ""),
        quantidade=dados.get("quantidade_valor", 0.0),
        unidade=dados.get("quantidade_unidade", "")
    )
    
    # Convert to legacy format
    if not result.valido:
        return {
            "status": "BLOQUEADO",
            "mensagem": result.mensagem,
            "alertas": []
        }
    elif result.nivel == "alerta":
        return {
            "status": "OK",
            "mensagem": "",
            "alertas": [result.mensagem] if result.mensagem else []
        }
    else:
        return {
            "status": "OK",
            "mensagem": "",
            "alertas": []
        }


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def is_produto_proibido(produto: str) -> bool:
    """
    Quick check if a product is prohibited.
    
    Args:
        produto: Product name to check
        
    Returns:
        True if product contains a prohibited substance
    """
    regra = get_input_rule(produto)
    return regra is not None and regra.get("status") == "proibido"


def is_produto_condicional(produto: str) -> bool:
    """
    Quick check if a product requires conditional use authorization.
    
    Args:
        produto: Product name to check
        
    Returns:
        True if product has usage restrictions/alerts
    """
    regra = get_input_rule(produto)
    return regra is not None and regra.get("status") == "atencao"


def listar_produtos_por_status(status: str) -> List[str]:
    """
    List all products with a given status.
    
    Args:
        status: One of "proibido", "atencao", "permitido"
        
    Returns:
        List of product terms matching the status
    """
    return [
        termo for termo, regra in ORGANIC_INPUTS_RULES.items()
        if regra.get("status") == status
    ]
