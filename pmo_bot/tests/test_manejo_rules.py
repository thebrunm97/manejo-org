
"""
Unit tests for manejor_rules.py
Validates compliance with Lei 10.831/2003 and organic farming regulations.
"""
import pytest
from pmo_bot.domain.manejo_rules import (
    validar_manejo,
    validar_manejo_com_detalhes,
    is_produto_proibido,
    is_produto_condicional,
    ORGANIC_INPUTS_RULES
)

# =============================================================================
# 1. Prohibited Products (Direct Blocking)
# =============================================================================
@pytest.mark.parametrize("produto", [
    "Glifosato",
    "Roundup",
    "PARAQUAT",
    "2,4-D",
    "Fipronil",
    "NPK",
    "Ureia",
    "Sulfato de Amonio",
    "DDT"
])
def test_produtos_proibidos_devem_bloquear(produto):
    """Verifica se produtos proibidos retornam status de erro."""
    resultado = validar_manejo(produto)
    assert resultado.valido is False
    assert resultado.nivel == "erro"
    assert "PROIBIDO" in resultado.mensagem
    assert is_produto_proibido(produto) is True

# =============================================================================
# 2. Conditional Products (Warnings)
# =============================================================================
@pytest.mark.parametrize("produto, expected_warning", [
    ("Calda Bordalesa", "Cobre"),
    ("Esterco", "60 dias antes da colheita"),
    ("Cama de Aviário", "60 dias antes da colheita"),
    ("Neem", "aditivos sintéticos")
])
def test_produtos_condicionais_devem_alertar(produto, expected_warning):
    """Verifica se produtos com restrição geram alertas mas não bloqueiam."""
    resultado = validar_manejo(produto)
    assert resultado.valido is True
    assert resultado.nivel == "alerta"
    assert expected_warning in resultado.mensagem
    assert is_produto_condicional(produto) is True

# ... (omitted) ...

# =============================================================================
# 5. Quantity Threshold Alerts (Suspicious Amounts)
# =============================================================================
@pytest.mark.parametrize("qtd, unidade, deve_alertar", [
    (100, "litros", False),
    (1500, "litros", True),  # > 1000 threshold
    (5000, "kg", True),      # > 1000 threshold
    (999, "kg", False)
])
def test_alerta_quantidade_suspeita(qtd, unidade, deve_alertar):
    """Verifica alerta para quantidades muito altas de insumos."""
    # Usar um produto neutro/desconhecido para garantir que o alerta venha da quantidade
    # e não da regra do produto
    resultado = validar_manejo_com_detalhes(
        produto="Água", 
        tipo_atividade="Insumo",
        quantidade=qtd,
        unidade=unidade
    )
    
    if deve_alertar:
        assert resultado.nivel == "alerta"
        assert "muito alta" in resultado.mensagem
    else:
        assert "muito alta" not in resultado.mensagem

# =============================================================================
# 6. Case Insensitivity
# =============================================================================
def test_case_insensitivity():
    """Verifica se a busca por regras ignora maiúsculas/minúsculas."""
    r1 = validar_manejo("GLIFOSATO")
    r2 = validar_manejo("glifosato")
    r3 = validar_manejo("GlIfOsAtO")
    
    assert r1.valido == r2.valido == r3.valido == False

# =============================================================================
# 7. Partial Match Injection
# =============================================================================
def test_partial_match_sentences():
    """Verifica se encontra produto proibido no meio de frases."""
    frase = "Hoje eu apliquei Roundup no mato do fundo"
    resultado = validar_manejo(frase)
    assert resultado.valido is False
    # A mensagem do Roundup menciona "Glifosato" e "Proibido", mas não necessariamente "Roundup"
    assert "Glifosato" in resultado.mensagem or "Proibido" in resultado.mensagem
