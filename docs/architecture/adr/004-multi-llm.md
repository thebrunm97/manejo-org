# ADR-004: Multi-LLM — Gemini Flash + Groq (Llama/Whisper)

## Status: Aceito

## Contexto
O sistema requer múltiplas capacidades cognitivas paralelas: processamento multimodal de imagens, transcrição rápida de áudio (WhatsApp), extração de entidades estruturadas de textos informais e orquestração de lógica conversacional complexa.

## Decisão
Utilizar uma arquitetura de múltiplos modelos de linguagem (Multi-LLM), roteando tarefas específicas para o provedor mais eficiente em termos de latência e custo.

## Estratégia de Roteamento
| Modelo | Provider | Especialidade no ManejoORG |
|---|---|---|
| **Gemini 2.0 Flash** | Google | Orquestração do Router, Tool Calling e Diálogo Geral. |
| **Gemini 1.5 Flash** | Google | Visão Computacional (análise de fotos de pragas/insumos). |
| **Llama 3.3 70B** | Groq | Extração rápida de JSON (NER) e classificação de intenção. |
| **Whisper Large V3** | Groq | Transcrição ultra-rápida (ASR) de áudios do WhatsApp. |

## Justificativa
- **Especialização**: Cada tarefa é enviada para o modelo que melhor a desempenha (ex: Whisper para áudio, Gemini para Multimodal).
- **Latência**: Groq entrega tokens em frações de segundos, essencial para uma experiência de chat fluida.
- **Resiliência Crítica**: Se o provedor principal (Google) sofrer instabilidade, tarefas básicas podem continuar via Groq/Outros.
- **Custo**: Otimizamos o uso de janelas de contexto pagas enviando apenas o necessário para os modelos mais caros.

## Consequências
- (+) Resposta ao usuário final percebida como "instantânea".
- (+) Alta precisão na transcrição de termos técnicos rurais.
- (-) Complexidade na gestão de múltiplas chaves e rate limits.
- (-) Necessidade de um roteador agnóstico no backend Go.
- **Mitigação**: Implementação do `LoopGuard` no backend para evitar loops infinitos entre modelos durante o tool calling.
