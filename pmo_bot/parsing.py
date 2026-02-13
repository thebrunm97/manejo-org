"""
parsing.py - Centralized parsing utilities for PMO Bot

Consolidates parsing functions previously scattered across:
- database_handlers.parse_float_br()
- migration_utils.normalizar_unidade()
- webhook.py regex for quantities

Author: PMO Bot Team
Updated: 2026-01-13
"""

import re
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional, Any


# ==============================================================================
# DATA STRUCTURES
# ==============================================================================

@dataclass
class ParsedQuantity:
    """Structured result from parsing a quantity string."""
    value: float
    unit: str
    raw: str


# ==============================================================================
# UNIT NORMALIZATION
# ==============================================================================

UNIT_MAP = {
    # Unidades
    "unidade": "unid", "unidades": "unid", "und": "unid", "un": "unid", "u": "unid",
    # Peso
    "quilo": "kg", "quilos": "kg", "kilogramas": "kg", "kilo": "kg", "kilos": "kg",
    "quilograma": "kg", "quilogramas": "kg",
    "grama": "g", "gramas": "g", "gr": "g",
    "tonelada": "ton", "toneladas": "ton", "t": "ton", "ton": "ton",
    # Volume
    "litro": "L", "litros": "L", "l": "L",
    "ml": "ml", "mililitros": "ml", "mililitro": "ml",
    "m3": "m³", "m³": "m³", "metro cúbico": "m³", "metros cúbicos": "m³",
    # Embalagens
    "caixa": "cx", "caixas": "cx",
    "maço": "maço", "macos": "maço", "maco": "maço", "maços": "maço",
    "saco": "sc", "sacos": "sc", "sc": "sc",
    "bag": "bag", "bags": "bag", "sacaria": "bag", "big bag": "bag",
    "bandeja": "bdj", "bandejas": "bdj",
    "cartela": "cart", "cartelas": "cart",
    # Área
    "m2": "m²", "metros quadrados": "m²", "metro quadrado": "m²",
    "ha": "ha", "hectare": "ha", "hectares": "ha",
    # Plantas e Covas
    "muda": "muda", "mudas": "muda",
    "pé": "pé", "pés": "pé", "pe": "pé", "pes": "pé",
    "semente": "sem", "sementes": "sem",
    "cova": "cova", "covas": "cova",
    # Compostas (Micro-dosagem)
    "g/m2": "g/m²", "g/m²": "g/m²", "gramas por metro quadrado": "g/m²", "g por m2": "g/m²",
    "ml/m2": "ml/m²", "ml/m²": "ml/m²", "ml por metro quadrado": "ml/m²",
    "l/m2": "L/m²", "l/m²": "L/m²", "litros por metro quadrado": "L/m²", "litro por metro quadrado": "L/m²", "l por m2": "L/m²",
    "m3/m2": "m³/m²", "m³/m²": "m³/m²",
    "g/planta": "g/planta",
    "ml/cova": "ml/cova",
    "ovos/m2": "unid/m²", "ovos/m²": "unid/m²",
}


def normalize_unit(unit: str) -> str:
    """
    Normalize common unit variations to standard format.
    
    Examples:
        "quilos" → "kg"
        "LITROS" → "L"
        "pés" → "pé"
        "unidade" → "unid"
    
    Args:
        unit: Raw unit string from user input or AI extraction
        
    Returns:
        Normalized unit string
    """
    if not unit:
        return "unid"
    
    clean = str(unit).lower().strip()
    return UNIT_MAP.get(clean, clean)


# ==============================================================================
# QUANTITY PARSING
# ==============================================================================

def parse_quantity(text: str) -> ParsedQuantity:
    """
    Parse a quantity string into structured data.
    
    Handles various Brazilian formats:
        - "10,5kg" → ParsedQuantity(value=10.5, unit="kg")
        - "100 litros" → ParsedQuantity(value=100.0, unit="L")
        - "2 g/m²" → ParsedQuantity(value=2.0, unit="g/m²")
        - "1.500,00" → ParsedQuantity(value=1500.0, unit="unid")
    
    Args:
        text: Raw quantity string
        
    Returns:
        ParsedQuantity with value, unit, and original raw string
    """
    if not text:
        return ParsedQuantity(value=0.0, unit="unid", raw="")
    
    raw = str(text).strip()
    
    # Remove currency symbols and common prefixes
    cleaned = re.sub(r'^R\$\s*', '', raw)
    
    # Extract numeric part (accepts comma or period as decimal)
    num_match = re.search(r'([\d.,]+)', cleaned)
    if num_match:
        num_str = num_match.group(1)
        
        # Handle Brazilian number format (1.500,50 → 1500.50)
        if ',' in num_str and '.' in num_str:
            num_str = num_str.replace('.', '').replace(',', '.')
        elif ',' in num_str:
            num_str = num_str.replace(',', '.')
        elif '.' in num_str:
            if re.match(r'^\d{1,3}(\.\d{3})+$', num_str):
                num_str = num_str.replace('.', '')
        
        try:
            value = float(num_str)
        except ValueError:
            value = 0.0
    else:
        value = 0.0
    
    # Extract unit: allow letters, digits (m2), slash (/), and special chars
    # Supports "g/m²", "ml/cova", "kg"
    unit_match = re.search(r'[a-zA-ZçãõáéíóúâêôÇÃÕÁÉÍÓÚÂÊÔ][a-zA-Z0-9çãõáéíóúâêôÇÃÕÁÉÍÓÚÂÊÔ²/%]*', cleaned)
    if unit_match:
        unit_raw = unit_match.group(0)
        unit = normalize_unit(unit_raw)
    else:
        unit = "unid"
    
    return ParsedQuantity(value=value, unit=unit, raw=raw)


