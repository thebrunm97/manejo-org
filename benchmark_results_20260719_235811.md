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
| openai/gpt-4o-mini | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1073 | $0.000408 |
| google/gemini-3-flash-preview | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1902 | $0.001856 |
| tencent/hy3:free | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1796 | $0.000000 |
| stepfun/step-3.7-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2351 | $0.002978 |
| deepseek/deepseek-v4-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2262 | $0.000651 |
| z-ai/glm-5.2 | ✅ 1.00 | ❌ sem tool | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2760 | $0.001541 |
| nvidia/nemotron-3-ultra-550b-a55b:free | ❌ sem tool | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 682 | $0.000000 |
| xiaomi/mimo-v2.5 | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 3891 | $0.000753 |
| deepseek/deepseek-v4-pro | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2536 | $0.003057 |

## Detalhe por Modelo

### openai/gpt-4o-mini

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 955 | 322 | $0.000080 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1218 | 286 | $0.000072 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 583 | 181 | $0.000039 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 857 | 212 | $0.000046 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 815 | 240 | $0.000062 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2010 | 409 | $0.000109 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### google/gemini-3-flash-preview

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2641 | 318 | $0.000379 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1896 | 318 | $0.000369 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1606 | 184 | $0.000172 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1663 | 196 | $0.000180 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1984 | 218 | $0.000254 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1625 | 408 | $0.000501 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### tencent/hy3:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1907 | 587 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2182 | 581 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1606 | 448 | $0.000000 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1595 | 464 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1761 | 468 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1726 | 704 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### stepfun/step-3.7-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2277 | 1354 | $0.001065 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1902 | 793 | $0.000433 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1604 | 640 | $0.000378 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1858 | 582 | $0.000297 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 4220 | 614 | $0.000305 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2244 | 900 | $0.000500 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2642 | 912 | $0.000123 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1535 | 833 | $0.000109 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2804 | 591 | $0.000074 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1573 | 570 | $0.000069 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 2855 | 759 | $0.000103 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2163 | 1192 | $0.000174 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### z-ai/glm-5.2

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 931 | 612 | $0.000267 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1165 | 587 | $0.000258 | 0.00 | - | - | Sucesso (sem tool_call) |
| S3:ConsultaDRE | 2273 | 393 | $0.000157 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 964 | 444 | $0.000194 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 988 | 605 | $0.000318 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 10240 | 735 | $0.000346 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### nvidia/nemotron-3-ultra-550b-a55b:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 953 | 0 | $0.000000 | 0.00 | - | - | Erro API: Upstream error from Nvidia: ResourceExhausted: Worker local total request limit reached (32/32) |
| S2:RegistrarCompra | 596 | 913 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 572 | 658 | $0.000000 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 605 | 560 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 594 | 768 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 769 | 926 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### xiaomi/mimo-v2.5

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1820 | 823 | $0.000154 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 5857 | 775 | $0.000136 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 4870 | 573 | $0.000103 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1864 | 545 | $0.000092 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 3325 | 563 | $0.000095 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 5612 | 916 | $0.000173 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-pro

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2900 | 948 | $0.000576 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1259 | 822 | $0.000473 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2879 | 596 | $0.000331 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 2320 | 576 | $0.000308 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 3263 | 831 | $0.000516 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2598 | 1288 | $0.000853 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

