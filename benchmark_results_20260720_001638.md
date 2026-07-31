# Relatório de Benchmark — Manejo Org Model Shootout

## Cenários Testados

| Cenário | RPC | Descrição |
|---|---|---|
| S1:RegistrarManejo | `rpc_registrar_operacao_campo` | Extração de operação de manejo a partir de linguagem natural de produtor |
| S2:RegistrarCompra | `rpc_registrar_compra_insumo` | Extração de entidades de uma compra de insumo com nota fiscal |
| S3:ConsultaDRE | `get_dre_mensal` | Consulta analítica financeira — modelo deve acionar RPC de leitura correta |
| S4:BuscaRAG | `match_farm_documents` | Consulta de conhecimento agronômico — modelo deve acionar busca RAG antes de responder |
| S5:AmbiguityStress | `rpc_registrar_operacao_campo` | Mensagem vaga sem data e sem quantidade — testa preenchimento de defaults vs pedido de esclarecimento |
| S6:MultiToolDualAction | `rpc_registrar_operacao_campo` | Dupla ação numa frase (colheita + uso de insumo) — valida parallel tool calls |

## Matriz de Completude (score 0.0–1.0)

| Modelo | S1:RegistrarManejo | S2:RegistrarCompra | S3:ConsultaDRE | S4:BuscaRAG | S5:AmbiguityStress | S6:MultiToolDualAction | Latência Média(ms) | Custo Total(USD) |
|---|---|---|---|---|---|---|---|---|
| openai/gpt-4o-mini | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1494 | $0.000420 |
| google/gemini-3-flash-preview | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2553 | $0.001883 |
| tencent/hy3:free | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2167 | $0.000000 |
| stepfun/step-3.7-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2890 | $0.003192 |
| nvidia/nemotron-3-ultra-550b-a55b:free | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 932 | $0.000000 |
| deepseek/deepseek-v4-pro | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1370 | $0.002818 |
| xiaomi/mimo-v2.5 | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ⚠️ 0.50 | ✅ 1.00 | 2364 | $0.000846 |
| z-ai/glm-5.2 | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1917 | $0.001778 |
| deepseek/deepseek-v4-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2927 | $0.000643 |

## Detalhe por Modelo

### openai/gpt-4o-mini

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1443 | 322 | $0.000080 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1448 | 286 | $0.000072 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1226 | 249 | $0.000050 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1136 | 214 | $0.000047 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1157 | 240 | $0.000062 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2551 | 409 | $0.000109 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### google/gemini-3-flash-preview

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2843 | 318 | $0.000379 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2529 | 318 | $0.000369 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2055 | 251 | $0.000206 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 2343 | 194 | $0.000175 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 3373 | 218 | $0.000254 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2175 | 408 | $0.000501 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### tencent/hy3:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2318 | 587 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2066 | 581 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1921 | 480 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 2107 | 463 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 2618 | 477 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1974 | 719 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### stepfun/step-3.7-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 5406 | 973 | $0.000627 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2493 | 804 | $0.000446 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2605 | 631 | $0.000288 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1906 | 576 | $0.000290 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 2114 | 1257 | $0.001045 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2816 | 897 | $0.000497 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### nvidia/nemotron-3-ultra-550b-a55b:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 949 | 941 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 923 | 878 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 909 | 0 | $0.000000 | 0.00 | - | - | Erro API: Upstream error from Nvidia: ResourceExhausted: Worker local total request limit reached (86/32) |
| S4:BuscaRAG | 908 | 562 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 978 | 759 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 927 | 1013 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-pro

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1411 | 948 | $0.000578 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1332 | 812 | $0.000466 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1379 | 715 | $0.000400 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1306 | 565 | $0.000300 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1333 | 759 | $0.000455 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1461 | 1017 | $0.000619 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### xiaomi/mimo-v2.5

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1227 | 815 | $0.000151 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1713 | 771 | $0.000135 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2609 | 770 | $0.000147 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 5189 | 607 | $0.000109 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1891 | 642 | $0.000117 | 0.50 | - | `payload_arg.talhao_nome` | ⚠ Incompleto (1 campos ausentes) |
| S6:MultiToolDualAction | 1554 | 962 | $0.000186 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### z-ai/glm-5.2

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2812 | 630 | $0.000283 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1684 | 571 | $0.000245 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1758 | 523 | $0.000224 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1783 | 421 | $0.000174 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1693 | 522 | $0.000247 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1771 | 1039 | $0.000605 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2846 | 812 | $0.000104 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2357 | 832 | $0.000109 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 3420 | 681 | $0.000083 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 3022 | 565 | $0.000068 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 3202 | 767 | $0.000104 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2714 | 1199 | $0.000175 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

