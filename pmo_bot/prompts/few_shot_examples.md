### EXEMPLOS DE MAPEAMENTO

**Exemplo 1 (Insumo):**
Usuário: "Vou comprar adubo de tal lugar"
JSON: { "intencao": "planejamento", "secao_pmo": 8, "tipo_atividade": "Insumo", "produto": "ADUBO", "observacoes": "Compra de tal lugar" }

**Exemplo 2 (Insumo Específico):**
Usuário: "Pretendo usar esterco de galinha"
JSON: { "intencao": "planejamento", "secao_pmo": 8, "tipo_atividade": "Manejo", "subtipo": "Aplicação de Insumos", "produto": "ESTERCO DE GALINHA" }

**Exemplo 3 (Aplicação Detalhada):**
Usuário: "Vou aplicar 5 litros de biofertilizante por metro quadrado em cobertura no tomate"
JSON:
{
  "intencao": "planejamento",
  "secao_pmo": 8,
  "tipo_atividade": "Manejo",
  "tipo_operacao": "Aplicação de Insumos",
  "atividades": [
    {
       "produto": "BIOFERTILIZANTE",
       "dose_valor": 5,
       "dose_unidade": "L/m²",
       "cultura": "TOMATE",
       "fase": "Cobertura"
    }
  ],
  "produto": "BIOFERTILIZANTE"
}

**Exemplo 4 (Planejamento Cultura):**
Usuário: "Meu plano é plantar mais alface"
JSON: { "intencao": "planejamento", "secao_pmo": 2, "tipo_atividade": "Plantio", "produto": "ALFACE" }

**Exemplo 5 (Fitossanidade):**
Usuário: "Quero usar calda bordalesa para doenças"
JSON: { "intencao": "planejamento", "secao_pmo": 10, "tipo_atividade": "Manejo", "produto": "CALDA BORDALESA", "alvo_praga_doenca": "doenças" }

**Exemplo 6 (Praga Específica):**
Usuário: "Pretendo aplicar óleo de neem contra pulgões"
JSON: { "intencao": "planejamento", "secao_pmo": 10, "tipo_atividade": "Manejo", "produto": "ÓLEO DE NEEM", "alvo_praga_doenca": "pulgões" }

**Exemplo 7 (Correção Seção 8 vs 9):**
Usuário: "Vou colocar calcário na cova"
JSON: { "intencao": "planejamento", "secao_pmo": 8, "tipo_atividade": "Manejo", "produto": "CALCÁRIO", "local": {"talhao": "NAO INFORMADO"} }
*Nota: Adubo na cova NÃO é propagação (Seção 9)*

**Exemplo 8 (Intenção de Dúvida):**
Usuário: "Posso usar esterco fresco?"
JSON: { "intencao": "duvida", "resposta_tecnica": "Não é recomendado usar esterco fresco em orgânicos devido ao risco de contaminação. Deve-se compostar primeiro." }

**Exemplo 9 (Planejamento Plantio - Seção 2 + Estimativa):**
Usuário: "Semana que vem pretendo plantar 500 mudas de Tomate Italiano no Talhão 2."
JSON:
{
  "intencao": "planejamento",
  "secao_pmo": 2,
  "nome_secao": "Produção Primária Vegetal",
  "tipo_atividade": "Plantio",
  "produto": "TOMATE ITALIANO",
  "quantidade_valor": 500,
  "quantidade_unidade": "mudas",
  "talhao_canteiro": "Talhão 2",
  "producao_anual": 1500,
  "unidade_producao": "kg",
  "observacoes": "Estimativa baseada em 3kg/planta para 500 mudas.",
  "fase": "Plantio"
}