def parse_float_br(valor: Any) -> float:
    """
    Safely parse a value to float, handling Brazilian format.
    
    This is a simplified version for backward compatibility.
    For full parsing use parse_quantity().
    
    Args:
        valor: Any value that should be converted to float
        
    Returns:
        Float value, or 0.0 if parsing fails
    """
    if valor is None:
        return 0.0
    
    if isinstance(valor, (int, float)):
        return float(valor)
    
    result = parse_quantity(str(valor))
    return result.value


# ==============================================================================
# DATE PARSING
# ==============================================================================

def parse_date_br(text: str) -> Optional[date]:
    """
    Parse Brazilian date formats to Python date.
    
    Accepted formats:
        - "15/01/2026" (BR format)
        - "15-01-2026" (BR with dashes)
        - "2026-01-15" (ISO format)
    
    Args:
        text: Date string in various formats
        
    Returns:
        date object or None if parsing fails
    """
    if not text:
        return None
    
    text = str(text).strip()
    
    # Try ISO format first (YYYY-MM-DD)
    if re.match(r'\d{4}-\d{2}-\d{2}', text):
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date()
        except ValueError:
            pass
    
    # Try Brazilian format (DD/MM/YYYY or DD-MM-YYYY)
    match = re.match(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})', text)
    if match:
        d, m, y = match.groups()
        try:
            return date(int(y), int(m), int(d))
        except ValueError:
            pass
    
    # Try Brazilian format with 2-digit year (DD/MM/YY)
    match = re.match(r'(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})$', text)
    if match:
        d, m, y = match.groups()
        try:
            year = 2000 + int(y) if int(y) < 50 else 1900 + int(y)
            return date(year, int(m), int(d))
        except ValueError:
            pass
    
    return None


# ==============================================================================
# STRING SANITIZATION
# ==============================================================================

def sanitize_string(valor: Any, max_length: int = 1000, default: str = "NÃO INFORMADO") -> str:
    """
    Sanitize a value to a safe string.
    
    Handles:
        - None → default value
        - Lists → joined with "; "
        - Long strings → truncated
        - Whitespace → stripped
    
    Args:
        valor: Any value to sanitize
        max_length: Maximum length of result
        default: Default value if None or empty
        
    Returns:
        Sanitized string
    """
    if valor is None:
        return default
    
    if isinstance(valor, list):
        parts = [str(item).strip() for item in valor if item]
        result = "; ".join(parts) if parts else default
    else:
        result = str(valor).strip()
    
    if not result:
        return default
    
    return result[:max_length]


def sanitize_talhao_canteiro(valor: Any) -> str:
    """
    Sanitize location field specifically.
    
    Backward-compatible wrapper around sanitize_string.
    """
    return sanitize_string(valor, max_length=1000, default="NÃO INFORMADO")


def escape_like_pattern(text: str) -> str:
    """
    Escape special LIKE/ILIKE characters to prevent SQL pattern injection.
    
    PostgreSQL LIKE uses:
        - % = wildcard (0+ chars)
        - _ = single char wildcard
        
    Without escaping, user input like "%" would return ALL records.
    
    Args:
        text: Raw text to be used in LIKE/ILIKE queries
        
    Returns:
        Escaped text safe for LIKE patterns
        
    Example:
        >>> escape_like_pattern("test%")
        'test\\%'
        >>> escape_like_pattern("item_1")
        'item\\_1'
    """
    if not text:
        return ""
    
    # Escape in order: backslash first, then special chars
    return (
        str(text)
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )


# ==============================================================================
# MAIN (for testing)
# ==============================================================================

if __name__ == "__main__":
    # Quick tests
    print("=== Testing parse_quantity ===")
    tests = ["10,5kg", "100 litros", "1.500,00", "", "50 mudas", "R$ 25,99"]
    for t in tests:
        r = parse_quantity(t)
        print(f"  '{t}' → value={r.value}, unit='{r.unit}'")
    
    print("\n=== Testing parse_date_br ===")
    dates = ["15/01/2026", "2026-01-15", "15-01-26", "lixo", ""]
    for d in dates:
        r = parse_date_br(d)
        print(f"  '{d}' → {r}")
    
    print("\n=== Testing normalize_unit ===")
    units = ["quilos", "LITROS", "pés", "m2", "hectare"]
    for u in units:
        print(f"  '{u}' → '{normalize_unit(u)}'")
