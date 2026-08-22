# Levantamento de Ferramentas de Mutação (Fase 2 - Agentic Loop)

> **Data:** 16 de Agosto de 2026  
> **Escopo:** Catálogo de Ferramentas MCP, Schema Supabase, Validações de Domínio e Fluxo HITL (Human-in-the-Loop)

---

## 1. Inventário das Ferramentas Atuais do Agentic Loop

Todas as ferramentas atualmente registradas no servidor MCP (`internal/mcp/tools_registry.go`), roteador e parser (`internal/llm/tools_parser.go`):

| # | Ferramenta | Categoria MCP | Tipo Operação | Destino / RPC / Tabela |
|---|---|---|---|---|
| 1 | `RegistrarLoteOperacoes` | `CategoryDBWrite` | **Escrita** | `agriRepo.RegistrarLoteOperacoes` → `caderno_campo` (Loop de mutações) |
| 2 | `RegistrarPlantio` | `CategoryDBWrite` | **Escrita** | `rpc_registrar_operacao_campo` → `caderno_campo` |
| 3 | `registrar_colheita` | `CategoryDBWrite` | **Escrita** | `rpc_registrar_operacao_campo` → `caderno_campo` (Gera Lote) |
| 4 | `registrar_limpeza` | `CategoryDBWrite` | **Escrita** | `rpc_registrar_operacao_campo` → `caderno_campo` |
| 5 | `registrar_propagacao_vegetal` | `CategoryDBWrite` | **Escrita** | `rpc_registrar_operacao_campo` → `caderno_campo` |
| 6 | `registrar_compostagem` | `CategoryDBWrite` | **Escrita** | `rpc_registrar_operacao_campo` → `caderno_campo` |
| 7 | `registrar_compra_insumo` | `CategoryDBWrite` | **Escrita** | `rpc_registrar_compra_insumo` → `pmo_insumos` + `caderno_campo` |
| 8 | `adicionar_insumo_pmo` | `CategoryDBWrite` | **Escrita** | `pmo_insumos` (Seção 8 do PMO) |
| 9 | `registrar_despesa` | `CategoryDBWrite` | **Escrita** | `rpc_registrar_transacao_com_rateio` → `transacoes_financeiras` |
| 10 | `criar_talhao` | `CategoryDBWrite` | **Escrita** | `talhoes` |
| 11 | `criar_canteiros` | `CategoryDBWrite` | **Escrita** | `canteiros` (Lote) |
| 12 | `criar_infraestrutura_fazenda` | `CategoryDBWrite` | **Escrita** | `talhoes` + `canteiros` (`CriarInfraestruturaCompleta`) |
| 13 | `SalvarMemoriaProdutor` | `CategoryDBWrite` | **Escrita** | `user_memories` (Vetor de memória de longo prazo) |
| 14 | `selecionar_fazenda` | `CategoryDBWrite` | **Escrita / Sessão** | `profiles.propriedade_ativa_id` + `profiles.pmo_ativo_id` |
| 15 | `selecionar_pmo` | `CategoryDBWrite` | **Escrita / Sessão** | `profiles.pmo_ativo_id` |
| 16 | `calcular_recomendacao_adubacao` | `CategoryDBWrite`* | **Leitura / Cálculo** | `rpc/calcular_balanco_nutricional` (Cálculo puro NPK) |
| 17 | `consultar_base_conhecimento` | `CategoryRAG` | **Leitura** | `farm_documents` (Busca vetorial 1024d BGE-M3) |
| 18 | `ConsultarLeiOrganica_RAG` | `CategoryRAG` | **Leitura** | `farm_documents` (Base institucional MAPA/Lei 10.831) |
| 19 | `consultar_dados_fazenda` | `CategoryRAG` | **Leitura** | `talhoes`, `canteiros`, `caderno_campo` (Últimas 10) |
| 20 | `consultar_demandas_cooperativa` | `CategoryDBWrite`* | **Leitura** | `demandas_coletivas` + `organizacao_membros` |
| 21 | `consultar_balanco_financeiro` | `CategoryDBWrite`* | **Leitura** | `rpc_get_balanco_ia` → `transacoes_financeiras` |
| 22 | `consultar_previsao_tempo` | `CategoryRAG` | **Leitura / Ext** | WeatherAPI (Clima e índices agronômicos) |

