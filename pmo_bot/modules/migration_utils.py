"""
migration_utils.py - Utilities for migrating caderno_campo data to new format

This module contains functions for:
- Parsing unstructured location strings into structured objects
- Migrating legacy single-product records to atividades[]
- Migrating intermediate format (produto_principal + produtos_secundarios) to atividades[]
"""

import re
import os
import sys
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict

# Import centralized parsing utilities
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parsing import parse_float_br, normalize_unit as normalizar_unidade


# ==============================================================================
# DATACLASSES (Python equivalents of TypeScript interfaces)
# ==============================================================================

@dataclass
class LocalEstruturado:
    """Structured location object"""
    talhao: str
    talhao_id: Optional[int] = None
    canteiro: Optional[str] = None
    linha: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict, excluding None values"""
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class AtividadeItem:
    """Single activity item (one product at one location)"""
    produto: str
    quantidade: float
    unidade: str
    local: LocalEstruturado
    variedade: Optional[str] = None
    papel: Optional[str] = None  # 'principal', 'secundario', 'cobertura'
    estrato: Optional[str] = None  # For SAF: 'emergente', 'alto', 'medio', 'baixo'
    lote: Optional[str] = None
    origem: Optional[str] = None
    lote_semente: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict, excluding None values"""
        result = {k: v for k, v in asdict(self).items() if v is not None}
        if 'local' in result and isinstance(result['local'], dict):
            result['local'] = {k: v for k, v in result['local'].items() if v is not None}
        return result


# ==============================================================================
# PARSE LOCAL (String -> Structured)
# ==============================================================================

def parse_local(texto: str) -> Dict[str, Any]:
    """
    Converts a free-form location string into a structured object.
    
    Examples:
    - "talhão novo, canteiro 3" → {"talhao": "talhão novo", "canteiro": "3"}
    - "Horta 1 - linha 5" → {"talhao": "Horta 1", "linha": "5"}
    - "Pomar" → {"talhao": "Pomar"}
    - "" or None → {"talhao": "NÃO INFORMADO"}
    
    Args:
        texto: Free-form location string from user input
        
    Returns:
        Dict with structured location data
    """
    if not texto or not str(texto).strip():
        return {"talhao": "NÃO INFORMADO"}
    
    texto = str(texto).strip()
    
    # Define patterns and their extractors
    patterns = [
        # Pattern: "talhão X, canteiro Y" or "área X, canteiro Y"
        (
            r'^(.+?),\s*canteiro\s*(\d+|[a-zA-Z]+)\s*$',
            lambda m: {"talhao": m.group(1).strip(), "canteiro": m.group(2)}
        ),
        # Pattern: "área/talhão - linha N"
        (
            r'^(.+?)\s*[-–]\s*linha\s*(\d+)\s*$',
            lambda m: {"talhao": m.group(1).strip(), "linha": m.group(2)}
        ),
        # Pattern: "talhão X canteiro Y" (without comma)
        (
            r'^(.+?)\s+canteiro\s*(\d+|[a-zA-Z]+)\s*$',
            lambda m: {"talhao": m.group(1).strip(), "canteiro": m.group(2)}
        ),
        # Pattern: "canteiro N do talhão X"
        (
            r'^canteiro\s*(\d+|[a-zA-Z]+)\s+(?:do|da|no|na)\s+(.+)$',
            lambda m: {"talhao": m.group(2).strip(), "canteiro": m.group(1)}
        ),
        # Pattern: "talhão N" (just number extraction)
        (
            r'^talhão\s*(\d+)\s*$',
            lambda m: {"talhao": f"Talhão {m.group(1)}"}
        ),
    ]
    
    for pattern, extractor in patterns:
        match = re.match(pattern, texto, re.IGNORECASE)
        if match:
            return extractor(match)
    
    # Default: entire string goes to talhao
    return {"talhao": texto}


# ==============================================================================
# MIGRATION FUNCTIONS
# ==============================================================================

