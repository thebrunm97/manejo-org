# Pesquisa: Insumos na Agricultura Orgânica (Brasil)

## 1. Base Legal Principal
* **Lei 10.831/2003:** Dispõe sobre a agricultura orgânica. Veda insumos sintéticos e OGMs salvo exceções.
* **IN MAPA nº 64/2008:** Regulamento técnico para sistemas orgânicos. Lista substâncias permitidas/proibidas.
* **IN MAPA nº 46/2011:** Atualiza critérios para insumos fitossanitários.
* **IN MAPA nº 17/2014:** Requisitos para registro de insumos orgânicos.

## 2. Tabela Conceitual de Insumos (Status Inicial)

| Nome Comum | Categoria | Base Legal | Motivo |
| :--- | :--- | :--- | :--- |
| **GLIFOSATO** | ⛔ PROIBIDO | Lei 10.831/2003 | Herbicida sintético não autorizado. |
| **GLYPHOSATE** | ⛔ PROIBIDO | Lei 10.831/2003 | Variação de nome. |
| **2,4-D** | ⛔ PROIBIDO | Lei 10.831/2003 | Herbicida sintético. |
| **NEONICOTINOIDES** | ⛔ PROIBIDO | IN 64/2008 | Inseticida sintético. |
| **SEMENTE OGM** | ⛔ PROIBIDO | Lei 10.831/2003 | Organismo Geneticamente Modificado. |
| **ADUBO NPK (Sintético)**| ⛔ PROIBIDO | IN 64/2008 | Fertilizante mineral de alta solubilidade/sintético. |
| **URÉIA** | ⛔ PROIBIDO | IN 64/2008 | Fertilizante nitrogenado sintético. |
| **ENXOFRE ELEMENTAR** | ⚠️ CONDICIONAL | IN 64/2008 | Permitido como fungicida/acaricida (uso restrito). |
| **CALDA BORDALESA** | ⚠️ CONDICIONAL | IN 64/2008 | Permitido, respeitando limites de Cobre. |
| **ÓLEO DE NEEM** | ⚠️ CONDICIONAL | IN 46/2011 | Permitido (extrato vegetal), verificar formulação sem aditivos sintéticos. |
| **CALCÁRIO** | ⚠️ CONDICIONAL | IN 64/2008 | Permitido para correção de solo (origem natural). |
| **COMPOSTO ORGÂNICO** | ✅ PERMITIDO | Lei 10.831/2003 | Base da fertilização orgânica. |
| **ESTERCO CURTIDO** | ✅ PERMITIDO | IN 64/2008 | Permitido após compostagem/curtição adequada. |
| **EXTRATO DE ALHO** | ✅ PERMITIDO | IN 17/2014 | Fitossanitário de uso aprovado. |
| **BIOFERTILIZANTE** | ✅ PERMITIDO | IN 64/2008 | Fermentado, produzido na propriedade. |

## 3. Estrutura de Dados (Python Dictionary Draft)

```python
ORGANIC_INPUTS_RULES = {
    # PROIBIDOS
    "glifosato": {"status": "proibido", "msg": "Herbicida sintético proibido em orgânicos."},
    "glyphosate": {"status": "proibido", "msg": "Herbicida sintético proibido em orgânicos."},
    "2,4-d": {"status": "proibido", "msg": "Herbicida sintético proibido."},
    "roundup": {"status": "proibido", "msg": "Nome comercial de Glifosato (Proibido)."},
    "npk": {"status": "proibido", "msg": "Fertilizantes minerais sintéticos são proibidos. Use compostos/pós de rocha."},
    "ureia": {"status": "proibido", "msg": "Fonte de nitrogênio sintético proibida."},
    
    # CONDICIONAIS
    "enxofre": {"status": "alerta", "msg": "Permitido. Atenção: uso excessivo pode acidificar o solo."},
    "calda bordalesa": {"status": "alerta", "msg": "Permitido. Monitorar acúmulo de Cobre no solo."},
    "neem": {"status": "alerta", "msg": "Permitido. Verifique se o produto comercial não tem aditivos sintéticos."},
    
    # PERMITIDOS
    "composto": {"status": "permitido", "msg": "Prática recomendada."},
    "esterco": {"status": "permitido", "msg": "Deve estar bem curtido/compostado."},
    "bokashi": {"status": "permitido", "msg": "Excelente condicionador de solo."},
}
```
