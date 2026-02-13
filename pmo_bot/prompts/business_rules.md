### REGRAS DE NEGÓCIO E MAPEAMENTO

**CRITÉRIOS DE DESEMPATE (ANTI-ALUCINAÇÃO):**
1. **Adubo na Cova ≠ Plantio**: Se o usuário disser "adubo na cova", "calcário na cova", "esterco por cova", isso é **INSUMO (Seção 8)** ou **FERTILIDADE**, NUNCA Propagação (Seção 9).
   - Seção 9 é EXCLUSIVA para: sementes, mudas, estacas, manivas.
   - Esterco, compostagem, calcário, torta de mamona -> Seção 8.

** MAPEAMENTO DE SEÇÕES PMO:**
1=Identificação/Histórico | 2=Produção Veg/Animal/Proc | 3=Prod. Convencional
4=Animais Serviço/Subsist. | 5=Prod. Terceirizada | 6=Ambiente (Água/Solo/Lixo)
7=Social/Trabalho | 8=Insumos/Equipamentos | 9=Propagação (9.1=Orgânico, 9.4=Paralelo)
10=Pragas/Doenças | 11=Colheita | 12=Pós-Colheita/Transporte
13=Manejo Animal (Bem-estar) | 14=Comercialização | 15=Rastreabilidade
16=SAC/Reclamações | 17=Opinião/Problemas | 18=Anexos/Fotos

**REGRAS ESPECÍFICAS POR SEÇÃO (Seção 8 e 10):**
- **CULTURA (Onde):** Se o usuário disser "no tomate", "na alface", "nas couves", extraia em `cultura`. Para Seção 8, isso preenche o campo "Onde".
- **FASE (Quando):** Extraia palavras-chave de momento da aplicação em `fase` ou `quando`: "no plantio", "em cobertura", "na amontoa", "no preparo", "fase inicial".
- **DOSE vs QUANTIDADE:**
  - `quantidade`: Total comprado/estoque (ex: "comprei 50kg").
  - `dose_valor` + `dose_unidade`: Taxa de aplicação (ex: "5kg/ha", "50g por pé", "2L por m²").
  - Se disser "aplicar X por Y", é DOSE. Preencha `dose_valor` e `dose_unidade` e deixe `quantidade` null.

### 1. CLASSIFICAÇÃO (ActivityType)
- 'Plantio': Semear, plantar, colocar mudas.
- 'Manejo': Cuidar (capina, poda, adubação, veneno, limpeza).
- 'Colheita': Retirar produção.
- 'Insumo': COMPRA/ESTOQUE de insumos (adubo, sementes, defensivos).
- 'Compra': Aquisição de bens ou serviços (NÃO exige local).
- 'Venda': Venda de produção (NÃO exige local).
- 'Outro': Resto.

### 2. DETECÇÃO DE ORIGEM (Campo 'origem')
Identifique a origem baseada no verbo do produtor:
- "Comprei", "Paguei", "Gastei", "Adquiri" -> origem: "Compra"
- "Vendi", "Entreguei", "Faturei", "Mandei" -> origem: "Venda / Saída"
- "Produzi", "Colhi para", "Fiz um lote", "Preparei" -> origem: "Produção Própria"
- "Ganhei", "Doaram", "Recebi de graça" -> origem: "Doação"

### 3. DETALHAMENTO DE MANEJO (Se atividade='Manejo')
Identifique o 'tipo_operacao' mais adequado:
- "Manejo Cultural": Capina, roçada, poda, desbrota, tutoramento.
- "Aplicação de Insumos": Adubação, pulverização, calda bordalesa, veneno.
- "Controle Biológico": Soltar insetos benéficos (crisopídeos, tricogramma).
- "Manutenção": Arrumar cercas, valas, estufas.
- "Higienização": Limpeza de equipamentos/caixas.

Identifique também:
- "equipamentos": LISTA de ferramentas usadas. Exemplos válidos:
  ["Trator", "Roçadeira", "Enxada", "Pulverizador Costal", "Tratorito", "Motocultivador", "Enxada Rotativa", "Tobata", "Microtrator", "Bomba Costal"]
- "responsavel": Nome da pessoa que executou.

### 4. UNIDADES (UnitType)
- Convencionais: 'kg', 'ton', 'cx', 'unid', 'muda', 'L', 'ml', 'ha', 'sc', 'bag', 'm³'.
- Orgânicas (Micro-dosagem): 
  - 'g/m²' ou 'ml/m²': se disser "por metro".
  - 'g/planta' ou 'ml/cova': se disser "por pé" ou "por cova".
  - 'cart': para cartela de ovos/insetos.
  - 'unid/m²': para ovos soltos por área.

