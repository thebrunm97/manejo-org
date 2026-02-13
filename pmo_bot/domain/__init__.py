"""
pmo_bot/domain - Agricultural Domain Module

Contains pure business logic and agronomic rules that are:
- Independent of infrastructure (WhatsApp, Supabase, etc.)
- Testable in isolation
- Based on Brazilian organic farming legislation (Lei 10.831, IN 64/2008, IN 46/2011)

Modules:
- manejo_rules: Validation rules for organic farming operations
"""

from .manejo_rules import (
    # New API
    ORGANIC_INPUTS_RULES,
    get_input_rule,
    validar_manejo,
    validar_manejo_com_detalhes,
    listar_produtos_por_status,
    
    # Utility functions
    is_produto_proibido,
    is_produto_condicional,
    
    # Legacy adapter (backward compatibility)
    validar_regras_negocio,
    
    # Data structures
    ValidationResult
)

__all__ = [
    # New API
    "ORGANIC_INPUTS_RULES",
    "get_input_rule",
    "validar_manejo",
    "validar_manejo_com_detalhes",
    "listar_produtos_por_status",
    
    # Utility functions
    "is_produto_proibido",
    "is_produto_condicional",
    
    # Legacy adapter
    "validar_regras_negocio",
    
    # Data structures
    "ValidationResult"
]
