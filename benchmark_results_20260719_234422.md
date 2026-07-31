# Relatório de Benchmark — Manejo Org Model Shootout

## Cenários Testados

| Cenário | RPC | Descrição |
|---|---|---|
| S1:RegistrarManejo | `rpc_registrar_operacao_campo` | Extração de operação de manejo a partir de linguagem natural de produtor |
| S2:RegistrarCompra | `rpc_registrar_compra_insumo` | Extração de entidades de uma compra de insumo com nota fiscal |
| S3:ConsultaDRE | `get_dre_mensal` | Consulta analítica financeira — modelo deve acionar RPC de leitura correta |
| S4:BuscaRAG | `match_farm_documents` | Consulta de conhecimento agronômico — modelo deve acionar busca RAG antes de responder |
| S5:AmbiguityStress | `rpc_registrar_operacao_campo` | Mensagem vaga sem data e sem quantidade — testa preenchimento de defaults vs pedido de esclarecimento |

## Matriz de Completude (score 0.0–1.0)

| Modelo | S1:RegistrarManejo | S2:RegistrarCompra | S3:ConsultaDRE | S4:BuscaRAG | S5:AmbiguityStress | Latência Média(ms) | Custo Total(USD) |
|---|---|---|---|---|---|---|---|
| openai/gpt-4o-mini | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 1290 | $0.000301 |
| google/gemini-3-flash-preview | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | ✅ 1.00 | 2210 | $0.001358 |
| tencent/hy3:free | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 1744 | $0.000000 |
| xiaomi/mimo-v2.5 | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ⚠️ 0.50 | 2199 | $0.000590 |
| deepseek/deepseek-v4-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 2419 | $0.000427 |
| nvidia/nemotron-3-ultra-550b-a55b:free | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 631 | $0.000000 |
| stepfun/step-3.7-flash | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 4528 | $0.002145 |
| deepseek/deepseek-v4-pro | ✅ 1.00 | ✅ 1.00 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 4071 | $0.002150 |
| z-ai/glm-5.2 | ✅ 1.00 | ⚠️ 0.67 | ❌ sem tool | ✅ 1.00 | ✅ 1.00 | 6859 | $0.001360 |

## Detalhe por Modelo

### openai/gpt-4o-mini

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1562 | 322 | $0.000080 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 2515 | 286 | $0.000072 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 717 | 184 | $0.000041 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 799 | 213 | $0.000047 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 857 | 240 | $0.000062 | 1.00 | - | ✓ Sucesso |

### google/gemini-3-flash-preview

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 2398 | 318 | $0.000379 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 2443 | 318 | $0.000369 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 1811 | 184 | $0.000172 | 1.00 | - | ✓ Sucesso |
| S4:BuscaRAG | 2098 | 197 | $0.000184 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 2300 | 218 | $0.000254 | 1.00 | - | ✓ Sucesso |

### tencent/hy3:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 1994 | 587 | $0.000000 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 1702 | 580 | $0.000000 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 1676 | 444 | $0.000000 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1684 | 461 | $0.000000 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 1666 | 477 | $0.000000 | 1.00 | - | ✓ Sucesso |

### xiaomi/mimo-v2.5

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 3441 | 805 | $0.000149 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 2224 | 776 | $0.000137 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 1641 | 547 | $0.000096 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1644 | 573 | $0.000100 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 2046 | 613 | $0.000109 | 0.50 | `payload_arg.talhao_nome` | ⚠ Incompleto (1 campos ausentes) |

### deepseek/deepseek-v4-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 3768 | 891 | $0.000116 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 2114 | 822 | $0.000107 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 2106 | 571 | $0.000070 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 2255 | 543 | $0.000063 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 1852 | 607 | $0.000071 | 1.00 | - | ✓ Sucesso |

### nvidia/nemotron-3-ultra-550b-a55b:free

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 797 | 880 | $0.000000 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 621 | 866 | $0.000000 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 566 | 674 | $0.000000 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 608 | 560 | $0.000000 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 561 | 784 | $0.000000 | 1.00 | - | ✓ Sucesso |

### stepfun/step-3.7-flash

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 6546 | 823 | $0.000454 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 1538 | 810 | $0.000453 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 2090 | 477 | $0.000190 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 6891 | 593 | $0.000310 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 5577 | 990 | $0.000738 | 1.00 | - | ✓ Sucesso |

### deepseek/deepseek-v4-pro

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 3641 | 942 | $0.000571 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 10209 | 820 | $0.000471 | 1.00 | - | ✓ Sucesso |
| S3:ConsultaDRE | 3082 | 560 | $0.000300 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1106 | 570 | $0.000302 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 2319 | 818 | $0.000505 | 1.00 | - | ✓ Sucesso |

### z-ai/glm-5.2

| Cenário | Latência(ms) | Tokens | Custo(USD) | Score | Campos Ausentes | Status |
|---|---|---|---|---|---|---|
| S1:RegistrarManejo | 10514 | 873 | $0.000490 | 1.00 | - | ✓ Sucesso |
| S2:RegistrarCompra | 10125 | 562 | $0.000237 | 0.67 | `fornecedor_arg`, `nota_fiscal_arg` | ⚠ Incompleto (2 campos ausentes) |
| S3:ConsultaDRE | 10226 | 467 | $0.000221 | 0.00 | - | Sucesso (sem tool_call) |
| S4:BuscaRAG | 1208 | 428 | $0.000180 | 1.00 | - | ✓ Sucesso |
| S5:AmbiguityStress | 2219 | 504 | $0.000232 | 1.00 | - | ✓ Sucesso |