*\*Nota: As ferramentas 16, 20 e 21 estão registradas com `CategoryDBWrite` no struct por razões históricas de permissão, mas são 100% de leitura/cálculo sem efeito colateral de mutação no banco.*

---

## 2. Diagnóstico dos Casos de Uso e Benchmarks

### A. Criação de Fazendas / Propriedades
- **Situação no Schema:** Existe a tabela `propriedades` (com `area_total_ha`, `modalidade_predominante`, `tem_producao_paralela`) e `pmos` (vínculo safra/ano).
- **Situação nas Tools:** **Não existe tool implementada para criar uma nova propriedade do zero via WhatsApp**. Hoje o bot apenas permite alternar propriedades (`selecionar_fazenda`) ou criar infraestrutura interna de talhões/canteiros (`criar_talhao`, `criar_infraestrutura_fazenda`).
- **Necessidade:** Tool `cadastrar_propriedade` para onboarding e expansão de produtores multi-fazenda.

### B. Registro de Manejo (Cenário S1:RegistrarManejo)
- **Situação no Benchmark:** O benchmark `S1:RegistrarManejo` testava a extração para `rpc_registrar_operacao_campo`.
- **Situação nas Tools:** **Já existem ferramentas implementadas** e funcionais no código Go (`RegistrarPlantio`, `registrar_colheita`, `registrar_limpeza`, `registrar_compostagem`, `registrar_propagacao_vegetal`, além de `RegistrarLoteOperacoes`).
- **Necessidade:** Unificação / padronização de nomenclatura (ex: `registrar_plantio` vs `RegistrarPlantio`) e adição de suporte explícito a pulverização/adubação orgânica e manejo fitossanitário no caderno de campo.

### C. Registro de Compras (Cenário S2:RegistrarCompra)
- **Situação no Benchmark:** Testava extração para a tool `registrar_compra_insumo`.
- **Situação nas Tools:** **Tool já implementada no Go** (`registrar_compra_insumo`) chamando a RPC `rpc_registrar_compra_insumo`. Ela garante atomicidade entre a Seção 8 do PMO (`pmo_insumos`) e a tabela `caderno_campo`.
- **Necessidade:** Validação e suporte ao rateio financeiro opcional (`alocacoes_talhoes`) e integração com `transacoes_financeiras`.

### D. Lançamento de Despesas e Operações em Lote
- **Despesas:** A tool `registrar_despesa` chama `rpc_registrar_transacao_com_rateio` gravando em `transacoes_financeiras`.
- **Operações em Lote:** A tool `RegistrarLoteOperacoes` está registrada no MCP e conectada a `SupabaseAgriculturalRepository`, processando listas heterogêneas de operações em uma única requisição com modelo de sucesso parcial.

---

## 3. Mapeamento de Tabelas Candidatas do Supabase

### 1. `public.propriedades` (Nova Fazenda)
- **Campos Obrigatórios:**
  - `nome` (text, não vazio)
  - `area_total_ha` (numeric, > 0)
  - `modalidade_predominante` (`ORGANICO` | `CONVENCIONAL` | `EM_TRANSICAO`)
- **Foreign Keys:**
  - `user_id` -> `profiles(id)` (injetado da sessão autenticada)
- **Validações de Negócio:**
  - `area_total_ha` deve ser estritamente positiva (> 0).
  - Impedir criação duplicada de fazenda com o mesmo nome para o mesmo `user_id`.
  - Ao criar a propriedade, criar automaticamente o primeiro PMO (Plano de Manejo Orgânico) se a modalidade for `ORGANICO` ou `EM_TRANSICAO`.

### 2. `public.talhoes` e `public.canteiros` (Infraestrutura)
- **Campos Obrigatórios:**
  - `nome` (text)
  - `area_ha` / `area_total_m2` (numeric, > 0)
  - `propriedade_id` (bigint)
- **Foreign Keys:**
  - `propriedade_id` -> `propriedades(id)` (da sessão ativa)
  - `pmo_id` -> `pmos(id)` (nullable se convencional)
  - `user_id` -> `profiles(id)`
- **Validações de Negócio:**
  - Área do talhão não pode exceder a área total da propriedade.
  - Canteiros precisam de `talhao_id` válido e quantidade inteira positiva.

