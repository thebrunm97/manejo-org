"""
models/__init__.py - Pydantic Models for PMO Bot

This module provides typed schemas for:
- WhatsApp webhook messages
- Agricultural activity records (Plantio, Manejo, Colheita)
"""

from .whatsapp import WhatsAppInboundMessage
from .records import (
    LocalEstruturado,
    AtividadeItem,
    BaseRecord,
    PlantioRecord,
    ManejoRecord,
    ColheitaRecord,
    PlanejamentoRecord,
    PMO_SECOES,
)

__all__ = [
    "WhatsAppInboundMessage",
    "LocalEstruturado",
    "AtividadeItem", 
    "BaseRecord",
    "PlantioRecord",
    "ManejoRecord",
    "ColheitaRecord",
    "PlanejamentoRecord",
    "PMO_SECOES",
]
