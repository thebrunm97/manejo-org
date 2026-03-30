# ADR-001: Go sobre Python para o Backend

## Status: Aceito
## Data: 2026-03-30 (Migração Documentada)

## Contexto
O backend original foi escrito em Python. Com o crescimento do número de usuários e a complexidade do motor multi-agente (IA), identificamos gargalos de performance e latência que impactavam a experiência do usuário no WhatsApp.

## Decisão
Migrar o backend para **Go (Golang)** utilizando o framework Gin para a camada de roteamento e webhooks.

## Justificativa
- **Performance**: Go oferece uma execução significativamente mais rápida em operações de I/O, cruciais para processamento de webhooks em tempo real.
- **Concorrência**: O uso de Goroutines nativas permite lidar com múltiplos usuários simultâneos de forma muito mais eficiente que o modelo de threading/async do Python.
- **Compilação Estática**: O binário único facilita o deploy e reduz drasticamente o tamanho da imagem Docker (de ~500MB para ~20MB).
- **Tipagem Forte**: Erros de estrutura e tipos são capturados em tempo de compilação, aumentando a robustez do sistema de webhooks.
- **Ecoeficiência**: Menor consumo de recursos (CPU/RAM) no servidor, reduzindo custos operacionais.

## Consequências
- (+) Latência de resposta do bot reduziu significativamente.
- (+) Imagens de container minimalistas e seguras (scratch).
- (+) Consumo de memória em repouso próximo de zero.
- (-) Ecossistema de bibliotecas nativas de IA é menor que em Python.
- (-) Curva de aprendizado inicial para o time focado em scripting.
- **Mitigação**: Toda a lógica pesada de inferência foi delegada para APIs externas (Gemini, Groq), mantendo o Go apenas como o orquestrador de alta performance.
