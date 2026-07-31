# Relatório de Benchmark — Model Shootout

| Modelo | Latência(ms) | Prompt Tokens | Completion Tokens | Total Tokens | Tool Call | Custo/1k Tok (USD) | Custo da Run (USD) | Tentativas | Status |
|---|---|---|---|---|---|---|---|---|---|
| openai/gpt-4o-mini | 1116 | 123 | 29 | 152 | Sim | $0.000600 | $0.000036 | 1 | Sucesso |
| google/gemini-3-flash-preview | 1949 | 115 | 37 | 152 | Sim | $0.003000 | $0.000169 | 1 | Sucesso |
| tencent/hy3:free | 1817 | 311 | 50 | 361 | Sim | $0.000000 | $0.000000 | 1 | Sucesso |
| nvidia/nemotron-3-ultra-550b-a55b:free | 781 | 421 | 161 | 582 | Sim | $0.000000 | $0.000000 | 1 | Sucesso |
| xiaomi/mimo-v2.5 | 2399 | 625 | 166 | 791 | Sim | $0.000280 | $0.000134 | 1 | Sucesso |
| z-ai/glm-5.2 | 1128 | 265 | 119 | 384 | Sim | $0.000854 | $0.000174 | 1 | Sucesso |
| deepseek/deepseek-v4-flash | 2872 | 409 | 72 | 481 | Sim | $0.000196 | $0.000054 | 1 | Sucesso |
| deepseek/deepseek-v4-pro | 3602 | 396 | 146 | 542 | Sim | $0.000870 | $0.000299 | 1 | Sucesso |
| stepfun/step-3.7-flash | 6020 | 342 | 228 | 570 | Sim | $0.001150 | $0.000331 | 1 | Sucesso |