### 3. `public.caderno_campo` (Manejos e Operações de Campo)
- **Campos Obrigatórios:**
  - `tipo_atividade` (text: `Plantio`, `Colheita`, `Manejo Fitossanitário`, `Adubação`, `Limpeza`, `Compostagem`, `Compra`, `Venda`, `Perda`)
  - `data_registro` (date, default: hoje)
  - `produto` ou `item_area` (text, não vazio)
  - `quantidade_valor` (numeric, obrigatório para atividades físicas)
  - `quantidade_unidade` (text: `kg`, `mudas`, `maços`, `L`, `sacos`, etc.)
- **Foreign Keys:**
  - `propriedade_id` -> `propriedades(id)` (obrigatório, da sessão ativa)
  - `pmo_id` -> `pmos(id)` (da sessão ativa)
  - `user_id` -> `profiles(id)`
  - `raw_payload_id` -> `raw_payloads(id)` (rastreabilidade de auditoria)
- **Validações de Negócio:**
  - Quantidade nunca pode ser negativa nem zero em operações produtivas.
  - `guardrails.DeterministicEvaluator`: Limite máximo de quantidade por operação (padrão 5.000 kg/L, ou limite customizado em `limites_seguranca`).
  - Talhão obrigatório para atividades de solo/área (`Plantio`, `Adubação`, `Colheita`, `Manejo Fitossanitário`).
  - Colheita gera obrigatoriamente código de `lote` de rastreabilidade (ex: `COL-20260816-TOM-123`).
  - Idempotência: prevenção de reprocessamento duplo de mensagem via hash/`LoopGuard`.

### 4. `public.transacoes_financeiras` (Livro Caixa e Despesas/Receitas)
- **Campos Obrigatórios:**
  - `propriedade_id` (bigint)
  - `tipo` (`DESPESA` | `RECEITA`)
  - `valor_total` (numeric, > 0)
  - `categoria_id` (uuid)
  - `data_competencia` (date)
- **Foreign Keys:**
  - `propriedade_id` -> `propriedades(id)`
  - `categoria_id` -> `categorias_financeiras(id)`
  - `pmo_id` -> `pmos(id)` (opcional)
  - `user_id` -> `profiles(id)`
- **Validações de Negócio:**
  - `valor_total` estritamente positivo (> 0).
  - `guardrails.DeterministicEvaluator`: Limite de transação financeira (padrão R$ 50.000,00 ou valor da tabela `limites_seguranca`).
  - Rateio (`alocacoes_talhoes`): Se especificado rateio entre talhões, a soma das alocações deve ser idêntica ao `valor_total`.

### 5. `public.pmo_insumos` (Catálogo de Insumos da Seção 8)
- **Campos Obrigatórios:**
  - `pmo_id` (bigint)
  - `produto_manejo` (text)
  - `dosagem` (text, não vazia)
- **Foreign Keys:**
  - `pmo_id` -> `pmos(id)`
- **Validações de Negócio:**
  - Unicidade de `(pmo_id, produto_manejo)` via `ON CONFLICT DO UPDATE`.
  - Rejeição de valores fictícios/nulos no campo dosagem ("0", "NÃO INFORMADO", "NULL").

### 6. `public.cotas_produtores` e `public.cronograma_plantio` (Planejamento Coletivo)
- **Campos Obrigatórios:**
  - `demanda_id` (uuid)
  - `propriedade_id` (bigint)
  - `usuario_id` (uuid)
  - `quantidade` (numeric, > 0)
  - `data_plantio` (date)
- **Foreign Keys:**
  - `demanda_id` -> `demandas_coletivas(id)`
  - `propriedade_id` -> `propriedades(id)`
- **Validações de Negócio:**
  - Quantidade assumida não pode ultrapassar o saldo restante da demanda.
  - Data de plantio não pode ser no passado.

---

## 4. Matriz de Ferramentas de Mutação Propostas e Política HITL

