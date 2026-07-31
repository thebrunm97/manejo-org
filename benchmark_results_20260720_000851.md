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
| openai/gpt-4o-mini | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1214 | $0.000405 |
| google/gemini-3-flash-preview | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1839 | $0.001898 |
| tencent/hy3:free | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2029 | $0.000000 |
| xiaomi/mimo-v2.5 | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ⚠️ 0.50 | ✅ 1.00 | 1727 | $0.000740 |
| deepseek/deepseek-v4-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ⚠️ 0.50 | ✅ 1.00 | 2522 | $0.000633 |
| stepfun/step-3.7-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 3933 | $0.002514 |
| deepseek/deepseek-v4-pro | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 1671 | $0.002889 |
| nvidia/nemotron-3-ultra-550b-a55b:free | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 901 | $0.000000 |
| z-ai/glm-5.2 | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 4778 | $0.001520 |

## Detalhe por Modelo

### openai/gpt-4o-mini

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1170 | 322 | $0.000080 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1065 | 286 | $0.000072 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 720 | 179 | $0.000038 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 845 | 213 | $0.000047 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 809 | 236 | $0.000060 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2678 | 409 | $0.000109 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### google/gemini-3-flash-preview

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1998 | 318 | $0.000379 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1750 | 318 | $0.000369 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1629 | 184 | $0.000172 | 1.00 | - | - | ✓ Sucesso |
| S4:BuscaRAG | 1653 | 197 | $0.000184 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 2152 | 219 | $0.000257 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1852 | 420 | $0.000538 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### tencent/hy3:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1946 | 605 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1864 | 591 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1649 | 420 | $0.000000 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1720 | 510 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 3095 | 477 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1903 | 733 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### xiaomi/mimo-v2.5

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1459 | 767 | $0.000138 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1000 | 768 | $0.000134 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1663 | 553 | $0.000098 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 3242 | 540 | $0.000091 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1356 | 649 | $0.000119 | 0.50 | - | `payload_arg.talhao_nome` | ⚠ Incompleto (1 campos ausentes) |
| S6:MultiToolDualAction | 1642 | 872 | $0.000160 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 3059 | 875 | $0.000116 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 2962 | 827 | $0.000108 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2436 | 614 | $0.000079 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1971 | 591 | $0.000073 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1989 | 828 | $0.000116 | 0.50 | - | `payload_arg.talhao_nome` | ⚠ Incompleto (1 campos ausentes) |
| S6:MultiToolDualAction | 2712 | 1032 | $0.000142 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### stepfun/step-3.7-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 5900 | 1014 | $0.000674 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 3787 | 718 | $0.000347 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2670 | 551 | $0.000276 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 5199 | 562 | $0.000274 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 4425 | 696 | $0.000400 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1616 | 938 | $0.000544 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### deepseek/deepseek-v4-pro

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1292 | 842 | $0.000486 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 1049 | 814 | $0.000468 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 2619 | 552 | $0.000293 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 2328 | 592 | $0.000321 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 946 | 673 | $0.000381 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1792 | 1387 | $0.000940 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### nvidia/nemotron-3-ultra-550b-a55b:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 784 | 1136 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 552 | 884 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1790 | 677 | $0.000000 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 566 | 0 | $0.000000 | 0.00 | - | - | Erro API: Upstream error from Nvidia: ResourceExhausted: Worker local total request limit reached (33/32) |
| S5:AmbiguityStress | 556 | 821 | $0.000000 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 1157 | 965 | $0.000000 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

### z-ai/glm-5.2

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Calls | Campos Ausentes | Status |
|---|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 10390 | 617 | $0.000272 | 1.00 | - | - | ✓ Sucesso |
| S2:RegistrarCompra | 6485 | 580 | $0.000252 | 1.00 | - | - | ✓ Sucesso |
| S3:ConsultaDRE | 1772 | 403 | $0.000165 | 0.00 | - | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 6587 | 430 | $0.000181 | 1.00 | - | - | ✓ Sucesso |
| S5:AmbiguityStress | 1360 | 547 | $0.000268 | 1.00 | - | - | ✓ Sucesso |
| S6:MultiToolDualAction | 2074 | 777 | $0.000382 | 1.00 | 2/2 | - | ✓ Sucesso (2 calls) |

