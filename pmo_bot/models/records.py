"""
models/records.py - Agricultural Activity Record Models

Pydantic schemas for field notebook (caderno de campo) records.
Supports multi-product activities (consórcio, SAF) with backward compatibility
for legacy single-product format.
"""

from __future__ import annotations
from pydantic import BaseModel, Field, field_validator, computed_field
from typing import Optional, List, Dict, Any, Literal
from datetime import date, datetime
import sys
import os
import uuid
import pytz

# Import parsing utilities
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from parsing import normalize_unit, parse_date_br, parse_float_br


# ==============================================================================
# LOT CODE GENERATOR
# ==============================================================================

def gerar_codigo_lote(data_registro: date = None) -> str:
    """
    Generate a unique lot code following frontend pattern.
    
    Format: LOTE-YYYYMMDD-XXXX where XXXX is a short UUID suffix.
    
    Args:
        data_registro: Date of the harvest (defaults to today in Brazil TZ)
    
    Returns:
        str: Lot code like "LOTE-20260123-A1B2"
    """
    if data_registro is None:
        fuso = pytz.timezone('America/Sao_Paulo')
        data_registro = datetime.now(fuso).date()
    
    date_str = data_registro.strftime('%Y%m%d')
    suffix = uuid.uuid4().hex[:4].upper()
    return f"LOTE-{date_str}-{suffix}"


# ==============================================================================
# LOCATION MODEL
# ==============================================================================