### 5. MAPEAMENTO DE DESTINO (Campo 'destino')
Normalize as frases do produtor para categorias padrão:
- "merenda escolar", "escola", "prefeitura", "PNAE" -> "Mercado Interno"
- "feira", "feira do produtor" -> "Feira"
- "consumo próprio", "pra casa", "autoconsumo" -> "Consumo Próprio"
- "venda", "mercado", "supermercado", "cliente" -> "Venda Direta"

### 6. CAMPO OBSERVACOES (Qualitativo)
Coloque no campo "observacoes" tudo que for detalhe qualitativo que NÃO se encaixa em outros campos:
- "estava muito maduro", "chuva forte", "sol quente"
- "qualidade primeira", "segunda feira"
- "pro casamento do João"
- **FINALIDADE:** "para usar em...", "destinado a...", "vou aplicar no..."

### 7. DIFERENCIAÇÃO LOCAL vs FINALIDADE (CRÍTICO!)
**REGRA:** Para atividades de 'Compra', 'Venda', 'Insumo' ou 'Produção Própria':
- Se o usuário disser "para usar em X", "destinado a X", "para aplicar no X", "vou usar no X":
  - NÃO preencha `talhao_canteiro` com X.
  - Coloque no campo `observacoes` como "Finalidade: X".
- `talhao_canteiro` SÓ deve ser preenchido se a ação OCORREU no local mencionado:
  - "Produzi NO pátio" → talhao_canteiro = "pátio"
  - "Produzi PARA usar nos canteiros" → observacoes = "Finalidade: usar nos canteiros", talhao_canteiro = null

Indicadores de FINALIDADE (não é local real):
- "para", "pra", "destinado a", "vou usar em", "para aplicar no"

Indicadores de LOCAL REAL:
- "no", "na", "do", "da" (sem "para" antes)

### 8. REGRAS SEÇÃO 9 (SEMENTES/MUDAS)
- **REGRA SEÇÃO 9**: Se for semente/muda não orgânica, inclua alerta: "O uso de sementes não orgânicas requer justificativa e autorização."

### DESAMBIGUAÇÃO: SEÇÃO 2 vs SEÇÃO 9
- Se o usuário diz "Vou plantar [Cultura]", "Iniciar plantio de [Cultura]" -> Classifique como **SEÇÃO 2** (Produção Vegetal). O objetivo é registrar a nova safra.
- Se o usuário diz "Comprei sementes", "Fiz mudas", "Origem das mudas" -> Classifique como **SEÇÃO 9** (Propagação). O objetivo é rastrear o insumo.

### ESTIMATIVA DE PRODUTIVIDADE (Regra de Conversão Automática)
Sempre que o usuário informar quantidade de plantio (mudas/sementes) mas NÃO a produção esperada, CALCULE uma estimativa conservadora para o campo `producao_anual`:

**1. FOLHOSAS E TEMPEROS**
- **Alface / Chicória:** 1 muda = **1 unidade**.
- **Rúcula / Coentro / Salsinha:** 1 muda (tufo) = **0.5 maços** (Ex: 500 mudas = 250 maços).
- **Couve:** 1 muda = **1 maço** (ciclo inicial).

**2. FRUTOS (Por Planta)**
- **Tomate:** ~3.0 kg/planta.
- **Pimentão:** ~1.5 kg/planta.
- **Quiabo:** ~1.0 kg/planta.
- **Milho:** ~0.2 kg/espiga.

**3. RAÍZES (Se informado Área)**
- **Cenoura / Beterraba:** ~3.0 kg/m².

*OBS: Se calcular, use a unidade correta (kg, maços, unid) em `unidade_producao`.*

### CÁLCULO DE ÁREA SUGERIDA (Baseado em População de Plantas)
Se o usuário informar o número de plantas (ex: "Vou plantar 1000 pés") e não a área, ESTIME a `area_plantada` (em m²) usando a densidade média:

**1. QUIABO (Abelmoschus esculentus)**
- **Padrão / Tradicional:** Considere densidade de **2.5 plantas/m²** (Espaçamento ~1.0m x 0.4m).
  - *Cálculo:* `area_plantada = qtd_plantas / 2.5`
- **Adensado / Intensivo:** Se o usuário disser "adensado" ou "alta densidade", considere **6 plantas/m²** (Espaçamento ~0.8m x 0.2m).
  - *Cálculo:* `area_plantada = qtd_plantas / 6`
  
*Exemplo:* "3000 pés de quiabo" -> 3000 / 2.5 = **1200 m²**.
*Exemplo:* "5000 pés de quiabo adensado" -> 5000 / 6 = **833 m²**.

**IMPORTANTE:**
- Coloque o resultado do cálculo de área no campo `quantidade_valor` e defina `quantidade_unidade` como "m²".
- Mova a quantidade original de plantas para o campo `observacoes` (ex: "Baseado em 3000 pés").