def migrar_legado_para_atividades(legado: Dict[str, Any]) -> Dict[str, Any]:
    """
    Migrates a legacy record (single product, string location) to the new format.
    
    Input (legacy format):
    {
        "produto": "ALFACE CRESPA",
        "quantidade_valor": 100,
        "quantidade_unidade": "muda",
        "talhao_canteiro": "talhão novo, canteiro 3"
    }
    
    Output (new format):
    {
        ...original fields...,
        "atividades": [{
            "produto": "ALFACE CRESPA",
            "quantidade": 100,
            "unidade": "muda",
            "local": {"talhao": "talhão novo", "canteiro": "3"},
            "papel": "principal"
        }],
        "sistema": "monocultura"
    }
    """
    produto = str(legado.get("produto", "")).upper().strip()
    quantidade = _parse_float(legado.get("quantidade_valor", 0))
    unidade = legado.get("quantidade_unidade") or "unid"
    local_str = legado.get("talhao_canteiro", "")
    
    atividade = AtividadeItem(
        produto=produto if produto else "NÃO INFORMADO",
        quantidade=quantidade,
        unidade=unidade,
        local=LocalEstruturado(**parse_local(local_str)),
        papel="principal"
    )
    
    resultado = {**legado}
    resultado["atividades"] = [atividade.to_dict()]
    resultado["sistema"] = "monocultura"
    
    return resultado


def migrar_intermediario_para_atividades(inter: Dict[str, Any]) -> Dict[str, Any]:
    """
    Migrates intermediate format (produto_principal + produtos_secundarios) to new format.
    
    Input (intermediate format):
    {
        "produto_principal": "ALFACE CRESPA",
        "produtos_secundarios": ["RÚCULA", "CEBOLINHA"],
        "quantidade_valor": 100,
        "talhao_canteiro": "talhão novo, canteiro 3"
    }
    
    Output (new format):
    {
        ...original fields...,
        "atividades": [
            {"produto": "ALFACE CRESPA", "quantidade": 100, "papel": "principal", ...},
            {"produto": "RÚCULA", "quantidade": 0, "papel": "secundario", ...},
            {"produto": "CEBOLINHA", "quantidade": 0, "papel": "secundario", ...}
        ],
        "sistema": "consorcio"
    }
    
    Note: Secondary products get quantity=0 as placeholder (to be filled manually or estimated)
    """
    local_str = inter.get("talhao_canteiro", "")
    local = parse_local(local_str)
    
    quantidade = _parse_float(inter.get("quantidade_valor", 0))
    unidade = inter.get("quantidade_unidade") or "unid"
    
    atividades = []
    
    # Primary product
    produto_principal = str(inter.get("produto_principal", "") or inter.get("produto", "")).upper().strip()
    if produto_principal:
        atividades.append(AtividadeItem(
            produto=produto_principal,
            quantidade=quantidade,
            unidade=unidade,
            local=LocalEstruturado(**local),
            papel="principal"
        ).to_dict())
    
    # Secondary products
    secundarios = inter.get("produtos_secundarios") or []
    if isinstance(secundarios, str):
        secundarios = [secundarios]
    
    for prod in secundarios:
        prod_upper = str(prod).upper().strip()
        if prod_upper:
            atividades.append(AtividadeItem(
                produto=prod_upper,
                quantidade=0,  # Placeholder - to be filled manually
                unidade=unidade,
                local=LocalEstruturado(**local),
                papel="secundario"
            ).to_dict())
    
    resultado = {**inter}
    resultado["atividades"] = atividades if atividades else [{
        "produto": "NÃO INFORMADO",
        "quantidade": 0,
        "unidade": "unid",
        "local": local,
        "papel": "principal"
    }]
    resultado["sistema"] = "consorcio" if len(atividades) > 1 else "monocultura"
    
    # Also set the legacy "produto" field to the principal for compatibility
    if produto_principal:
        resultado["produto"] = produto_principal
    
    return resultado


