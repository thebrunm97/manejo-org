"""
modules/business_rules.py
Validação semântica baseada na Legislação Orgânica Brasileira (Lei 10.831 e Portaria MAPA 52/2021).
"""

# LISTA PROIBIDOS: Sintéticos e proibidos comuns (MVP)
# Embora a legislação trabalhe com "Lista Positiva" (o que pode), para o bot é mais seguro
# bloquear explicitamente o que sabemos que é proibido e comum.
PRODUTOS_PROIBIDOS = [
    "GLIFOSATO", "ROUNDUP", "PARAQUAT", "2,4-D", 
    "FIPRONIL", "METOMIL", "CARBOFURAN", "ATRAZINA", 
    "GRAMOXONE", "DDT", "SULFATO DE AMÔNIO", "URÉIA",
    "N-P-K", "CLORETO DE POTÁSSIO", "MALATHION"
]

def validar_regras_negocio(dados: dict) -> dict:
    produto = str(dados.get("produto", "")).upper()
    qtd = dados.get("quantidade_valor", 0.0)
    unidade = str(dados.get("quantidade_unidade", "")).lower()
    tipo = dados.get("tipo_atividade", "")
    
    resultado = {
        "status": "OK",
        "mensagem": "",
        "alertas": [] 
    }

    # --- REGRA 1: Produtos Proibidos ---
    for proibido in PRODUTOS_PROIBIDOS:
        if proibido in produto:
            resultado["status"] = "BLOQUEADO"
            resultado["mensagem"] = f"⛔ REGISTRO RECUSADO: O produto '{produto}' contém substâncias proibidas (Lei 10.831). O uso de sintéticos pode cancelar sua certificação."
            return resultado

    # --- REGRA 2: Restrição de Cobre ---
    # Melhoria: verificar se é Insumo para não dar alerta em 'Colheita de Tomate' (se a IA errar)
    if tipo == "Insumo" and ("COBRE" in produto or "BORDALESA" in produto):
        resultado["alertas"].append("⚠️ Limite de Cobre: Máximo de 6 kg/ha/ano.")

    # --- REGRA 3: Uso de Esterco ---
    if tipo == "Insumo" and any(x in produto for x in ["ESTERCO", "CAMADE", "AVIÁRIO"]):
        resultado["alertas"].append("⚠️ Esterco: Deve ser compostado ou aplicado 60 dias antes da colheita.")

    # --- REGRA 4: Quantidades Absurdas (SECURITY: A06:2025) ---
    # Limites por tipo de atividade para prevenir inserção de dados impossíveis
    LIMITES = {
        "Insumo": {"max": 5000, "unidades": ['l', 'kg', 'litros', 'quilos', 'litro', 'quilo']},
        "Colheita": {"max": 50000, "unidades": ['kg', 'quilos', 'ton', 'toneladas', 't', 'caixas', 'sacas']},
        "Manejo": {"max": 10000, "unidades": ['l', 'kg', 'litros', 'quilos', 'unidade', 'unidades']},
        "Plantio": {"max": 100000, "unidades": ['mudas', 'sementes', 'kg', 'unidade', 'unidades']}
    }
    
    limite_config = LIMITES.get(tipo, {"max": 10000, "unidades": []})
    
    # BLOQUEIO DURO: valores extremamente implausíveis (10x o limite)
    if qtd > limite_config["max"] * 10:
        resultado["status"] = "BLOQUEADO"
        resultado["mensagem"] = (
            f"⛔ QUANTIDADE IMPOSSÍVEL: {qtd} {unidade} para {tipo}. "
            f"Verifique se a unidade está correta. "
            f"Se você colheu {qtd} toneladas, informe a unidade como 'ton'."
        )
        return resultado
    
    # ALERTA: valores altos mas possivelmente válidos
    if qtd > limite_config["max"] and unidade in limite_config["unidades"]:
        resultado["alertas"].append(
            f"⚠️ Quantidade alta: {qtd} {unidade}. Verifique se está correto."
        )
    
    # ALERTA ESPECIAL: Colheita por área absurda (ex: 1M kg em 1m²)
    if tipo == "Colheita" and qtd > 100000:
        resultado["alertas"].append(
            "⚠️ Produtividade implausível. Verifique a área e quantidade informadas."
        )

    return resultado