| Nome da Tool | Tabela(s) Afetada(s) | Parâmetros Principais | Validações Críticas | Confirmação Explícita (HITL)? | Exemplo de Mensagem de Confirmação |
|---|---|---|---|---|---|
| `cadastrar_propriedade` *(Nova)* | `propriedades`, `pmos`, `profiles` | `nome`, `area_total_ha`, `modalidade`, `tem_producao_paralela`, `endereco` | Nome não vazio; Área > 0; Enum válido | **SIM** | *"Confirma o cadastro da propriedade 'Sítio Boa Esperança' com 12.5 hectares na modalidade Orgânica?"* |
| `criar_infraestrutura_fazenda` | `talhoes`, `canteiros` | `nome_talhao`, `area_hectares`, `quantidade_canteiros`, `cultura` | Área > 0; Qtd canteiros >= 0; Propriedade ativa válida | **SIM** | *"Confirma a criação do talhão 'Gleba A' (2.0 ha) com 15 canteiros?"* |
| `registrar_plantio` *(Padronização)* | `caderno_campo` | `especies`, `quantidade_valor`, `quantidade_unidade`, `talhao_nome`, `data`, `origem` | Quantidade > 0; Talhão obrigatório; Limite de manejo | **NÃO** (se dentro dos limites) / **SIM** (se > R$ ou Qtd limiar) | *"Plantio de 500 mudas de Alface no Talhão 01 registrado com sucesso."* |
| `registrar_colheita` | `caderno_campo` | `cultura`, `quantidade`, `unidade`, `talhao`, `data`, `destino_inicial`, `valor_total` | Cultura obrigatória; Qtd > 0; Gera lote de rastreabilidade | **NÃO** (Feedback imediato com código do Lote) | *"Colheita de 120 kg de Tomate registrada (Lote: COL-20260816-TOM-084)."* |
| `registrar_manejo_campo` *(Nova)* | `caderno_campo` | `tipo_manejo` (Adubação, Pulverização, Poda, Capina), `produto_insumo`, `dosagem_valor`, `dosagem_unidade`, `talhao_nome`, `data` | Talhão obrigatório; Insumo registrado; Qtd > 0 | **NÃO** (Manejo de rotina) / **SIM** (se defensivo/calda) | *"Aplicação de Calda Bordalesa (20L) no Talhão 02 registrada no caderno de campo."* |
| `registrar_compra_insumo` | `pmo_insumos`, `caderno_campo`, `transacoes_financeiras` | `produto`, `quantidade_valor`, `quantidade_unidade`, `fornecedor`, `valor_total`, `data_compra`, `nota_fiscal`, `alocacoes_talhoes` | Produto não vazio; Se valor informado, valor > 0; Auto-catálogo Seção 8 | **SIM** (Se valor total > R$ 500 ou sem NF) | *"Confirma o lançamento da compra de 10 sacos de Calcário no valor de R$ 650,00 da Agropecuária Central?"* |
| `registrar_despesa` | `transacoes_financeiras` | `descricao`, `valor_total`, `categoria_nome`, `data`, `talhao_nome` | Valor > 0; Categoria válida; Limite financeiro (R$ 50k) | **SIM** (Impacto financeiro direto) | *"Confirma o lançamento da despesa de R$ 1.200,00 em 'Manutenção de Trator' hoje?"* |
| `registrar_venda` | `caderno_campo`, `transacoes_financeiras` | `produto`, `quantidade`, `unidade`, `cliente`, `valor_total`, `destinacao`, `data`, `nota_fiscal` | Produto e quantidade obrigatórios; Destinação válida | **SIM** (Se envolver valor financeiro recebido) | *"Confirma a venda de 80 kg de Tomate para 'Mercado Municipal' por R$ 480,00?"* |
| `registrar_cota_cooperativa` *(Nova)* | `cotas_produtores`, `cronograma_plantio` | `demanda_id`, `quantidade_ofertada`, `data_plantio_prevista` | Quantidade <= saldo da demanda; Data no futuro | **SIM** (Compromisso contratual com cooperativa) | *"Confirma o compromisso de entrega de 500 kg de Cenoura para a Cooperativa com plantio previsto para 20/09/2026?"* |
| `RegistrarLoteOperacoes` | Múltiplas tabelas (`caderno_campo`, `pmo_insumos`) | `operacoes` (array heterogêneo de operações) | Validação individual de cada item com modelo de sucesso parcial | **SIM** (Apresenta o sumário completo das operações para aprovação única) | *"Detectei 3 registros: 1) Plantio de Alface, 2) Colheita de Rúcula, 3) Compra de Adubo (R$ 300). Confirma o lançamento em lote?"* |