def detectar_e_migrar(registro: Dict[str, Any]) -> Dict[str, Any]:
    """
    Detects the format of a record and migrates it appropriately.
    
    Returns:
        New record with atividades[] populated, or original if already migrated
    """
    # Already has atividades - no migration needed
    if registro.get("atividades") and isinstance(registro["atividades"], list):
        if len(registro["atividades"]) > 0:
            return registro
    
    # Intermediate format (produto_principal + produtos_secundarios)
    if registro.get("produto_principal") or registro.get("produtos_secundarios"):
        return migrar_intermediario_para_atividades(registro)
    
    # Legacy format (single produto)
    if registro.get("produto"):
        return migrar_legado_para_atividades(registro)
    
    # Unknown format - return as-is with empty atividades
    resultado = {**registro}
    resultado["atividades"] = []
    return resultado


# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================

# _parse_float is now using parse_float_br from parsing.py
def _parse_float(valor: Any) -> float:
    """Wrapper for backward compatibility - uses centralized parsing.py"""
    return parse_float_br(valor)


# normalizar_unidade is now imported from parsing.py as normalize_unit


# ==============================================================================
# VALIDATION
# ==============================================================================

def validar_atividades(atividades: List[Dict]) -> List[str]:
    """
    Validates the atividades array and returns a list of errors.
    
    Returns:
        List of error messages (empty if valid)
    """
    erros = []
    
    if not atividades:
        erros.append("Pelo menos uma atividade é obrigatória")
        return erros
    
    for i, atv in enumerate(atividades):
        prefix = f"Atividade {i+1}"
        
        if not atv.get("produto"):
            erros.append(f"{prefix}: Produto é obrigatório")
        
        qtd = atv.get("quantidade")
        if qtd is None or (isinstance(qtd, (int, float)) and qtd <= 0):
            erros.append(f"{prefix}: Quantidade deve ser maior que zero")
        
        if not atv.get("unidade"):
            erros.append(f"{prefix}: Unidade é obrigatória")
        
        local = atv.get("local", {})
        if not local.get("talhao"):
            erros.append(f"{prefix}: Talhão é obrigatório no local")
    
    return erros


# ==============================================================================
# TESTS (run with: python -m modules.migration_utils)
# ==============================================================================

if __name__ == "__main__":
    print("=== Testes de parse_local ===")
    
    testes_local = [
        ("talhão novo, canteiro 3", {"talhao": "talhão novo", "canteiro": "3"}),
        ("Horta 1 - linha 5", {"talhao": "Horta 1", "linha": "5"}),
        ("Pomar", {"talhao": "Pomar"}),
        ("", {"talhao": "NÃO INFORMADO"}),
        ("talhão 1 canteiro A", {"talhao": "talhão 1", "canteiro": "A"}),
        ("canteiro 5 da Horta", {"talhao": "Horta", "canteiro": "5"}),
    ]
    
    for entrada, esperado in testes_local:
        resultado = parse_local(entrada)
        status = "✅" if resultado == esperado else "❌"
        print(f"{status} parse_local('{entrada}')")
        if resultado != esperado:
            print(f"   Esperado: {esperado}")
            print(f"   Obtido:   {resultado}")
    
    print("\n=== Testes de migração legado ===")
    
    legado = {
        "produto": "ALFACE CRESPA",
        "quantidade_valor": 100,
        "quantidade_unidade": "muda",
        "talhao_canteiro": "talhão novo, canteiro 3"
    }
    
    migrado = migrar_legado_para_atividades(legado)
    print(f"Legado migrado: {migrado.get('atividades')}")
    print(f"Sistema: {migrado.get('sistema')}")
    
    print("\n=== Testes de migração intermediário ===")
    
    inter = {
        "produto_principal": "ALFACE CRESPA",
        "produtos_secundarios": ["RÚCULA", "CEBOLINHA"],
        "quantidade_valor": 100,
        "talhao_canteiro": "talhão novo, canteiro 3"
    }
    
    migrado_inter = migrar_intermediario_para_atividades(inter)
    print(f"Intermediário migrado: {len(migrado_inter.get('atividades', []))} atividades")
    print(f"Sistema: {migrado_inter.get('sistema')}")
    for atv in migrado_inter.get('atividades', []):
        print(f"  - {atv['produto']}: {atv['quantidade']} {atv.get('unidade')} ({atv.get('papel')})")
    
    print("\n✅ Testes concluídos!")
