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
| openai/gpt-4o-mini | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1283 | $0.000421 |
| google/gemini-3-flash-preview | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1993 | $0.001891 |
| tencent/hy3:free | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1757 | $0.000000 |
| nvidia/nemotron-3-ultra-550b-a55b:free | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | 637 | $0.000000 |
| stepfun/step-3.7-flash | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1897 | $0.002436 |
| xiaomi/mimo-v2.5 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ⚠️ 0.50 | ✅ 1.00 | 2289 | $0.000774 |
| deepseek/deepseek-v4-flash | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2425 | $0.000645 |
| z-ai/glm-5.2 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1738 | $0.005582 |
| deepseek/deepseek-v4-pro | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1543 | $0.002958 |

## Detalhe por Modelo

### openai/gpt-4o-mini

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1403 | 322 | $0.000080 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 996 | 286 | $0.000072 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1040 | 259 | $0.000052 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 852 | 213 | $0.000047 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 788 | 240 | $0.000062 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2616 | 409 | $0.000109 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### google/gemini-3-flash-preview

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2433 | 318 | $0.000379 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2120 | 318 | $0.000369 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1826 | 261 | $0.000210 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 2134 | 195 | $0.000178 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1665 | 218 | $0.000254 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1779 | 408 | $0.000501 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### tencent/hy3:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1912 | 587 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1709 | 571 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1666 | 514 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1814 | 470 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1565 | 477 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1876 | 733 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### nvidia/nemotron-3-ultra-550b-a55b:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 811 | 0 | $0.000000 | 0.00 | - | - | Erro API: Upstream error from Nvidia: ResourceExhausted: Worker local total request limit reached (32/32) |
| S2:RegistrarCompra | 575 | 901 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 739 | 651 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 562 | 556 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 565 | 0 | $0.000000 | 0.00 | - | - | Erro API: Upstream error from Nvidia: ResourceExhausted: Worker local total request limit reached (32/32) |
| S6:MultiToolDualAction | 570 | 917 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### stepfun/step-3.7-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2531 | 955 | $0.000606 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1731 | 782 | $0.000421 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1959 | 631 | $0.000277 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 2194 | 570 | $0.000283 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1827 | 660 | $0.000358 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1138 | 892 | $0.000491 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### xiaomi/mimo-v2.5

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2264 | 793 | $0.000145 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 4157 | 784 | $0.000139 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1751 | 598 | $0.000097 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1939 | 591 | $0.000105 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1957 | 679 | $0.000128 | 0.50 | - | `payload_arg.talhao_nome` | ⚠ Incompleto (1 campos ausentes) |
| S6:MultiToolDualAction | 1667 | 870 | $0.000160 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 3160 | 815 | $0.000104 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2045 | 823 | $0.000107 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2528 | 663 | $0.000079 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1924 | 594 | $0.000073 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 3133 | 727 | $0.000096 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1762 | 1249 | $0.000185 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### z-ai/glm-5.2

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2745 | 719 | $0.001293 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1536 | 574 | $0.000891 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1150 | 492 | $0.000687 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1229 | 427 | $0.000646 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 2081 | 543 | $0.000955 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1688 | 690 | $0.001109 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-pro

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2080 | 864 | $0.000505 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 968 | 828 | $0.000480 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 960 | 670 | $0.000356 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1101 | 565 | $0.000300 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 3199 | 733 | $0.000431 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 949 | 1325 | $0.000887 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

