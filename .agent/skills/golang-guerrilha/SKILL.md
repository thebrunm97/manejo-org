---
name: golang-guerrilha
description: Padrões arquiteturais de alta performance e baixo acoplamento para refatoração em Go. Use sempre que escrever código para o pmo-bot-go.
---
# Golang Guerrilha Skill

## When to use this skill
Sempre que estiver escrevendo código para o projeto `pmo-bot-go`.

## Como programar (Regras Estritas)
1. **Zero Complexidade:** Não crie abstrações excessivas. Use `structs` puras.
2. **APIs Externas:** Para falar com Supabase, Groq ou Gemini, use clientes HTTP com `net/http` da biblioteca padrão. NÃO use SDKs pesados.
3. **Assincronismo:** Substitua Filas (Redis/Arq do Python) por `goroutines` simples invocadas a partir do Webhook.
4. **Estado:** Substitua LangGraph por Máquinas de Estado Finitas (FSM) com `switch/case` e `if/else`.
5. **Canteiros N:N:** Sempre represente localizações e canteiros como Arrays/Slices (`[]string`) e faça iterações (`for loops`) limpas para salvar no banco de dados.