class LocalEstruturado(BaseModel):
    """
    Structured location within the farm.
    
    Represents a talhão (plot) with optional canteiro (bed) and linha (row).
    """
    talhao: str = Field(default="NÃO INFORMADO", description="Plot/area name")
    talhao_id: Optional[int] = Field(default=None, description="FK to talhoes table")
    canteiro: Optional[str] = Field(default=None, description="Bed number/name")
    linha: Optional[str] = Field(default=None, description="Row number")
    
    model_config = {"extra": "ignore"}
    
    @field_validator("talhao", mode="before")
    @classmethod
    def default_talhao(cls, v: Any) -> str:
        """Convert None/null to default string."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return "NÃO INFORMADO"
        return str(v).strip()


# ==============================================================================
# ACTIVITY ITEM MODEL
# ==============================================================================

class AtividadeItem(BaseModel):
    """
    Single activity item (one product at one location).
    
    Used within atividades[] array in records.
    Supports multi-crop records (consórcio, SAF).
    """
    produto: str = Field(description="Product name (UPPERCASE)")
    quantidade: float = Field(default=0.0, ge=0, description="Quantity value")
    unidade: str = Field(default="unid", description="Unit (kg, L, muda, etc.)")
    local: LocalEstruturado = Field(default_factory=LocalEstruturado)
    
    # Role in multi-crop system
    papel: Literal["principal", "secundario", "cobertura"] = Field(
        default="principal",
        description="Role in consortium/SAF system"
    )
    
    # Optional metadata
    variedade: Optional[str] = Field(default=None, description="Variety/cultivar")
    estrato: Optional[str] = Field(default=None, description="SAF stratum")
    lote: Optional[str] = Field(default=None, description="Batch/lot number")
    origem: Optional[str] = Field(default=None, description="Origin/source")
    lote_semente: Optional[str] = Field(default=None, description="Seed lot")
    
    # New fields for detailed extraction (Section 8/10 fixes)
    dose_valor: Optional[float] = Field(default=None, description="Dosage value")
    dose_unidade: Optional[str] = Field(default=None, description="Dosage unit")
    cultura: Optional[str] = Field(default=None, description="Target crop")
    fase: Optional[str] = Field(default=None, description="Crop stage/phase")
    
    model_config = {"extra": "ignore"}
    
    @field_validator("produto", mode="before")
    @classmethod
    def uppercase_produto(cls, v: Any) -> str:
        """Ensure product name is uppercase."""
        if not v:
            return "NÃO INFORMADO"
        return str(v).upper().strip()
    
    @field_validator("unidade", mode="before")
    @classmethod
    def normalize_unidade(cls, v: Any) -> str:
        """Normalize unit using central parsing module."""
        return normalize_unit(str(v) if v else "unid")
    
    @field_validator("quantidade", mode="before")
    @classmethod
    def parse_quantidade(cls, v: Any) -> float:
        """Parse quantity using central parsing module."""
        return parse_float_br(v)
    
    # Legacy property for backward compatibility
    @computed_field
    @property
    def quantidade_valor(self) -> float:
        """Alias for 'quantidade' (legacy compatibility)."""
        return self.quantidade


# ==============================================================================
# BASE RECORD MODEL
# ==============================================================================

class BaseRecord(BaseModel):
    """
    Base model for all activity records.
    
    Contains common fields shared by Plantio, Manejo, and Colheita.
    """
    data_registro: date = Field(description="Activity date (ISO format)")
    tipo_atividade: str = Field(default="Outro", description="Activity type")
    talhao_canteiro: str = Field(default="NÃO INFORMADO", description="Legacy location field")
    observacao_original: str = Field(default="", description="Original user input")
    
    # Financial/Origin fields
    origem: Optional[str] = Field(default=None, description="Origin: Compra, Venda / Saída, Produção Própria, Doação")
    valor_total: Optional[float] = Field(default=None, description="Total value in R$")
    
    # Multi-crop support
    atividades: List[AtividadeItem] = Field(default_factory=list)
    sistema: Literal["monocultura", "consorcio", "saf"] = Field(
        default="monocultura",
        description="Cropping system"
    )
    
    # Optional metadata
    detalhes_tecnicos: Dict[str, Any] = Field(default_factory=dict)
    
    model_config = {"extra": "ignore"}
    
    @field_validator("valor_total", mode="before")
    @classmethod
    def parse_valor_total(cls, v: Any) -> Optional[float]:
        """Parse monetary value."""
        if v is None:
            return None
        return parse_float_br(v)
    
    @field_validator("talhao_canteiro", mode="before")
    @classmethod
    def default_talhao_canteiro(cls, v: Any) -> str:
        """Convert None/null to default string."""
        if v is None or (isinstance(v, str) and not v.strip()):
            return "NÃO INFORMADO"
        return str(v).strip()
    
    @field_validator("data_registro", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        """Parse date from various formats."""
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            parsed = parse_date_br(v)
            if parsed:
                return parsed
        raise ValueError(f"Invalid date format: {v}")
    
    # Legacy properties for backward compatibility
    @computed_field
    @property
    def produto(self) -> str:
        """Main product name (legacy compatibility)."""
        if self.atividades:
            return self.atividades[0].produto
        return "NÃO INFORMADO"
    
    @computed_field
    @property
    def quantidade_valor(self) -> float:
        """Main product quantity (legacy compatibility)."""
        if self.atividades:
            return self.atividades[0].quantidade
        return 0.0
    
    @computed_field
    @property
    def quantidade_unidade(self) -> str:
        """Main product unit (legacy compatibility)."""
        if self.atividades:
            return self.atividades[0].unidade
        return "unid"


# ==============================================================================
# SPECIFIC RECORD TYPES
# ==============================================================================

class PlantioRecord(BaseRecord):
    """
    Planting activity record.
    
    Example:
        "Plantei 50 mudas de alface no talhão 1, canteiro 3"
        "Plantei 100 mudas, perdi 5 por causa da chuva"
    """
    tipo_atividade: Literal["Plantio"] = Field(default="Plantio")
    
    # Plantio-specific fields
    lote_semente: Optional[str] = Field(default=None, description="Seed lot number")
    espacamento: Optional[str] = Field(default=None, description="Spacing info")
    
    # Discard/Loss fields (Frontend V2 compatibility)
    houve_descartes: bool = Field(default=False, description="Whether there were discards/losses")
    qtd_descartes: Optional[float] = Field(default=None, description="Discard quantity")
    unidade_descartes: Optional[str] = Field(default=None, description="Discard unit")
    
    @field_validator("qtd_descartes", mode="before")
    @classmethod
    def parse_qtd_descartes(cls, v: Any) -> Optional[float]:
        """Parse discard quantity using central parsing module."""
        if v is None:
            return None
        return parse_float_br(v)
    
    @field_validator("unidade_descartes", mode="before")
    @classmethod
    def normalize_unidade_descartes(cls, v: Any) -> Optional[str]:
        """Normalize discard unit using central parsing module."""
        if v is None:
            return None
        return normalize_unit(str(v))



class ManejoRecord(BaseRecord):
    """
    Management activity record.
    
    Subtypes:
    - MANEJO_CULTURAL: Weeding, pruning, mowing
    - APLICACAO_INSUMO: Fertilization, spraying
    - HIGIENIZACAO: Equipment cleaning
    """
    tipo_atividade: Literal["Manejo"] = Field(default="Manejo")
    
    # Subtype-specific fields
    subtipo: Literal["MANEJO_CULTURAL", "APLICACAO_INSUMO", "HIGIENIZACAO"] = Field(
        default="MANEJO_CULTURAL",
        description="Manejo subtype"
    )
    
    # Relational Fields (New - Organic Management)
    tipo_operacao: Optional[str] = Field(default=None, description="Detailed operation type")
    responsavel: Optional[str] = Field(default=None, description="Person responsible")
    equipamentos: Optional[List[str]] = Field(default_factory=list, description="List of equipment used")
    
    # Legacy/Details fields
    insumo: Optional[str] = Field(default=None, description="Input product name")
    dosagem: Optional[float] = Field(default=None, description="Dosage amount")
    item_higienizado: Optional[str] = Field(default=None, description="Cleaned equipment")

    @field_validator("dosagem", mode="before")
    @classmethod
    def parse_dosagem(cls, v: Any) -> Optional[float]:
        """Parse dosage using central parsing module."""
        if v is None:
            return None
        return parse_float_br(v)
        
    @field_validator("equipamentos", mode="before")
    @classmethod
    def normalize_equipamentos(cls, v: Any) -> List[str]:
        """Ensure equipamentos is always a list of strings."""
        if v is None:
            return []
        if isinstance(v, str):
            # Split by comma if accidental string
            parts = [s.strip() for s in v.split(",") if s.strip()]
            return parts
        if isinstance(v, list):
            return [str(x) for x in v if x]
        return []


class ColheitaRecord(BaseRecord):
    """
    Harvest activity record.
    
    Example:
        "Colhi 20kg de tomate do talhão 2"
        "Colhi 50kg mas teve 5kg de perda"
    """
    tipo_atividade: Literal["Colheita"] = Field(default="Colheita")
    
    # Colheita-specific relational fields
    destino: Optional[str] = Field(default=None, description="Destination (market, self, etc)")
    classificacao: Optional[str] = Field(default=None, description="Quality grade")
    lote: Optional[str] = Field(default=None, description="Batch/Lot code")
    
    # Discard/Loss fields (Frontend V2 compatibility)
    houve_descartes: bool = Field(default=False, description="Whether there were discards/losses")
    qtd_descartes: Optional[float] = Field(default=None, description="Discard quantity")
    unidade_descartes: Optional[str] = Field(default=None, description="Discard unit")
    
    def __init__(self, **data):
        """Auto-generate lote using data_registro if not provided."""
        super().__init__(**data)
        # After Pydantic sets all fields, generate lote if empty
        if not self.lote or not self.lote.strip():
            object.__setattr__(self, 'lote', gerar_codigo_lote(self.data_registro))

    
    @field_validator("qtd_descartes", mode="before")
    @classmethod
    def parse_qtd_descartes(cls, v: Any) -> Optional[float]:
        """Parse discard quantity using central parsing module."""
        if v is None:
            return None
        return parse_float_br(v)
    
    @field_validator("unidade_descartes", mode="before")
    @classmethod
    def normalize_unidade_descartes(cls, v: Any) -> Optional[str]:
        """Normalize discard unit using central parsing module."""
        if v is None:
            return None
        return normalize_unit(str(v))


# ==============================================================================
# PLANNING INTENTION MODEL (PMO Conversacional - Fase 2)
# ==============================================================================

# PMO Section names for display
PMO_SECOES = {
    1: "Identificação e História da Propriedade",
    2: "Produção Orgânica e Processamento",
    3: "Produção Não Orgânica (Convencional)",
    4: "Animais de Serviço e Subsistência",
    5: "Produção Terceirizada",
    6: "Aspectos Ambientais",
    7: "Aspectos Sociais",
    8: "Insumos e Equipamentos",
    9: "Propagação Vegetal",
    10: "Manejo Fitossanitário",
    11: "Colheita",
    12: "Pós-Colheita e Transporte",
    13: "Manejo Animal",
    14: "Comercialização",
    15: "Rastreabilidade",
    16: "SAC - Atendimento ao Consumidor",
    17: "Opinião do Produtor",
    18: "Anexos",
}


class PlanejamentoRecord(BaseModel):
    """
    Planning intention record (not executed yet).
    
    Stores suggestions for changes to the Organic Management Plan (PMO).
    These are NOT field notebook entries but future intentions.
    
    Example:
        "Vou usar esterco de galinha como adubo principal este ano"
        → secao_pmo=11, produto="ESTERCO DE GALINHA"
    """
    intencao: Literal["planejamento"] = Field(default="planejamento")
    secao_pmo: int = Field(ge=1, le=18, description="PMO section number (1-18)")
    descricao: str = Field(default="", description="Original user text/intention")
    data_registro: date = Field(description="Date of the suggestion")
    
    # Optional context extracted from the message
    produto: Optional[str] = Field(default=None, description="Product mentioned")
    quantidade: Optional[float] = Field(default=None, description="Quantity if mentioned")
    unidade: Optional[str] = Field(default=None, description="Unit if mentioned")
    observacoes: Optional[str] = Field(default=None, description="Additional notes")
    
    # Educational Compliance Alert (Lei 10.831)
    alerta_conformidade: Optional[str] = Field(
        default=None,
        description="Educational warning if intention violates organic rules"
    )
    
    # Production Estimation Fields (Section 2)
    area_plantada: Optional[float] = Field(default=None, description="Calculated planted area")
    unidade_area: Optional[str] = Field(default=None, description="Unit for area (m², ha)")
    producao_anual: Optional[float] = Field(default=None, description="Estimated annual production")
    unidade_producao: Optional[str] = Field(default=None, description="Unit for production (kg, ton)")
    
    # Section 10 Specific Fields (Fitossanidade)
    dose_valor: Optional[float] = Field(default=None, description="Dosage value")
    dose_unidade: Optional[str] = Field(default=None, description="Dosage unit (ml/litro, %)")
    alvo_praga_doenca: Optional[str] = Field(default=None, description="Target pest/disease")
    cultura: Optional[str] = Field(default=None, description="Target crop")
    procedencia: Optional[str] = Field(default=None, description="Internal or External origin")
    
    # New fields to prevent data loss (Section 8 fixes)
    atividades: List[AtividadeItem] = Field(default_factory=list, description="Planned activities list")
    fase: Optional[str] = Field(default=None, description="Crop stage/phase (e.g. Cobertura)")

    model_config = {"extra": "ignore"}
    
    @field_validator("secao_pmo", mode="before")
    @classmethod
    def validate_secao(cls, v: Any) -> int:
        """Ensure secao_pmo is valid (1-18)."""
        if v is None:
            return 8  # Default to Insumos section
        val = int(v)
        if val < 1:
            return 1
        if val > 18:
            return 18
        return val
    
    @field_validator("produto", mode="before")
    @classmethod
    def uppercase_produto(cls, v: Any) -> Optional[str]:
        """Ensure product name is uppercase."""
        if not v:
            return None
        return str(v).upper().strip()
    
    @field_validator("data_registro", mode="before")
    @classmethod
    def parse_date(cls, v: Any) -> date:
        """Parse date from various formats."""
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            parsed = parse_date_br(v)
            if parsed:
                return parsed
        # Default to today
        fuso = pytz.timezone('America/Sao_Paulo')
        return datetime.now(fuso).date()
    
    @property
    def nome_secao(self) -> str:
        """Get human-readable section name."""
        return PMO_SECOES.get(self.secao_pmo, f"Seção {self.secao_pmo}")


# ==============================================================================
# FACTORY FUNCTION
# ==============================================================================

def create_record_from_dict(data: Dict[str, Any]) -> BaseRecord:
    """
    Factory function to create appropriate record type from dict.
    
    Automatically detects tipo_atividade and returns the correct model.
    Falls back to BaseRecord if type is unknown.
    """
    tipo = str(data.get("tipo_atividade", "")).capitalize()
    
    record_types = {
        "Plantio": PlantioRecord,
        "Manejo": ManejoRecord,
        "Colheita": ColheitaRecord,
    }
    
    record_class = record_types.get(tipo, BaseRecord)
    return record_class.model_validate(data)
